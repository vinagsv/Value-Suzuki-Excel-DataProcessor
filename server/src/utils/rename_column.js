import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

const renameColumn = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting column rename migration...');
    await client.query('BEGIN');
    
    await client.query('ALTER TABLE general_receipts RENAME COLUMN gst_no TO remarks;');
    
    await client.query('COMMIT');
    console.log('✅ Success! Column renamed from "gst_no" to "remarks".');
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    // Postgres error 42703 means the column doesn't exist
    if (err.code === '42703') {
        console.log('⚠️ The column "gst_no" does not exist. It may have already been renamed to "remarks".');
    } else {
        console.error('❌ Migration failed:', err.message);
    }
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
};

renameColumn();