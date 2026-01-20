const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get Next Receipt Number
router.get('/next', async (req, res) => {
  try {
    const max = await pool.query("SELECT MAX(receipt_no) as max_no FROM receipts");
    const nextNo = (max.rows[0].max_no || 707) + 1;
    res.json({ nextNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Receipt + Auto Cleanup
router.post('/', async (req, res) => {
  let { date, customer_name, amount, payment_mode, hp_financier, model } = req.body;
  
  // 🛡️ Fix: Handle empty amount to prevent DB crash
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

// List History
router.get('/list', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM receipts ORDER BY receipt_no DESC LIMIT 500");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
