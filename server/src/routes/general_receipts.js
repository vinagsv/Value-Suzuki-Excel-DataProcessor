import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// Helper: Get Financial Year YY (If Jan-Mar, returns Previous Year)
const getFinancialYearYY = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0 = Jan, 1 = Feb, 2 = Mar
    return (month < 3 ? year - 1 : year).toString().slice(-2);
};

// Helper: Get configured prefix and next sequence from DB safely
const getFileConfig = async () => {
  try {
    const prefixRes = await pool.query("SELECT value FROM app_settings WHERE key = 'file_prefix'");
    const rYearRes = await pool.query("SELECT value FROM app_settings WHERE key = 'receipt_year'");
    const rSeqRes = await pool.query("SELECT value FROM app_settings WHERE key = 'receipt_seq'");
    
    const prefix = prefixRes.rows[0]?.value || '';
    const receiptYear = rYearRes.rows[0]?.value || '';
    const receiptSeq = parseInt(rSeqRes.rows[0]?.value || '0', 10);

    return { prefix, receiptYear, receiptSeq };
  } catch (err) {
    console.error("Settings fetch error:", err.message);
    return { prefix: '', receiptYear: '', receiptSeq: 0 };
  }
};

// 1. Get Next Numbers (Receipt No & File Prefix)
router.get('/next', async (req, res) => {
  try {
    const config = await getFileConfig();
    const currentYY = getFinancialYearYY();
    
    // Receipt Number Logic: YYXXXX. Auto resets to 1 if Financial Year changes.
    let nextReceiptSeq = config.receiptSeq + 1;
    if (config.receiptYear !== currentYY) {
        nextReceiptSeq = 1; 
    }

    const paddedReceiptSeq = String(nextReceiptSeq).padStart(4, '0');
    const nextReceiptNo = parseInt(`${currentYY}${paddedReceiptSeq}`, 10);

    res.json({ 
        nextReceiptNo, 
        prefix: config.prefix
    });
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
    const decodedFileNo = decodeURIComponent(fileNo);

    try {
        const result = await pool.query(`
            SELECT receipt_no, date, payment_type, amount, payment_mode, status, customer_name, mobile, model, hp_financier
            FROM general_receipts 
            WHERE file_no = $1 AND (status IS DISTINCT FROM 'CANCELLED')
            ORDER BY date DESC
        `, [decodedFileNo]);

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert Receipt
    await client.query(
      `INSERT INTO general_receipts 
      (receipt_no, date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [receipt_no, date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status]
    );

    try {
      // INCREMENT RECEIPT SEQUENCE (YYXXXX format tracking based on Financial Year)
      const currentYY = getFinancialYearYY();
      const insertedSeqStr = String(receipt_no).slice(2);
      const insertedSeq = parseInt(insertedSeqStr, 10);

      await client.query(`
        INSERT INTO app_settings (key, value) VALUES ('receipt_year', $1)
        ON CONFLICT (key) DO UPDATE SET value = $1
      `, [currentYY]);

      await client.query(`
        INSERT INTO app_settings (key, value) VALUES ('receipt_seq', $1)
        ON CONFLICT (key) DO UPDATE SET value =
            CASE WHEN EXCLUDED.value::int > COALESCE(app_settings.value, '0')::int THEN EXCLUDED.value ELSE app_settings.value END
      `, [String(insertedSeq)]);

    } catch (seqErr) {
      console.warn("Skipping sequence update - table missing or failed.", seqErr.message);
    }

    // Auto cleanup data older than 7 years
    await client.query("DELETE FROM general_receipts WHERE date < NOW() - INTERVAL '7 years'");

    await client.query('COMMIT');
    res.json({ success: true, receiptNo: receipt_no });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
        return res.status(409).json({ error: "Receipt number already exists." });
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

  try {
    await pool.query(
      `UPDATE general_receipts SET 
        date = $1, customer_name = $2, mobile = $3, gst_no = $4, file_no = $5, hp_financier = $6, 
        model = $7, amount = $8, payment_type = $9, payment_mode = $10, payment_date = $11, cheque_no = $12, status = $13
      WHERE receipt_no = $14`,
      [date, customer_name, mobile, gst_no, file_no, hp_financier, model, amount, payment_type, payment_mode, payment_date, cheque_no, status, receipt_no]
    );
    res.json({ success: true, message: "Receipt updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. List History / Search
router.get('/list', async (req, res) => {
  const { month, search } = req.query;
  let query = "SELECT * FROM general_receipts";
  let params = [];

  if (month) {
    query += " WHERE to_char(date, 'YYYY-MM') = $1 ORDER BY receipt_no DESC";
    params.push(month);
  } else if (search) {
     query += ` WHERE 
        file_no ILIKE $1 OR 
        CAST(receipt_no AS TEXT) ILIKE $1 OR 
        customer_name ILIKE $1 OR 
        mobile ILIKE $1 
        ORDER BY receipt_no DESC LIMIT 20`;
     params.push(`%${search}%`);
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