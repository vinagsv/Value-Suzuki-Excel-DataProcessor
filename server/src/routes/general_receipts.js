import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

const getFyPrefix = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  // If Jan-Mar, FY starts in previous year. Else current year.
  const fy = month < 3 ? year - 1 : year; 
  return String(fy).slice(-2);
};

// Format raw file number to VMA format (252253 -> VMA2025/2253)
const formatFileNumber = (raw) => {
    if(!raw) return raw;
    const clean = raw.toString().replace(/[^0-9]/g, '');
    
    // Only format if it matches the pattern: 25xxxx (6 digits)
    if (clean.length === 6) {
        const prefix = clean.substring(0, 2); // e.g. 25
        const suffix = clean.substring(2);    // e.g. 2253
        return `VMA20${prefix}/${suffix}`;
    }
    return raw; // Return original if it doesn't match expected pattern
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

// 2. Day Summary
router.get('/day-summary', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date required" });

    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE payment_type = 'Booking') as booking_count,
                COUNT(*) FILTER (WHERE payment_type IN ('Down Payment', 'Balance Payment')) as dp_bal_count,
                COUNT(*) FILTER (WHERE payment_type NOT IN ('Booking', 'Down Payment', 'Balance Payment')) as other_count,
                
                COALESCE(SUM(amount), 0) as total_amount,
                
                COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Cash'), 0) as cash_total,
                COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'UPI'), 0) as upi_total,
                COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Cheque'), 0) as cheque_total,
                COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Bank Transfer'), 0) as bank_total,
                COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Card'), 0) as card_total

            FROM general_receipts 
            WHERE date = $1 
            AND (status IS DISTINCT FROM 'CANCELLED')
        `, [date]);

        const summary = result.rows[0];
        const sanitized = {};
        for (const key in summary) {
            sanitized[key] = Number(summary[key]) || 0;
        }
        res.json(sanitized);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Customer Payment History 
router.get('/customer-history/:fileNo', async (req, res) => {
    const { fileNo } = req.params;
    try {
        const result = await pool.query(`
            SELECT receipt_no, date, payment_type, amount, payment_mode, status
            FROM general_receipts 
            WHERE file_no = $1 AND (status IS DISTINCT FROM 'CANCELLED')
            ORDER BY date DESC
        `, [fileNo]);

        const totalPaid = result.rows.reduce((sum, row) => sum + Number(row.amount), 0);
        
        res.json({ 
            history: result.rows, 
            totalPaid 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get Available Months
router.get('/months', async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT to_char(date, 'YYYY-MM') as month_str FROM general_receipts ORDER BY month_str DESC");
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Save Receipt
router.post('/', async (req, res) => {
  let { 
    receipt_no, date, customer_name, mobile, gst_no, file_no, hp_financier, 
    model, amount, payment_type, payment_mode, payment_date, cheque_no, status 
  } = req.body;
  
  if (!status) status = 'ACTIVE';

  // Format File Number
  const formattedFileNo = formatFileNumber(file_no);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fy = getFyPrefix(); 

    await client.query(
      `INSERT INTO general_receipts 
      (receipt_no, financial_year, date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [receipt_no, fy, date, customer_name, mobile, gst_no, formattedFileNo, hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status]
    );

    // Auto-Cleanup (Older than 2 years)
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

// 6. Update Receipt
router.put('/:receipt_no', async (req, res) => {
  const { receipt_no } = req.params;
  const { 
    date, customer_name, mobile, gst_no, file_no, hp_financier, 
    model, amount, payment_type, payment_mode, payment_date, cheque_no, status 
  } = req.body;

  // Format File Number
  const formattedFileNo = formatFileNumber(file_no);

  try {
    await pool.query(
      `UPDATE general_receipts SET 
        date = $1, customer_name = $2, mobile = $3, gst_no = $4, file_no = $5, hp_financier = $6, 
        model = $7, amount = $8, payment_type = $9, payment_mode = $10, payment_date = $11, cheque_no = $12, status = $13
      WHERE receipt_no = $14`,
      [date, customer_name, mobile, gst_no, formattedFileNo, hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status, receipt_no]
    );
    res.json({ success: true, message: "Receipt updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. List History
router.get('/list', async (req, res) => {
  const { month, search } = req.query;
  let query = "SELECT * FROM general_receipts";
  let params = [];

  if (month) {
    query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY receipt_no DESC";
    params.push(month);
  } else if (search) {
     if (!isNaN(search) && search.length > 3) {
         query += " WHERE file_no LIKE $1 OR CAST(receipt_no AS TEXT) LIKE $1 ORDER BY receipt_no DESC";
         params.push(`%${search}%`);
     } else {
         query += " WHERE customer_name ILIKE $1 OR mobile LIKE $1 ORDER BY receipt_no DESC";
         params.push(`%${search}%`);
     }
  } else {
    query += " ORDER BY receipt_no DESC LIMIT 500";
  }

  try {
      const result = await pool.query(query, params);
      res.json(result.rows);
  } catch(err) {
      res.status(500).json({ error: err.message });
  }
});

export default router;