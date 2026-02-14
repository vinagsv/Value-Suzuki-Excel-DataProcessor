import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

// Environment check
const isProduction = process.env.NODE_ENV === 'production';

const connectionString = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL 
  : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  // LOGIC: Enable SSL only in production, disable locally to prevent "server does not support SSL" errors
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

const fullReset = async () => {
  const client = await pool.connect();
  
  try {
    console.log(`🚨 STARTING DATABASE RESET (Environment: ${isProduction ? 'Production' : 'Local'})...`);
    console.log('⚠️  All existing data will be lost.');
    
    await client.query('BEGIN');

    // 1. DROP ALL TABLES
    const tables = [
      'users',
      'general_receipts',
      'dp_receipts',
      'gate_passes',
      'form22_vehicles',
      'attendance_storage'
    ];

    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`🗑️  Dropped table: ${table}`);
    }

    // 2. RE-CREATE TABLES
    
    // Users
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created table: users');

    // General Receipts
    await client.query(`
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
    `);
    console.log('✅ Created table: general_receipts');

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
    console.log('✅ Created table: dp_receipts');

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
    console.log('✅ Created table: gate_passes');

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
    console.log('✅ Created table: form22_vehicles');

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
    console.log('✅ Created table: attendance_storage');

    // 3. SEED DATA
    const salt = await bcrypt.genSalt(10);
    
    // Admin
    const adminHash = await bcrypt.hash('admin123', salt);
    await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)", ['admin', adminHash, 'admin']);
    console.log('👤 Created Admin: username="admin" password="admin123"');

    // User
    const userHash = await bcrypt.hash('user123', salt);
    await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)", ['user', userHash, 'user']);
    console.log('👤 Created User: username="user" password="user123"');

    await client.query('COMMIT');
    console.log('\n🎉 RESET COMPLETE! Database is ready.');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ RESET FAILED:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

fullReset();