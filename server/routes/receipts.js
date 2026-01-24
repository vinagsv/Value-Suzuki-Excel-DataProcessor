const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get Next Receipt Number
router.get('/next', async (req, res) => {
  try {
    const max = await pool.query("SELECT MAX(receipt_no) as max_no FROM receipts");
    const nextNo = (max.rows[0].max_no || 712) + 1;
    res.json({ nextNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Available Months (For Export Dropdown)
router.get('/months', async (req, res) => {
  try {
    // Returns list like ['2023-10', '2023-09']
    const result = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') as month_str FROM receipts ORDER BY month_str DESC");
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Receipt + Auto Cleanup
router.post('/', async (req, res) => {
  let { date, customer_name, amount, payment_mode, hp_financier, model } = req.body;
  
  // Handle empty amount to prevent DB crash
  if (amount === '' || amount === undefined || amount === null) {
      amount = 0;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Receipt
    const result = await client.query(
      `INSERT INTO receipts 
      (date, customer_name, amount, payment_mode, hp_financier, model)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING receipt_no`,
      [date, customer_name, amount, payment_mode, hp_financier, model]
    );

    // 2. Auto-Cleanup: Delete older than 45 days
    await client.query("DELETE FROM receipts WHERE date < NOW() - INTERVAL '45 days'");

    await client.query('COMMIT');
    res.json({ success: true, receiptNo: result.rows[0].receipt_no });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Receipt Save Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// List History (with optional month filter)
router.get('/list', async (req, res) => {
  try {
    const { month } = req.query;
    let query = "SELECT * FROM receipts";
    let params = [];

    if (month) {
      // Filter by specific month (Postgres syntax)
      query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY receipt_no DESC";
      params.push(month);
    } else {
      // Default view (Last 500)
      query += " ORDER BY receipt_no DESC LIMIT 500";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;