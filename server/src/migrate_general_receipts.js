import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Force SSL false to fix "server does not support SSL" error locally
const pool = new Pool({
  connectionString: process.env.DATABASE_URL 
    ? process.env.DATABASE_URL 
    : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false 
});

const runMigration = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Migration...');
    
    await client.query('BEGIN');

    // 1. Drop table if it exists (to ensure clean slate given your errors)
    await client.query('DROP TABLE IF EXISTS general_receipts');
    console.log('🗑️  Dropped old table (if any).');

    // 2. Create the table fresh
    const createTableQuery = `
      CREATE TABLE general_receipts (
        receipt_no BIGINT PRIMARY KEY,
        date DATE NOT NULL,
        customer_name TEXT NOT NULL,
        mobile TEXT,
        gst_no TEXT,
        file_no TEXT,
        hp_financier TEXT,
        model TEXT,
        amount NUMERIC(12, 2) NOT NULL,
        payment_type TEXT,
        payment_mode TEXT,
        payment_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log('✅ Table "general_receipts" created successfully.');

    await client.query('COMMIT');
    console.log('🎉 Migration SUCCESS! You can now restart your server.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration FAILED:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration();