require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const resetDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('🗑️  Dropping all tables...');
    await client.query('BEGIN');

    // 1. Drop existing tables
    await client.query(`
      DROP TABLE IF EXISTS receipts CASCADE;
      DROP TABLE IF EXISTS gate_passes CASCADE;
      DROP TABLE IF EXISTS attendance_storage CASCADE;
      DROP TABLE IF EXISTS form22_vehicles CASCADE;
    `);

    console.log('🏗️  Re-creating tables...');

    // 2. Create Form22 Table
    await client.query(`
      CREATE TABLE form22_vehicles (
          id SERIAL PRIMARY KEY,
          chassis_no VARCHAR(255) UNIQUE NOT NULL,
          customer_name VARCHAR(255),
          model VARCHAR(255),
          color VARCHAR(255),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_chassis_suffix ON form22_vehicles(chassis_no);
    `);

    // 3. Create Attendance Table (UPDATED for Month/Year Support)
    await client.query(`
      CREATE TABLE attendance_storage (
          id SERIAL PRIMARY KEY,
          month VARCHAR(50) NOT NULL,
          year VARCHAR(10) NOT NULL,
          file_name VARCHAR(255),
          data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(month, year) 
      );
    `);

    // 4. Create Gate Passes Table
    await client.query(`
      CREATE TABLE gate_passes (
          pass_no SERIAL PRIMARY KEY,
          date DATE DEFAULT CURRENT_DATE,
          customer_name VARCHAR(255),
          model VARCHAR(255),
          color VARCHAR(255),
          regn_no VARCHAR(255),
          chassis_no VARCHAR(255),
          sales_bill_no VARCHAR(255),
          spares_bill_no VARCHAR(255),
          service_bill_no VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH 1001;
    `);

    // 5. Create Receipts Table
    await client.query(`
      CREATE TABLE receipts (
          receipt_no SERIAL PRIMARY KEY,
          date DATE DEFAULT CURRENT_DATE,
          customer_name VARCHAR(255),
          amount NUMERIC(10, 2),
          payment_mode VARCHAR(50),
          hp_financier VARCHAR(255),
          model VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER SEQUENCE receipts_receipt_no_seq RESTART WITH 708;
    `);

    await client.query('COMMIT');
    console.log('✅ Database Reset Complete! New Schema Applied.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Reset Failed:', err);
  } finally {
    client.release();
    pool.end();
  }
};

resetDatabase();
