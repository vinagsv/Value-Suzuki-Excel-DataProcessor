import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const seedFromCSV = async () => {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting CSV Data Import...');
    await client.query('BEGIN');

    // --- 1. SEED DP RECEIPTS ---
    const receiptsPath = path.join(__dirname, '../data/receipts.csv');
    if (fs.existsSync(receiptsPath)) {
      console.log('📝 Importing DP Receipts...');
      const parser = fs.createReadStream(receiptsPath).pipe(parse({ columns: true, skip_empty_lines: true }));
      
      for await (const row of parser) {
        // Mapping CSV headers to DB columns
        // Headers: Receipt No, Date, Customer Name, Model, Financier, Amount, Mode
        await client.query(
          `INSERT INTO dp_receipts (receipt_no, date, customer_name, model, hp_financier, amount, payment_mode)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (receipt_no) DO NOTHING`,
          [
            parseInt(row['Receipt No']),
            row['Date'],
            row['Customer Name'],
            row['Model'],
            row['Financier'],
            parseFloat(row['Amount']),
            row['Mode']
          ]
        );
      }
      // Sync sequence so the next entry auto-increments correctly
      await client.query(`SELECT setval('dp_receipts_receipt_no_seq', (SELECT MAX(receipt_no) FROM dp_receipts))`);
      console.log('✅ DP Receipts imported.');
    } else {
      console.log('⚠️ No receipts.csv found in server/data/');
    }

    // --- 2. SEED GATE PASSES ---
    const gatePassPath = path.join(__dirname, '../data/gatepasses.csv');
    if (fs.existsSync(gatePassPath)) {
      console.log('🚧 Importing Gate Passes...');
      const parser = fs.createReadStream(gatePassPath).pipe(parse({ columns: true, skip_empty_lines: true }));
      
      for await (const row of parser) {
        // Mapping CSV headers to DB columns
        // Headers: Pass No, Date, Customer, Model, Chassis No, Regn No, Sales Bill, Spares Bill, Service Bill, Narration
        await client.query(
          `INSERT INTO gate_passes (pass_no, date, customer_name, model, chassis_no, regn_no, sales_bill_no, spares_bill_no, service_bill_no, narration)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (pass_no) DO NOTHING`,
          [
            parseInt(row['Pass No']),
            row['Date'],
            row['Customer'],
            row['Model'],
            row['Chassis No'],
            row['Regn No'],
            row['Sales Bill'],
            row['Spares Bill'],
            row['Service Bill'],
            row['Narration']
          ]
        );
      }
      // Sync sequence so the next entry auto-increments correctly
      await client.query(`SELECT setval('gate_passes_pass_no_seq', (SELECT MAX(pass_no) FROM gate_passes))`);
      console.log('✅ Gate Passes imported.');
    } else {
      console.log('⚠️ No gatepasses.csv found in server/data/');
    }

    await client.query('COMMIT');
    console.log('🏁 All data imported successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

seedFromCSV();