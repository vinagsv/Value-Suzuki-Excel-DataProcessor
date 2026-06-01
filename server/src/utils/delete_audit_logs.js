// ============================================================
// FILE: server/src/utils/delete_audit_logs.js
//
// TERMINAL-ONLY utility to delete receipt audit log entries.
// NOT exposed via any API route.
//
// Usage:
//   node src/utils/delete_audit_logs.js --from 2024-01-01 --to 2024-03-31
//   node src/utils/delete_audit_logs.js --all
//   node src/utils/delete_audit_logs.js --from 2024-01-01 --to 2024-03-31 --dry-run
//   node src/utils/delete_audit_logs.js --all --confirm
//
// Options:
//   --from      Start date (YYYY-MM-DD), inclusive. Required unless --all.
//   --to        End date   (YYYY-MM-DD), inclusive. Required unless --all.
//   --all       Delete ALL audit log entries (ignores --from/--to).
//   --dry-run   Count rows that would be deleted; make no changes.
//   --confirm   Skip interactive confirmation prompt.
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

// ── Parse CLI args ─────────────────────────────────────────────
const args      = process.argv.slice(2);
const getArg    = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag   = (flag) => args.includes(flag);

const fromDate    = getArg('--from');
const toDate      = getArg('--to');
const deleteAll   = hasFlag('--all');
const isDryRun    = hasFlag('--dry-run');
const skipConfirm = hasFlag('--confirm');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Validate ───────────────────────────────────────────────────
if (!deleteAll && (!fromDate || !toDate)) {
  console.error('\n❌  Provide either --all, or both --from and --to.\n');
  console.error('Examples:');
  console.error('  node src/utils/delete_audit_logs.js --from 2024-01-01 --to 2024-03-31');
  console.error('  node src/utils/delete_audit_logs.js --all\n');
  process.exit(1);
}

if (!deleteAll) {
  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    console.error('❌  Dates must be in YYYY-MM-DD format.');
    process.exit(1);
  }
  if (fromDate > toDate) {
    console.error('❌  --from must be on or before --to.');
    process.exit(1);
  }
}

// ── DB pool ────────────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Prompt helper ──────────────────────────────────────────────
function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// ── Main ───────────────────────────────────────────────────────
const run = async () => {
  const client = await pool.connect();

  const rangeLabel = deleteAll ? 'ALL ENTRIES' : `${fromDate}  →  ${toDate}`;

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  VALUE SUZUKI — AUDIT LOG DELETION UTILITY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Scope  : ${rangeLabel}`);
  console.log(`  Mode   : ${isDryRun ? '🔍 DRY RUN (no changes)' : '🗑️  LIVE DELETE'}`);
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // Count affected rows
    let countRes;
    if (deleteAll) {
      countRes = await client.query('SELECT COUNT(*) FROM receipt_audit_log');
    } else {
      countRes = await client.query(
        'SELECT COUNT(*) FROM receipt_audit_log WHERE changed_at::date >= $1 AND changed_at::date <= $2',
        [fromDate, toDate]
      );
    }
    const count = parseInt(countRes.rows[0].count, 10);

    if (count === 0) {
      console.log('ℹ️   No audit log entries found for this scope. Nothing to delete.\n');
      return;
    }

    // Show preview
    let previewRes;
    if (deleteAll) {
      previewRes = await client.query(
        `SELECT id, receipt_no, action, changed_by_email, changed_at
         FROM receipt_audit_log ORDER BY changed_at DESC LIMIT 10`
      );
    } else {
      previewRes = await client.query(
        `SELECT id, receipt_no, action, changed_by_email, changed_at
         FROM receipt_audit_log
         WHERE changed_at::date >= $1 AND changed_at::date <= $2
         ORDER BY changed_at DESC LIMIT 10`,
        [fromDate, toDate]
      );
    }

    console.log(`📋  Found ${count} audit log entries. Preview (most recent 10):\n`);
    console.log('  ID        | Receipt # | Action    | Changed By              | Timestamp');
    console.log('  ----------|-----------|-----------|-------------------------|--------------------');
    previewRes.rows.forEach(r => {
      const id     = String(r.id).padEnd(9);
      const rNo    = String(r.receipt_no).padEnd(9);
      const action = String(r.action).padEnd(9);
      const email  = (r.changed_by_email || 'unknown').substring(0, 23).padEnd(23);
      const ts     = String(r.changed_at).substring(0, 19);
      console.log(`  ${id} | ${rNo} | ${action} | ${email} | ${ts}`);
    });
    if (count > 10) console.log(`  ... and ${count - 10} more.\n`);
    else console.log('');

    if (isDryRun) {
      console.log(`✅  DRY RUN complete. ${count} audit log entries would be deleted.`);
      console.log('    Re-run without --dry-run to perform the actual deletion.\n');
      return;
    }

    // Confirm
    if (!skipConfirm) {
      const answer = await prompt(
        `⚠️   About to PERMANENTLY DELETE ${count} audit log entries.\n    Type "DELETE" to confirm, or anything else to cancel: `
      );
      if (answer !== 'DELETE') {
        console.log('\n🚫  Cancelled. No records were deleted.\n');
        return;
      }
    }

    // Execute
    await client.query('BEGIN');
    let deleteRes;
    if (deleteAll) {
      deleteRes = await client.query('DELETE FROM receipt_audit_log');
    } else {
      deleteRes = await client.query(
        'DELETE FROM receipt_audit_log WHERE changed_at::date >= $1 AND changed_at::date <= $2',
        [fromDate, toDate]
      );
    }
    await client.query('COMMIT');

    console.log(`\n✅  Successfully deleted ${deleteRes.rowCount} audit log entries.\n`);

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