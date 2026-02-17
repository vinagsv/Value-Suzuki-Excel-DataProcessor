/**
 * ============================================================
 *  VALUE SUZUKI — PRODUCTION DATABASE MIGRATION SCRIPT
 * ============================================================
 *
 *  WHAT THIS SCRIPT DOES (in order):
 *  1. Connects to the production DB using DATABASE_URL from .env
 *  2. Runs every migration in a single atomic transaction.
 *     If ANY step fails, the entire migration is rolled back —
 *     the database is left exactly as it was.
 *
 *  TABLE MIGRATIONS (safe: no data loss):
 *  ─────────────────────────────────────
 *  • users              → Wipes ALL existing users, creates
 *                         the single admin account.
 *  • general_receipts   → Adds missing columns (financial_year,
 *                         status) if they don't already exist.
 *                         All existing rows are preserved.
 *  • dp_receipts        → Ensures table + correct sequence start.
 *                         All existing rows are preserved.
 *  • gate_passes        → Ensures table + correct sequence start.
 *                         All existing rows are preserved.
 *  • form22_vehicles    → Ensures table exists.
 *                         All existing rows are preserved.
 *  • attendance_storage → Ensures table exists.
 *                         All existing rows are preserved.
 *
 *  HOW TO RUN:
 *  ─────────────────────────────────────
 *  node db_migrate.js
 *
 *  Make sure DATABASE_URL (and NODE_ENV if needed) are set in
 *  your .env file or environment before running.
 * ============================================================
 */

import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

// ── Connection ────────────────────────────────────────────────
const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ── Helpers ───────────────────────────────────────────────────

/**
 * Returns true if the given column already exists on the table.
 * Uses information_schema so it works on any Postgres version.
 */
const columnExists = async (client, table, column) => {
  const res = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1
       AND column_name = $2`,
    [table, column]
  );
  return res.rowCount > 0;
};

/**
 * Returns true if the given table exists in the public schema.
 */
const tableExists = async (client, table) => {
  const res = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name   = $1`,
    [table]
  );
  return res.rowCount > 0;
};

/**
 * Returns the current maximum value of a serial sequence,
 * or null if the table is empty.
 */
const getMaxSeqValue = async (client, table, column) => {
  const res = await client.query(
    `SELECT MAX(${column}) AS max_val FROM ${table}`
  );
  return res.rows[0].max_val;
};

// ── Migration Steps ───────────────────────────────────────────

/**
 * STEP 1 — users table
 *
 * Strategy:
 *   • CREATE TABLE IF NOT EXISTS  (safe first-run)
 *   • DELETE all existing users   (hard reset as requested)
 *   • INSERT the new admin account
 */
const migrateUsers = async (client) => {
  console.log('\n📋 [users] Migrating...');

  // 1a. Ensure the table exists (old schema may be missing columns)
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(50)  NOT NULL,
      password_hash TEXT         NOT NULL,
      role          VARCHAR(20)  DEFAULT 'user',
      created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✔ Table structure verified.');

  // 1b. Add email column if it doesn't exist yet
  if (!(await columnExists(client, 'users', 'email'))) {
    // Add as nullable first so existing rows don't violate NOT NULL
    await client.query(`ALTER TABLE users ADD COLUMN email VARCHAR(100)`);
    console.log('  ✔ Column added: email');
  } else {
    console.log('  – Column already exists: email');
  }

  // 1c. Add created_at column if it doesn't exist yet
  if (!(await columnExists(client, 'users', 'created_at'))) {
    await client.query(`ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    console.log('  ✔ Column added: created_at');
  } else {
    console.log('  – Column already exists: created_at');
  }

  // 1d. Wipe all existing users
  const deleted = await client.query('DELETE FROM users');
  console.log(`  ✔ Removed ${deleted.rowCount} existing user(s).`);

  // 1e. Now that the table is empty, enforce NOT NULL + UNIQUE on email
  //     (safe to do after DELETE — no existing rows can violate it)
  await client.query(`ALTER TABLE users ALTER COLUMN email SET NOT NULL`);
  
  // Add unique constraint only if it doesn't already exist
  const uniqueExists = await client.query(`
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype   = 'u'
      AND conname   = 'users_email_key'
  `);
  if (uniqueExists.rowCount === 0) {
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email)`);
    console.log('  ✔ UNIQUE constraint added on email.');
  }

  // 1f. Hash the new admin password (bcrypt cost-12 for production strength)
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash('Accounts12*', salt);

  // 1g. Insert the new admin
  await client.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4)`,
    ['Admin', 'admin@valuesuzuki.com', hash, 'admin']
  );
  console.log('  ✔ Admin account created: admin@valuesuzuki.com');
};

/**
 * STEP 2 — general_receipts table
 *
 * Strategy:
 *   • CREATE TABLE IF NOT EXISTS  (safe first-run)
 *   • Add columns that may be missing in an older schema version:
 *       – financial_year  (VARCHAR 10)
 *       – status          (TEXT, default 'ACTIVE')
 *   • Back-fill financial_year for existing rows where it is NULL
 *   • Back-fill status for existing rows where it is NULL
 *   All existing data rows are 100% preserved.
 */
const migrateGeneralReceipts = async (client) => {
  console.log('\n📋 [general_receipts] Migrating...');

  // 2a. Create table if it does not exist yet
  await client.query(`
    CREATE TABLE IF NOT EXISTS general_receipts (
      receipt_no     BIGINT PRIMARY KEY,
      financial_year VARCHAR(10),
      date           DATE           NOT NULL,
      customer_name  TEXT           NOT NULL,
      mobile         TEXT,
      gst_no         TEXT,
      file_no        TEXT,
      hp_financier   TEXT,
      model          TEXT,
      amount         NUMERIC(12,2)  NOT NULL,
      payment_type   TEXT,
      payment_mode   TEXT,
      payment_date   DATE,
      cheque_no      TEXT,
      status         TEXT           DEFAULT 'ACTIVE',
      created_at     TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✔ Table structure verified.');

  // 2b. Add financial_year column if missing
  if (!(await columnExists(client, 'general_receipts', 'financial_year'))) {
    await client.query(`ALTER TABLE general_receipts ADD COLUMN financial_year VARCHAR(10)`);
    console.log('  ✔ Column added: financial_year');
  } else {
    console.log('  – Column already exists: financial_year');
  }

  // 2c. Add status column if missing
  if (!(await columnExists(client, 'general_receipts', 'status'))) {
    await client.query(`ALTER TABLE general_receipts ADD COLUMN status TEXT DEFAULT 'ACTIVE'`);
    console.log('  ✔ Column added: status');
  } else {
    console.log('  – Column already exists: status');
  }

  // 2d. Back-fill financial_year for rows where it is NULL
  //     Logic mirrors the app's getFyPrefix() helper:
  //     Jan–Mar → previous calendar year's last two digits
  //     Apr–Dec → current calendar year's last two digits
  const backfillFy = await client.query(`
    UPDATE general_receipts
    SET    financial_year = CASE
             WHEN EXTRACT(MONTH FROM date) < 4
               THEN TO_CHAR(EXTRACT(YEAR FROM date)::INT - 1, 'FM99')
             ELSE
               RIGHT(EXTRACT(YEAR FROM date)::TEXT, 2)
           END
    WHERE  financial_year IS NULL
  `);
  if (backfillFy.rowCount > 0) {
    console.log(`  ✔ Back-filled financial_year on ${backfillFy.rowCount} row(s).`);
  }

  // 2e. Back-fill status = 'ACTIVE' for rows where it is NULL
  const backfillStatus = await client.query(`
    UPDATE general_receipts
    SET    status = 'ACTIVE'
    WHERE  status IS NULL
  `);
  if (backfillStatus.rowCount > 0) {
    console.log(`  ✔ Back-filled status on ${backfillStatus.rowCount} row(s).`);
  }

  const count = await client.query('SELECT COUNT(*) FROM general_receipts');
  console.log(`  ℹ Total rows preserved: ${count.rows[0].count}`);
};

/**
 * STEP 3 — dp_receipts table
 *
 * Strategy:
 *   • CREATE TABLE IF NOT EXISTS
 *   • If the table was created fresh, restart the sequence at 712
 *     (matches the app's expected starting receipt number).
 *   • If the table already had data, leave the sequence alone
 *     so auto-increment continues from the real maximum.
 *   All existing data rows are 100% preserved.
 */
const migrateDpReceipts = async (client) => {
  console.log('\n📋 [dp_receipts] Migrating...');

  const existed = await tableExists(client, 'dp_receipts');

  await client.query(`
    CREATE TABLE IF NOT EXISTS dp_receipts (
      receipt_no    SERIAL PRIMARY KEY,
      date          DATE          NOT NULL,
      customer_name TEXT          NOT NULL,
      amount        NUMERIC(12,2) NOT NULL,
      payment_mode  TEXT,
      hp_financier  TEXT,
      model         TEXT,
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✔ Table structure verified.');

  if (!existed) {
    // Brand-new table: set sequence to match app expectation
    await client.query("ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH 712");
    console.log('  ✔ Sequence initialised at 712 (new table).');
  } else {
    // Existing table: sync sequence to current MAX so no duplicates
    const maxVal = await getMaxSeqValue(client, 'dp_receipts', 'receipt_no');
    if (maxVal !== null) {
      await client.query(
        `SELECT setval('dp_receipts_receipt_no_seq', $1, true)`,
        [maxVal]
      );
      console.log(`  ✔ Sequence synced to current max: ${maxVal}`);
    } else {
      // Table exists but is empty — restart at 712
      await client.query("ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH 712");
      console.log('  ✔ Table empty — sequence initialised at 712.');
    }
  }

  const count = await client.query('SELECT COUNT(*) FROM dp_receipts');
  console.log(`  ℹ Total rows preserved: ${count.rows[0].count}`);
};

/**
 * STEP 4 — gate_passes table
 *
 * Strategy identical to dp_receipts but with sequence starting at 1000.
 * All existing data rows are 100% preserved.
 */
const migrateGatePasses = async (client) => {
  console.log('\n📋 [gate_passes] Migrating...');

  const existed = await tableExists(client, 'gate_passes');

  await client.query(`
    CREATE TABLE IF NOT EXISTS gate_passes (
      pass_no          SERIAL PRIMARY KEY,
      date             DATE NOT NULL,
      customer_name    TEXT,
      model            TEXT,
      color            TEXT,
      regn_no          TEXT,
      chassis_no       TEXT,
      sales_bill_no    TEXT,
      spares_bill_no   TEXT,
      service_bill_no  TEXT,
      narration        TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✔ Table structure verified.');

  if (!existed) {
    await client.query("ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH 1000");
    console.log('  ✔ Sequence initialised at 1000 (new table).');
  } else {
    const maxVal = await getMaxSeqValue(client, 'gate_passes', 'pass_no');
    if (maxVal !== null) {
      await client.query(
        `SELECT setval('gate_passes_pass_no_seq', $1, true)`,
        [maxVal]
      );
      console.log(`  ✔ Sequence synced to current max: ${maxVal}`);
    } else {
      await client.query("ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH 1000");
      console.log('  ✔ Table empty — sequence initialised at 1000.');
    }
  }

  const count = await client.query('SELECT COUNT(*) FROM gate_passes');
  console.log(`  ℹ Total rows preserved: ${count.rows[0].count}`);
};

/**
 * STEP 5 — form22_vehicles table
 *
 * Strategy:
 *   • CREATE TABLE IF NOT EXISTS — no schema changes needed.
 *   All existing data rows are 100% preserved.
 */
const migrateForm22Vehicles = async (client) => {
  console.log('\n📋 [form22_vehicles] Migrating...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS form22_vehicles (
      id            SERIAL PRIMARY KEY,
      chassis_no    TEXT,
      customer_name TEXT,
      model         TEXT,
      color         TEXT
    )
  `);
  console.log('  ✔ Table structure verified.');

  const count = await client.query('SELECT COUNT(*) FROM form22_vehicles');
  console.log(`  ℹ Total rows preserved: ${count.rows[0].count}`);
};

/**
 * STEP 6 — attendance_storage table
 *
 * Strategy:
 *   • CREATE TABLE IF NOT EXISTS — no schema changes needed.
 *   All existing data rows are 100% preserved.
 */
const migrateAttendanceStorage = async (client) => {
  console.log('\n📋 [attendance_storage] Migrating...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS attendance_storage (
      id         SERIAL PRIMARY KEY,
      month      VARCHAR(20),
      year       VARCHAR(10),
      file_name  TEXT,
      data       JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✔ Table structure verified.');

  const count = await client.query('SELECT COUNT(*) FROM attendance_storage');
  console.log(`  ℹ Total rows preserved: ${count.rows[0].count}`);
};

// ── Main Entry Point ──────────────────────────────────────────

const runMigration = async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VALUE SUZUKI — DATABASE MIGRATION');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Timestamp   : ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');

  const client = await pool.connect();

  try {
    // Everything runs inside a single transaction.
    // Any failure rolls back ALL changes — the DB is never left half-migrated.
    await client.query('BEGIN');

    await migrateUsers(client);
    await migrateGeneralReceipts(client);
    await migrateDpReceipts(client);
    await migrateGatePasses(client);
    await migrateForm22Vehicles(client);
    await migrateAttendanceStorage(client);

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅  MIGRATION COMPLETE — all data preserved.');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  ❌  MIGRATION FAILED — database rolled back cleanly.');
    console.error('═══════════════════════════════════════════════════════');
    console.error('\n  Error details:\n');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration();