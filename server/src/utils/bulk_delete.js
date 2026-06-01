// ============================================================
// FILE: server/src/utils/bulk_delete.js
//
// TERMINAL-ONLY bulk delete utility for general_receipts.
// Logs every deleted receipt to receipt_audit_log as BULK_DELETED.
//
// Usage:
//   node src/utils/bulk_delete.js --from 2024-01-01 --to 2024-03-31
//   node src/utils/bulk_delete.js --from 2024-01-01 --to 2024-03-31 --dry-run
//   node src/utils/bulk_delete.js --from 2024-04-01 --to 2024-04-30 --confirm
//
// Options:
//   --from      Start date (YYYY-MM-DD), inclusive. REQUIRED.
//   --to        End date   (YYYY-MM-DD), inclusive. REQUIRED.
//   --dry-run   Only count how many rows would be deleted, no actual deletion.
//   --confirm   Skip the interactive confirmation prompt.
// ============================================================

import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL missing. Make sure your .env is in the server/ folder.');
  process.exit(1);
}

// ── Parse CLI args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const fromDate  = getArg('--from');
const toDate    = getArg('--to');
const isDryRun  = hasFlag('--dry-run');
const skipConfirm = hasFlag('--confirm');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

if (!fromDate || !toDate) {
  console.error('\n❌  Both --from and --to are required.\n');
  console.error('Usage:');
  console.error('  node src/utils/bulk_delete.js --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--confirm]\n');
  process.exit(1);
}

if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
  console.error('❌  Dates must be in YYYY-MM-DD format.');
  process.exit(1);
}

if (fromDate > toDate) {
  console.error('❌  --from date must be on or before --to date.');
  process.exit(1);
}

// ── DB pool ────────────────────────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Prompt helper ──────────────────────────────────────────────────────────
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
const run = async () => {
  const client = await pool.connect();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  VALUE SUZUKI — BULK DELETE UTILITY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Range  : ${fromDate}  →  ${toDate}`);
  console.log(`  Mode   : ${isDryRun ? '🔍 DRY RUN (no changes)' : '🗑️  LIVE DELETE'}`);
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // Count rows in range
    const countRes = await client.query(
      'SELECT COUNT(*) FROM general_receipts WHERE date >= $1 AND date <= $2',
      [fromDate, toDate]
    );
    const count = parseInt(countRes.rows[0].count, 10);

    if (count === 0) {
      console.log('ℹ️   No receipts found in this date range. Nothing to delete.\n');
      return;
    }

    // Fetch all receipts to be deleted (for audit log)
    const toDeleteRes = await client.query(
      `SELECT receipt_no, date, customer_name, amount, file_no, payment_type, payment_mode, status
       FROM general_receipts
       WHERE date >= $1 AND date <= $2
       ORDER BY date ASC`,
      [fromDate, toDate]
    );

    // Preview
    console.log(`📋  Found ${count} receipt(s) in range. Preview (first 10):\n`);
    console.log('  Receipt #   | Date         | Customer                    | Amount');
    console.log('  ------------|--------------|-----------------------------|---------');
    toDeleteRes.rows.slice(0, 10).forEach(r => {
      const rNo  = String(r.receipt_no).padEnd(11);
      const date = String(r.date).substring(0, 10).padEnd(12);
      const name = (r.customer_name || '').substring(0, 27).padEnd(27);
      const amt  = `₹${r.amount}`;
      console.log(`  ${rNo} | ${date} | ${name} | ${amt}`);
    });
    if (count > 10) console.log(`  ... and ${count - 10} more.\n`);
    else console.log('');

    if (isDryRun) {
      console.log(`✅  DRY RUN complete. ${count} receipt(s) would be deleted.`);
      console.log('    Re-run without --dry-run to perform the actual deletion.\n');
      return;
    }

    // Confirm
    if (!skipConfirm) {
      const answer = await prompt(
        `⚠️   About to PERMANENTLY DELETE ${count} receipt(s).\n    Type "DELETE" to confirm, or anything else to cancel: `
      );
      if (answer !== 'DELETE') {
        console.log('\n🚫  Cancelled. No records were deleted.\n');
        return;
      }
    }

    // Execute deletion + audit logging in a single transaction
    await client.query('BEGIN');

    // Write a BULK_DELETED audit entry for every receipt being deleted
    const runningUser = process.env.USER || process.env.USERNAME || 'terminal';
    const auditValues = toDeleteRes.rows.map(r => ({
      receipt_no: r.receipt_no,
      changed_fields: {
        date:         String(r.date).substring(0, 10),
        customer_name: r.customer_name || '',
        amount:       String(r.amount),
        file_no:      r.file_no || '',
        payment_type: r.payment_type || '',
        payment_mode: r.payment_mode || '',
        status:       r.status || 'ACTIVE',
        bulk_range:   `${fromDate} to ${toDate}`,
      }
    }));

    // Batch insert audit entries
    const CHUNK = 100;
    for (let i = 0; i < auditValues.length; i += CHUNK) {
      const chunk = auditValues.slice(i, i + CHUNK);
      const placeholders = chunk.map((_, idx) =>
        `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`
      ).join(',');
      const flatValues = chunk.flatMap(v => [
        v.receipt_no,
        'BULK_DELETED',
        `terminal:${runningUser}`,
        JSON.stringify(v.changed_fields)
      ]);
      await client.query(
        `INSERT INTO receipt_audit_log (receipt_no, action, changed_by_email, changed_fields) VALUES ${placeholders}`,
        flatValues
      );
    }

    // Delete receipts
    const deleteRes = await client.query(
      'DELETE FROM general_receipts WHERE date >= $1 AND date <= $2',
      [fromDate, toDate]
    );
    await client.query('COMMIT');

    console.log(`\n✅  Successfully deleted ${deleteRes.rowCount} receipt(s) from ${fromDate} to ${toDate}.`);
    console.log(`📝  ${deleteRes.rowCount} BULK_DELETED entries written to receipt_audit_log.\n`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌  Error during deletion:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

run();