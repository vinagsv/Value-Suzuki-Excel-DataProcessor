import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Helper: Get Financial Year Prefix (e.g., 25 for 2025-2026)
const getFyPrefix = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  const fy = month < 3 ? year - 1 : year;
  return String(fy).slice(-2);
};

// 1. Get Next Receipt Number
router.get('/next', async (req, res) => {
  try {
    const prefix = getFyPrefix();
    const result = await pool.query(
      "SELECT MAX(receipt_no) as max_no FROM general_receipts WHERE CAST(receipt_no AS TEXT) LIKE $1",
      [`${prefix}%`]
    );

    let nextNo;
    if (result.rows[0].max_no) {
      nextNo = Number(result.rows[0].max_no) + 1;
    } else {
      nextNo = Number(`${prefix}00001`);
    }

    res.json({ nextNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Available Months
router.get('/months', async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') as month_str FROM general_receipts ORDER BY month_str DESC");
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Save Receipt (Updated with Mobile & GST)
router.post('/', async (req, res) => {
  const { 
    receipt_no, date, customer_name, mobile, gst_no, file_no, hp_financier, 
    model, amount, payment_type, payment_mode, payment_date 
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO general_receipts 
      (receipt_no, date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [receipt_no, date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date]
    );

    await client.query("DELETE FROM general_receipts WHERE date < NOW() - INTERVAL '2 years'");

    await client.query('COMMIT');
    res.json({ success: true, receiptNo: receipt_no });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
        return res.status(409).json({ error: "Receipt number already exists. Please refresh." });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 4. Update Receipt (Updated with Mobile & GST)
router.put('/:receipt_no', async (req, res) => {
  const { receipt_no } = req.params;
  const { 
    date, customer_name, mobile, gst_no, file_no, hp_financier, 
    model, amount, payment_type, payment_mode, payment_date 
  } = req.body;

  try {
    await pool.query(
      `UPDATE general_receipts SET 
        date = $1, customer_name = $2, mobile = $3, gst_no = $4, file_no = $5, hp_financier = $6, 
        model = $7, amount = $8, payment_type = $9, payment_mode = $10, payment_date = $11
      WHERE receipt_no = $12`,
      [date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date, receipt_no]
    );
    res.json({ success: true, message: "Receipt updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. List History
router.get('/list', async (req, res) => {
  try {
    const { month } = req.query;
    let query = "SELECT * FROM general_receipts";
    let params = [];

    if (month) {
      query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY receipt_no DESC";
      params.push(month);
    } else {
      query += " ORDER BY receipt_no DESC LIMIT 500";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;