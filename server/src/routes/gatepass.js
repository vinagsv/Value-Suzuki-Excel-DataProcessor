import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

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

// Get Available Months
router.get('/months', async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') as month_str FROM gate_passes ORDER BY month_str DESC");
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Gate Pass + Auto Cleanup
router.post('/', async (req, res) => {
  const { date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO gate_passes 
      (date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING pass_no`,
      [date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration]
    );

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

// NEW: Update Existing Gate Pass
router.put('/:pass_no', async (req, res) => {
  const { pass_no } = req.params;
  const { date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration } = req.body;

  try {
    await pool.query(
      `UPDATE gate_passes SET 
        date = $1, customer_name = $2, model = $3, color = $4, regn_no = $5, 
        chassis_no = $6, sales_bill_no = $7, spares_bill_no = $8, service_bill_no = $9, narration = $10
      WHERE pass_no = $11`,
      [date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration, pass_no]
    );
    res.json({ success: true, message: "Gate pass updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List History
router.get('/list', async (req, res) => {
  try {
    const { month } = req.query;
    let query = "SELECT * FROM gate_passes";
    let params = [];

    if (month) {
      query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY pass_no DESC";
      params.push(month);
    } else {
      query += " ORDER BY pass_no DESC LIMIT 500";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;