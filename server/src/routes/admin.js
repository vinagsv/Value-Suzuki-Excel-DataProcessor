import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import xlsx from 'xlsx';
import { pool } from '../config/db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: Get Financial Year YY
const getFinancialYearYY = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0 = Jan, 1 = Feb, 2 = Mar
    return (month < 3 ? year - 1 : year).toString().slice(-2);
};

// --- USER MANAGEMENT ---

// Get All Users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create User
router.post('/users', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [username, email, hash, role || 'user']
    );
    res.json({ success: true, message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.id == id) return res.status(400).json({ error: "Cannot delete your own admin account" });

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SETTINGS MANAGEMENT ---

// Get All Settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM app_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    // Ensure defaults if missing
    if (!settings.file_prefix) settings.file_prefix = '';
    
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Settings
router.put('/settings', async (req, res) => {
  const settings = req.body; 
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, String(value)]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- SEQUENCE RESET MANAGEMENT ---
router.post('/reset-sequence', async (req, res) => {
    const { type, value } = req.body;
    const val = parseInt(value, 10);
    
    if (isNaN(val) || val < 1) {
        return res.status(400).json({ error: "Invalid sequence value. Must be a number >= 1" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (type === 'dp') {
            await client.query(`ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH ${val}`);
        } else if (type === 'gatepass') {
            await client.query(`ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH ${val}`);
        } else if (type === 'general') {
            // Because our General Receipts use YYXXXX, we reset the seq tracker.
            // We set it to val - 1 so the next requested number is exactly val.
            await client.query(
                `INSERT INTO app_settings (key, value) VALUES ('receipt_seq', $1) 
                 ON CONFLICT (key) DO UPDATE SET value = $1`,
                [String(val - 1)]
            );
            // Lock it to the current financial year
            const currentYY = getFinancialYearYY();
            await client.query(
                `INSERT INTO app_settings (key, value) VALUES ('receipt_year', $1) 
                 ON CONFLICT (key) DO UPDATE SET value = $1`,
                [currentYY]
            );
        } else {
            throw new Error("Unknown sequence type");
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `${type.toUpperCase()} sequence reset to ${val}` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// --- BULK DELETE RECEIPTS ---
router.delete('/receipts/bulk', async (req, res) => {
  const { fromDate, toDate } = req.body;
  if (!fromDate || !toDate) return res.status(400).json({ error: "Date range required" });

  try {
    const result = await pool.query(
      'DELETE FROM general_receipts WHERE date >= $1 AND date <= $2',
      [fromDate, toDate]
    );
    res.json({ success: true, message: `Deleted ${result.rowCount} receipts.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRICE LIST UPLOAD ---
router.post('/pricelist/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Wipe Old Data
    await client.query('TRUNCATE TABLE price_list RESTART IDENTITY');

    // 2. Parse Excel
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 3. Insert New Data
    for (const row of data) {
        const model = row['Model'] || row['model'] || '';
        const variant = row['Variant'] || row['variant'] || '';
        const exShowroom = row['Ex-Showroom'] || row['Price'] || 0;
        const insurance = row['Insurance'] || 0;
        const rto = row['RTO'] || 0;
        const onRoad = row['On Road'] || row['Total'] || 0;

        if (model) {
            await client.query(
                `INSERT INTO price_list (model, variant, ex_showroom, insurance, rto, on_road) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [model, variant, exShowroom, insurance, rto, onRoad]
            );
        }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Price list updated with ${data.length} rows.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;