import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Get Next DP Receipt Number
router.get('/next', async (req, res) => {
  try {
    const seqResult = await pool.query("SELECT last_value, is_called FROM dp_receipts_receipt_no_seq");
    const { last_value, is_called } = seqResult.rows[0];
    const nextNo = is_called ? parseInt(last_value) + 1 : parseInt(last_value);
    res.json({ nextNo });
  } catch (err) {
    try {
      const result = await pool.query("SELECT last_value + 1 as next_no FROM dp_receipts_receipt_no_seq");
      res.json({ nextNo: parseInt(result.rows[0].next_no) });
    } catch (fallbackErr) {
      res.status(500).json({ error: fallbackErr.message });
    }
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
// Uses ON CONFLICT DO UPDATE so that duplicate receipt numbers (from manual sequence
// resets) never cause a database error. The latest data always wins.
router.post('/', async (req, res) => {
  let { receiptNo, date, customer_name, amount, payment_mode, hp_financier, model } = req.body;
  if (amount === '' || amount === undefined || amount === null) amount = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO dp_receipts 
        (receipt_no, date, customer_name, amount, payment_mode, hp_financier, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (receipt_no) DO UPDATE SET
         date          = EXCLUDED.date,
         customer_name = EXCLUDED.customer_name,
         amount        = EXCLUDED.amount,
         payment_mode  = EXCLUDED.payment_mode,
         hp_financier  = EXCLUDED.hp_financier,
         model         = EXCLUDED.model
       RETURNING receipt_no`,
      [receiptNo, date, customer_name, amount, payment_mode, hp_financier, model]
    );

    // Advance sequence if user manually typed a number higher than current seq
    await client.query(
      `SELECT setval('dp_receipts_receipt_no_seq', GREATEST((SELECT last_value FROM dp_receipts_receipt_no_seq), $1::bigint), true)`,
      [receiptNo]
    );

    // Auto cleanup data older than 2 years
    await client.query("DELETE FROM dp_receipts WHERE date < NOW() - INTERVAL '2 years'");

    await client.query('COMMIT');
    res.json({ success: true, receiptNo: result.rows[0].receipt_no });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update Existing DP Receipt
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

// Delete DP Receipt
router.delete('/:receipt_no', async (req, res) => {
  const { receipt_no } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM dp_receipts WHERE receipt_no = $1 RETURNING receipt_no`,
      [receipt_no]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    res.json({ success: true, message: "Receipt deleted successfully" });
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
      query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY date DESC, receipt_no DESC";
      params.push(month);
    } else {
      query += " ORDER BY date DESC, receipt_no DESC";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;