import dotenv from 'dotenv';
import pg from 'pg';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load the .env file from the server directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is missing. Make sure your .env file is present in the server folder.");
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper to format DD-MM-YYYY or Excel dates to YYYY-MM-DD for PostgreSQL
const formatDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const parts = dateVal.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
    return dateVal;
  }
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0];
  }
  if (typeof dateVal === 'number') {
    const date = new Date((dateVal - (25567 + 1)) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return null;
};

// Helper: Get Financial Year YY
const getFinancialYearYY = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = d.getMonth(); 
  return (month < 3 ? year - 1 : year).toString().slice(-2);
};

const importExcel = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const client = await pool.connect();
  let importedCount = 0;

  try {
    console.log(`📥 Reading Excel file from: ${filePath}`);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false }); 
    
    console.log(`🚀 Found ${rawData.length} rows. Starting Database Import...`);
    await client.query('BEGIN');

    for (const row of rawData) {
      const rawReceiptNo = row['Complete Reciept Number'] || row['Complete Receipt Number'];
      if (!rawReceiptNo) continue;

      const receiptNo = parseInt(rawReceiptNo, 10);
      if (isNaN(receiptNo)) continue;

      const dateStr = formatDate(row['Date']);
      const paymentDateStr = formatDate(row['Dated']);
      const financialYear = getFinancialYearYY(dateStr);

      await client.query(
        `INSERT INTO general_receipts (
          receipt_no, financial_year, date, customer_name, mobile, remarks, file_no, 
          hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (receipt_no) DO UPDATE SET 
          financial_year = EXCLUDED.financial_year,
          date = EXCLUDED.date,
          customer_name = EXCLUDED.customer_name,
          mobile = EXCLUDED.mobile,
          remarks = EXCLUDED.remarks,
          file_no = EXCLUDED.file_no,
          hp_financier = EXCLUDED.hp_financier,
          model = EXCLUDED.model,
          amount = EXCLUDED.amount,
          payment_type = EXCLUDED.payment_type,
          payment_mode = EXCLUDED.payment_mode,
          payment_date = EXCLUDED.payment_date,
          cheque_no = EXCLUDED.cheque_no,
          status = EXCLUDED.status`,
        [
          receiptNo,
          financialYear,
          dateStr,
          row['Customer Name'] || '',
          row['Mobile'] || null,
          row['Remarks'] || null,
          row['File No'] || null,
          row['HP To'] || null,
          row['Model'] || null,
          parseFloat(row['Amount']) || 0,
          row['Type'] || null,
          row['Mode'] || null,
          paymentDateStr,
          row['Cheque No'] || null,
          row['Status'] || 'ACTIVE'
        ]
      );
      
      importedCount++;
    }

    console.log(`🔄 Updating Application Settings sequences...`);
    
    const maxReceiptRes = await client.query("SELECT MAX(receipt_no) as max_no FROM general_receipts");
    const maxReceiptNo = maxReceiptRes.rows[0].max_no;
    
    if (maxReceiptNo) {
      const currentYY = getFinancialYearYY(new Date().toISOString().split('T')[0]);
      const maxSeqStr = String(maxReceiptNo).slice(2);
      const maxSeq = parseInt(maxSeqStr, 10);

      await client.query(`
        INSERT INTO app_settings (key, value) VALUES ('receipt_year', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [currentYY]);

      await client.query(`
        INSERT INTO app_settings (key, value) VALUES ('receipt_seq', $1)
        ON CONFLICT (key) DO UPDATE SET value = 
          CASE WHEN EXCLUDED.value::int > COALESCE(app_settings.value, '0')::int THEN EXCLUDED.value ELSE app_settings.value END
      `, [String(maxSeq)]);
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully imported and synchronized ${importedCount} receipts!`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

// Default to the file inside the exact same 'utils' folder as this script
const defaultFilePath = path.join(__dirname, 'Receipts_Report.xlsx');
const targetFilePath = process.argv[2] || defaultFilePath;

importExcel(targetFilePath);