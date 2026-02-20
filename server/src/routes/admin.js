import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { pool } from '../config/db.js';

const router = express.Router();
// Increase limit for PDF uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper: Get Financial Year YY
const getFinancialYearYY = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    return (month < 3 ? year - 1 : year).toString().slice(-2);
};

// --- USER MANAGEMENT ---
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)', [username, email, hash, role || 'user']);
    res.json({ success: true, message: 'User created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.id == id) return res.status(400).json({ error: "Cannot delete your own admin account" });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SETTINGS MANAGEMENT ---
router.get('/settings', async (req, res) => {
  try {
    //Only fetch editable UI settings. This prevents loading the massive Base64 PDF string 
    // and prevents caching the sequence trackers which causes accidental overwrites.
    const result = await pool.query(
      "SELECT key, value FROM app_settings WHERE key IN ('file_prefix', 'portal_email', 'portal_password')"
    );
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    
    // Set defaults if missing
    if (!settings.file_prefix) settings.file_prefix = '';
    if (!settings.portal_email) settings.portal_email = '';
    if (!settings.portal_password) settings.portal_password = '';
    
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', async (req, res) => {
  const settings = req.body; 
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Explicitly restrict updates to UI keys only
    const allowedKeys = ['file_prefix', 'portal_email', 'portal_password'];
    
    for (const [key, value] of Object.entries(settings)) {
      if (allowedKeys.includes(key)) {
        await client.query(
          'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', 
          [key, String(value)]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// --- SEQUENCE RESET MANAGEMENT ---
router.post('/reset-sequence', async (req, res) => {
    const { type, value } = req.body;
    const val = parseInt(value, 10);
    if (isNaN(val) || val < 1) return res.status(400).json({ error: "Invalid sequence value" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (type === 'dp') {
            await client.query(`ALTER SEQUENCE dp_receipts_receipt_no_seq RESTART WITH ${val}`);
        } else if (type === 'gatepass') {
            await client.query(`ALTER SEQUENCE gate_passes_pass_no_seq RESTART WITH ${val}`);
        } else if (type === 'general') {
            await client.query(`INSERT INTO app_settings (key, value) VALUES ('receipt_seq', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [String(val - 1)]);
            const currentYY = getFinancialYearYY();
            await client.query(`INSERT INTO app_settings (key, value) VALUES ('receipt_year', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [currentYY]);
        } else {
            throw new Error("Unknown sequence type");
        }
        await client.query('COMMIT');
        res.json({ success: true, message: `${type.toUpperCase()} sequence forced to start from ${val}` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

// --- BULK DELETE RECEIPTS ---
router.delete('/receipts/bulk', async (req, res) => {
  const { fromDate, toDate } = req.body;
  if (!fromDate || !toDate) return res.status(400).json({ error: "Date range required" });
  try {
    const result = await pool.query('DELETE FROM general_receipts WHERE date >= $1 AND date <= $2', [fromDate, toDate]);
    res.json({ success: true, message: `Deleted ${result.rowCount} receipts.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PRICE LIST UPLOAD (AS PDF) ---
router.post('/pricelist/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Verify it's a PDF
  if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: "Please upload a valid PDF file." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Convert PDF buffer to Base64 String
    const base64Pdf = req.file.buffer.toString('base64');

    // Store in app_settings table
    await client.query(
        `INSERT INTO app_settings (key, value) VALUES ('price_list_pdf', $1) 
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [base64Pdf]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Price list PDF uploaded perfectly.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

export default router;