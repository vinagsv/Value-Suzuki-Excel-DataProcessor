import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Get Next DP Receipt Number
router.get('/next', async (req, res) => {
  try {
    const max = await pool.query("SELECT MAX(receipt_no) as max_no FROM dp_receipts");
    const nextNo = (max.rows[0].max_no || 712) + 1;
    res.json({ nextNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Available Months
router.get('/months', async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') as month_str FROM dp_receipts ORDER BY month_str DESC");
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save DP Receipt
router.post('/', async (req, res) => {
  let { date, customer_name, amount, payment_mode, hp_financier, model } = req.body;
  if (amount === '' || amount === undefined || amount === null) amount = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO dp_receipts 
      (date, customer_name, amount, payment_mode, hp_financier, model)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING receipt_no`,
      [date, customer_name, amount, payment_mode, hp_financier, model]
    );
    await client.query("DELETE FROM dp_receipts WHERE date < NOW() - INTERVAL '45 days'");
    await client.query('COMMIT');
    res.json({ success: true, receiptNo: result.rows[0].receipt_no });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// NEW: Update Existing DP Receipt
router.put('/:receipt_no', async (req, res) => {
  const { receipt_no } = req.params;
  const { date, customer_name, amount, payment_mode, hp_financier, model } = req.body;

  try {
    await pool.query(
      `UPDATE dp_receipts SET 
        date = $1, customer_name = $2, amount = $3, payment_mode = $4, hp_financier = $5, model = $6
      WHERE receipt_no = $7`,
      [date, customer_name, amount, payment_mode, hp_financier, model, receipt_no]
    );
    res.json({ success: true, message: "Receipt updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List History
router.get('/list', async (req, res) => {
  try {
    const { month } = req.query;
    let query = "SELECT * FROM dp_receipts";
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