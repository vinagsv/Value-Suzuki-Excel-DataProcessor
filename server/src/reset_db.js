import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

const fullReset = async () => {
  const client = await pool.connect();
  
  try {
    console.log(`🚨 STARTING TOTAL DATABASE WIPE AND RESET...`);
    await client.query('BEGIN');

    // 1. DROP ALL TABLES (Nuclear Option for a totally fresh start)
    const tables = [
      'users', 
      'general_receipts', 
      'dp_receipts', 
      'gate_passes', 
      'form22_vehicles', 
      'attendance_storage', 
      'app_settings',
      'price_list'
    ];
    
    console.log(`🗑️  Dropping all existing tables...`);
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // 2. RE-CREATE ALL TABLES FROM SCRATCH
    console.log(`🏗️  Rebuilding schema...`);
    
    // Users
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL, 
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // General Receipts 
    await client.query(`
      CREATE TABLE general_receipts (
        receipt_no BIGINT PRIMARY KEY,
        financial_year VARCHAR(10), 
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
        cheque_no TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // DP Receipts
    await client.query(`
      CREATE TABLE dp_receipts (
        receipt_no SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        customer_name TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        payment_mode TEXT,
        hp_financier TEXT,
        model TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query("ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH 712");

    // Gate Passes
    await client.query(`
      CREATE TABLE gate_passes (
        pass_no SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        customer_name TEXT,
        model TEXT,
        color TEXT,
        regn_no TEXT,
        chassis_no TEXT,
        sales_bill_no TEXT,
        spares_bill_no TEXT,
        service_bill_no TEXT,
        narration TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query("ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH 1000");

    // Form 22 Vehicles
    await client.query(`
      CREATE TABLE form22_vehicles (
        id SERIAL PRIMARY KEY,
        chassis_no TEXT,
        customer_name TEXT,
        model TEXT,
        color TEXT
      );
    `);

    // Attendance Storage
    await client.query(`
      CREATE TABLE attendance_storage (
        id SERIAL PRIMARY KEY,
        month VARCHAR(20),
        year VARCHAR(10),
        file_name TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Settings
    await client.query(`
      CREATE TABLE app_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT
      );
    `);

    // Price List
    await client.query(`
      CREATE TABLE price_list (
        id SERIAL PRIMARY KEY,
        model TEXT,
        variant TEXT,
        ex_showroom NUMERIC(12, 2),
        insurance NUMERIC(12, 2),
        rto NUMERIC(12, 2),
        on_road NUMERIC(12, 2)
      );
    `);

    await client.query('COMMIT');
    console.log('✅ DATABASE RESET COMPLETE. Schema is fresh.');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ RESET FAILED:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

fullReset();