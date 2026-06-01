// ============================================================
// FILE: server/src/utils/migrate.js
//
// Run with:  node src/utils/migrate.js
// from the /server directory (where .env lives).
//
// Does two things:
//   1. Creates the receipt_audit_log table (if not exists)
//   2. Seeds qr_enabled into app_settings (if not exists)
// ============================================================

import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL missing. Make sure your .env is in the server/ folder.');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const run = async () => {
  const client = await pool.connect();
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  VALUE SUZUKI — RUNNING MIGRATIONS');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    await client.query('BEGIN');

    // ── MIGRATION 1: receipt_audit_log table ─────────────────────────────────
    console.log('▶  Migration 1: receipt_audit_log table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS receipt_audit_log (
        id               BIGSERIAL    PRIMARY KEY,
        receipt_no       BIGINT       NOT NULL,
        action           TEXT         NOT NULL,
        changed_by_email TEXT,
        changed_fields   JSONB        NOT NULL DEFAULT '{}',
        changed_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    console.log('   ✅  Table receipt_audit_log — OK');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_receipt_no
        ON receipt_audit_log (receipt_no)
    `);
    console.log('   ✅  Index on receipt_no — OK');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_changed_at
        ON receipt_audit_log (changed_at DESC)
    `);
    console.log('   ✅  Index on changed_at — OK');

    // ── MIGRATION 2: qr_enabled setting ──────────────────────────────────────
    console.log('\n▶  Migration 2: qr_enabled in app_settings');

    const result = await client.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('qr_enabled', 'true')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `);

    if (result.rowCount > 0) {
      console.log("   ✅  Inserted qr_enabled = 'true' into app_settings");
    } else {
      const existing = await client.query(
        "SELECT value FROM app_settings WHERE key = 'qr_enabled'"
      );
      console.log(`   ℹ️   qr_enabled already exists (current value: '${existing.rows[0]?.value}'). Skipped.`);
    }

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅  ALL MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  MIGRATION FAILED — transaction rolled back.');
    console.error('   Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

run();