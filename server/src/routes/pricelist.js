import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Get the PDF price list
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM app_settings WHERE key = 'price_list_pdf'");
    if (result.rows.length > 0) {
      res.json({ pdfBase64: result.rows[0].value });
    } else {
      res.json({ pdfBase64: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;