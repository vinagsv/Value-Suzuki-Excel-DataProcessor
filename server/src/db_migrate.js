import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ── Helpers ───────────────────────────────────────────────────

const columnExists = async (client, table, column) => {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return res.rowCount > 0;
};

const tableExists = async (client, table) => {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return res.rowCount > 0;
};

const getMaxSeqValue = async (client, table, column) => {
  const res = await client.query(`SELECT MAX(${column}) AS max_val FROM ${table}`);
  return res.rows[0].max_val;
};

// ── Main Entry Point ──────────────────────────────────────────

const runMigration = async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VALUE SUZUKI — DATABASE MIGRATION CHECK');
  console.log('═══════════════════════════════════════════════════════');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify all core tables exist (Safe creation)
    await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(20) DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE IF NOT EXISTS general_receipts (receipt_no BIGINT PRIMARY KEY, financial_year VARCHAR(10), date DATE NOT NULL, customer_name TEXT NOT NULL, mobile TEXT, gst_no TEXT, file_no TEXT, hp_financier TEXT, model TEXT, amount NUMERIC(12,2) NOT NULL, payment_type TEXT, payment_mode TEXT, payment_date DATE, cheque_no TEXT, status TEXT DEFAULT 'ACTIVE', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    // DP Receipts & Sequences
    const dpExisted = await tableExists(client, 'dp_receipts');
    await client.query(`CREATE TABLE IF NOT EXISTS dp_receipts (receipt_no SERIAL PRIMARY KEY, date DATE NOT NULL, customer_name TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL, payment_mode TEXT, hp_financier TEXT, model TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    if (!dpExisted) {
      await client.query("ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH 712");
    } else {
      const maxDp = await getMaxSeqValue(client, 'dp_receipts', 'receipt_no');
      if (maxDp !== null) await client.query(`SELECT setval('dp_receipts_receipt_no_seq', $1, true)`, [maxDp]);
      else await client.query("ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH 712");
    }

    // Gate Passes & Sequences
    const gpExisted = await tableExists(client, 'gate_passes');
    await client.query(`CREATE TABLE IF NOT EXISTS gate_passes (pass_no SERIAL PRIMARY KEY, date DATE NOT NULL, customer_name TEXT, model TEXT, color TEXT, regn_no TEXT, chassis_no TEXT, sales_bill_no TEXT, spares_bill_no TEXT, service_bill_no TEXT, narration TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    if (!gpExisted) {
      await client.query("ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH 1000");
    } else {
      const maxGp = await getMaxSeqValue(client, 'gate_passes', 'pass_no');
      if (maxGp !== null) await client.query(`SELECT setval('gate_passes_pass_no_seq', $1, true)`, [maxGp]);
      else await client.query("ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH 1000");
    }

    await client.query(`CREATE TABLE IF NOT EXISTS form22_vehicles (id SERIAL PRIMARY KEY, chassis_no TEXT, customer_name TEXT, model TEXT, color TEXT)`);
    await client.query(`CREATE TABLE IF NOT EXISTS attendance_storage (id SERIAL PRIMARY KEY, month VARCHAR(20), year VARCHAR(10), file_name TEXT, data JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(50) PRIMARY KEY, value TEXT)`);
    await client.query(`CREATE TABLE IF NOT EXISTS price_list (id SERIAL PRIMARY KEY, model TEXT, variant TEXT, ex_showroom NUMERIC(12, 2), insurance NUMERIC(12, 2), rto NUMERIC(12, 2), on_road NUMERIC(12, 2))`);

    await client.query('COMMIT');
    console.log('  ✅  MIGRATION VERIFIED — Structure is correct.');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n  ❌  MIGRATION FAILED:\n', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration();