import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const run = async () => {
  const client = await pool.connect();
  console.log('\n══════════════════════════════════════════════');
  console.log('  PRE-DEPLOY SEQUENCE FIX');
  console.log('══════════════════════════════════════════════\n');

  try {
    await client.query('BEGIN');

    // Fix dp_receipts sequence to match actual max
    const dpMax = await client.query('SELECT MAX(receipt_no) as max FROM dp_receipts');
    const dpMaxVal = parseInt(dpMax.rows[0].max, 10);
    await client.query(`SELECT setval('dp_receipts_receipt_no_seq', $1, true)`, [dpMaxVal]);
    console.log(`✅ dp_receipts sequence fixed → next will be ${dpMaxVal + 1}`);

    // Fix gate_passes sequence to match actual max
    const gpMax = await client.query('SELECT MAX(pass_no) as max FROM gate_passes');
    const gpMaxVal = parseInt(gpMax.rows[0].max, 10);
    await client.query(`SELECT setval('gate_passes_pass_no_seq', $1, true)`, [gpMaxVal]);
    console.log(`✅ gate_passes sequence fixed → next will be ${gpMaxVal + 1}`);

    await client.query('COMMIT');

    // Show current app_settings receipt state
    const receiptSeq  = await client.query("SELECT value FROM app_settings WHERE key = 'receipt_seq'");
    const receiptYear = await client.query("SELECT value FROM app_settings WHERE key = 'receipt_year'");
    console.log(`\n📋 General receipts state:`);
    console.log(`   receipt_year = ${receiptYear.rows[0]?.value}`);
    console.log(`   receipt_seq  = ${receiptSeq.rows[0]?.value}`);
    console.log(`   → Next receipt will be: 26${String(parseInt(receiptSeq.rows[0]?.value, 10) + 1).padStart(4, '0')}`);

    console.log('\n══════════════════════════════════════════════');
    console.log('  DONE — Safe to run migrate.js now');
    console.log('══════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

run();