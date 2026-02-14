import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';

// Strictly use DATABASE_URL from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // LOGIC: SSL is required for production (Railway/Render/Heroku) but disabled for local
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// --- Database Connection & Sync Check ---
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database Connected Successfully');
    
    // Optional: Run a quick query to ensure "Sync" (readiness)
    const res = await client.query('SELECT NOW()');
    console.log(`🕒 Database Sync Verified at: ${res.rows[0].now}`);
    
    client.release();
  } catch (err) {
    console.error('❌ Database Connection Failed:', err.message);
    process.exit(1); // Exit process if DB is critical and fails
  }
};

testConnection();

export { pool };