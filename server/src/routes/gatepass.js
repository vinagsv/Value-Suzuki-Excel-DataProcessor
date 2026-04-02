import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Get Next Pass Number
router.get('/next', async (req, res) => {
  try {
    const seqResult = await pool.query("SELECT last_value, is_called FROM gate_passes_pass_no_seq");
    const { last_value, is_called } = seqResult.rows[0];
    
    // Check is_called to avoid returning +1 when sequence has just been reset
    const nextNo = is_called ? parseInt(last_value) + 1 : parseInt(last_value);
    
    res.json({ nextNo });
  } catch (err) {
    try {
        const result = await pool.query("SELECT last_value + 1 as next_no FROM gate_passes_pass_no_seq");
        res.json({ nextNo: parseInt(result.rows[0].next_no) });
    } catch (fallbackErr) {
        res.status(500).json({ error: fallbackErr.message });
    }
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
  const { passNo, date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Explicitly insert the pass_no provided by the user
    const result = await client.query(
      `INSERT INTO gate_passes 
      (pass_no, date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING pass_no`,
      [passNo, date, customer_name, model, color, regn_no, chassis_no, sales_bill_no, spares_bill_no, service_bill_no, narration]
    );

    // Automatically advance sequence if user manually typed a high number
    await client.query(`SELECT setval('gate_passes_pass_no_seq', GREATEST((SELECT last_value FROM gate_passes_pass_no_seq), $1::bigint), true)`, [passNo]);

    // Auto cleanup data older than 2 years
    await client.query("DELETE FROM gate_passes WHERE date < NOW() - INTERVAL '2 years'");

    await client.query('COMMIT');
    res.json({ success: true, passNo: result.rows[0].pass_no });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update Existing Gate Pass
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

// Delete Gate Pass
router.delete('/:pass_no', async (req, res) => {
  const { pass_no } = req.params;

  try {
    const result = await pool.query(`DELETE FROM gate_passes WHERE pass_no = $1 RETURNING pass_no`, [pass_no]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Gate pass not found" });
    }
    
    res.json({ success: true, message: "Gate pass deleted successfully" });
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

    // Ordered by date DESC first to ensure latest entries stay at top, regardless of pass_no resets
    if (month) {
      query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY date DESC, pass_no DESC";
      params.push(month);
    } else {
      query += " ORDER BY date DESC, pass_no DESC LIMIT 500";
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;