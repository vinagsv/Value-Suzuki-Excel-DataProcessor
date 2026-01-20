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

// Save Gate Pass + Auto Cleanup
router.post('/', async (req, res) => {
  const { date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert New Pass
    const result = await client.query(
      `INSERT INTO gate_passes 
      (date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING pass_no`,
      [date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no]
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

// List History (Last 500 records only to keep UI fast)
router.get('/list', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM gate_passes ORDER BY pass_no DESC LIMIT 500");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
