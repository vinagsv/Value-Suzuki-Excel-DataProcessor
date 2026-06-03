// TERMINAL-ONLY utility to delete receipt audit log entries.
// NOT exposed via any API route.
// Run with:  node src/utils/delete_audit_logs.js
//
// ── How the targeting works ─────────────────────────────────────────────────
//   RECEIPTS + DATE  → delete logs for those receipt(s) recorded on that date
//   RECEIPTS only    → delete ALL logs for those receipt(s) (date ignored)
//   DATE only        → delete ALL logs recorded on that date
//   MULTIPLE RECEIPTS→ date is ALWAYS ignored; deletes all logs of those receipts
//
// Notes:
//   • DATE matches changed_at (when the log was written), not the receipt date.
//   • Set DRY_RUN = true to preview without deleting.
//   • Set SKIP_CONFIRM = true to delete without the typed "DELETE" prompt.
// ============================================================

import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// ════════════════════════════════════════════════════════════════════════════
//  CONFIG — EDIT THESE VALUES
// ════════════════════════════════════════════════════════════════════════════

// Receipt numbers to target. Examples:
//   []                      → no receipt filter (use DATE only)
//   [260211]                → a single receipt
//   [260211, 260212, 260300]→ multiple receipts (DATE is ignored)
const RECEIPT_NOS = [260211];

// Date the log was recorded, YYYY-MM-DD, or '' for none. Examples:
//   '2026-05-01'  → only logs written on 1 May 2026
//   ''            → no date filter
// IMPORTANT: ignored automatically when RECEIPT_NOS has more than one entry.
const DATE = '2026-05-01';

// Safety switches
const DRY_RUN     = false;  // true  = preview only, no deletion
const SKIP_CONFIRM = false; // true  = skip the typed "DELETE" prompt

// ════════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL missing. Make sure your .env is in the server/ folder.');
  process.exit(1);
}

// ── Normalize + validate config ──────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Clean the receipt list: keep only valid integers
const receipts = (Array.isArray(RECEIPT_NOS) ? RECEIPT_NOS : [])
  .map(r => parseInt(r, 10))
  .filter(r => !isNaN(r));

const dateGiven = typeof DATE === 'string' && DATE.trim() !== '';
if (dateGiven && !DATE_RE.test(DATE.trim())) {
  console.error(`❌  DATE must be in YYYY-MM-DD format (got "${DATE}").`);
  process.exit(1);
}
const dateVal = dateGiven ? DATE.trim() : null;

if (receipts.length === 0 && !dateVal) {
  console.error('\n❌  Nothing to target. Set RECEIPT_NOS, or DATE, or both, in the CONFIG block.\n');
  process.exit(1);
}

// Decide effective mode. Multiple receipts ALWAYS ignore the date.
const multipleReceipts = receipts.length > 1;
const useDate = dateVal && !multipleReceipts;

// Build a human-readable scope label + the SQL WHERE clause + params.
let scopeLabel;
let whereClause;
let params;

if (receipts.length > 0 && useDate) {
  // Single receipt + date
  scopeLabel  = `Receipt #${receipts[0]} · logs recorded on ${dateVal}`;
  whereClause = 'WHERE receipt_no = $1 AND changed_at::date = $2';
  params      = [receipts[0], dateVal];
} else if (receipts.length > 0) {
  // One or more receipts, no date (date dropped if multiple)
  scopeLabel = receipts.length === 1
    ? `Receipt #${receipts[0]} · ALL logs`
    : `Receipts ${receipts.map(r => `#${r}`).join(', ')} · ALL logs (date ignored)`;
  whereClause = 'WHERE receipt_no = ANY($1)';
  params      = [receipts];
} else {
  // Date only
  scopeLabel  = `ALL receipts · logs recorded on ${dateVal}`;
  whereClause = 'WHERE changed_at::date = $1';
  params      = [dateVal];
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

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  VALUE SUZUKI — AUDIT LOG DELETION UTILITY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Scope  : ${scopeLabel}`);
  console.log(`  Mode   : ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '🗑️  LIVE DELETE'}`);
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // Count affected rows
    const countRes = await client.query(
      `SELECT COUNT(*) FROM receipt_audit_log ${whereClause}`,
      params
    );
    const count = parseInt(countRes.rows[0].count, 10);

    if (count === 0) {
      console.log('ℹ️   No audit log entries found for this scope. Nothing to delete.\n');
      return;
    }

    // Show preview
    const previewRes = await client.query(
      `SELECT id, receipt_no, action, changed_by_email, changed_at
       FROM receipt_audit_log
       ${whereClause}
       ORDER BY changed_at DESC LIMIT 10`,
      params
    );

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

    if (DRY_RUN) {
      console.log(`✅  DRY RUN complete. ${count} audit log entries would be deleted.`);
      console.log('    Set DRY_RUN = false to perform the actual deletion.\n');
      return;
    }

    // Confirm
    if (!SKIP_CONFIRM) {
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
    const deleteRes = await client.query(
      `DELETE FROM receipt_audit_log ${whereClause}`,
      params
    );
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