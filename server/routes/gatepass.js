const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get Next Pass Number
router.get('/next', async (req, res) => {
  try {
    const max = await pool.query("SELECT MAX(pass_no) as max_no FROM gate_passes");
    const nextNo = (max.rows[0].max_no || 1000) + 1;
    res.json({ nextNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Available Months (For Export Dropdown)
router.get('/months', async (req, res) => {
  try {
    // Returns list like ['2023-10', '2023-09']
    const result = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') as month_str FROM gate_passes ORDER BY month_str DESC");
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Gate Pass + Auto Cleanup
router.post('/', async (req, res) => {
  // Added narration to destructuring
  const { date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert New Pass (Added narration column)
    const result = await client.query(
      `INSERT INTO gate_passes 
      (date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING pass_no`,
      [date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration]
    );

    // 2. Auto-Cleanup: Delete older than 45 days
    await client.query("DELETE FROM gate_passes WHERE date < NOW() - INTERVAL '45 days'");

    await client.query('COMMIT');
    res.json({ success: true, passNo: result.rows[0].pass_no });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// List History
// If ?month=YYYY-MM is provided, returns ALL data for that month.
// Otherwise, returns last 500 records.
router.get('/list', async (req, res) => {
  try {
    const { month } = req.query;
    let query = "SELECT * FROM gate_passes";
    let params = [];

    if (month) {
      // Filter by specific month (Postgres syntax)
      query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY pass_no DESC";
      params.push(month);
    } else {
      // Default view
      query += " ORDER BY pass_no DESC LIMIT 500";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;