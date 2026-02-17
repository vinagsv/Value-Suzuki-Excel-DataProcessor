import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool, types } = pg; 

types.setTypeParser(1082, (val) => val); 

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database Connected Successfully');
    const res = await client.query('SELECT NOW()');
    console.log(`🕒 Database Sync Verified at: ${res.rows[0].now}`);
    client.release();
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
    process.exit(1);
  }
};

testConnection();

export { pool };