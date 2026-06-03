import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// ── Helper: Financial Year YY ─────────────────────────────────────────────────
const getFinancialYearYY = () => {
    const d     = new Date();
    const year  = d.getFullYear();
    const month = d.getMonth();
    return (month < 3 ? year - 1 : year).toString().slice(-2);
};

// ── Helper: Pull prefix + sequence state from app_settings ───────────────────
const getFileConfig = async () => {
  try {
    const [prefixRes, rYearRes, rSeqRes] = await Promise.all([
      pool.query("SELECT value FROM app_settings WHERE key = 'file_prefix'"),
      pool.query("SELECT value FROM app_settings WHERE key = 'receipt_year'"),
      pool.query("SELECT value FROM app_settings WHERE key = 'receipt_seq'"),
    ]);
    return {
      prefix:      prefixRes.rows[0]?.value || '',
      receiptYear: rYearRes.rows[0]?.value  || '',
      receiptSeq:  parseInt(rSeqRes.rows[0]?.value || '0', 10),
    };
  } catch (err) {
    console.error("Settings fetch error:", err.message);
    return { prefix: '', receiptYear: '', receiptSeq: 0 };
  }
};

// ── 1. Next receipt number & current prefix ───────────────────────────────────
router.get('/next', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(12345)');

    const config    = await getFileConfig();
    const currentYY = getFinancialYearYY();

    let nextReceiptSeq = config.receiptSeq + 1;
    if (config.receiptYear !== currentYY) {
      nextReceiptSeq = 1;
    }

    const paddedReceiptSeq = String(nextReceiptSeq).padStart(4, '0');
    const nextReceiptNo    = parseInt(`${currentYY}${paddedReceiptSeq}`, 10);

    await client.query('COMMIT');
    res.json({ nextReceiptNo, prefix: config.prefix });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── 2. Day summary ────────────────────────────────────────────────────────────
router.get('/day-summary', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Date required" });

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)          FILTER (WHERE payment_type = 'Booking')                                         AS booking_count,
        COUNT(*)          FILTER (WHERE payment_type IN ('Down Payment', 'Balance Payment'))               AS dp_bal_count,
        COUNT(*)          FILTER (WHERE payment_type NOT IN ('Booking', 'Down Payment', 'Balance Payment')) AS other_count,
        COALESCE(SUM(amount), 0)                                                                           AS total_amount,
        COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Cash'),          0)                  AS cash_total,
        COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'UPI'),           0)                  AS upi_total,
        COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Cheque'),        0)                  AS cheque_total,
        COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Bank Transfer'), 0)                  AS bank_total,
        COALESCE(SUM(amount) FILTER (WHERE TRIM(payment_mode) ILIKE 'Card'),          0)                  AS card_total
      FROM general_receipts
      WHERE date = $1
        AND (status IS DISTINCT FROM 'CANCELLED')
    `, [date]);

    const summary   = result.rows[0];
    const sanitized = {};
    for (const key in summary) sanitized[key] = Number(summary[key]) || 0;
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Customer payment history by file number ────────────────────────────────
router.get('/customer-history/:fileNo', async (req, res) => {
  const decodedFileNo = decodeURIComponent(req.params.fileNo);
  try {
    const result = await pool.query(`
      SELECT receipt_no, date, payment_type, amount, payment_mode,
             status, customer_name, mobile, model, hp_financier
      FROM   general_receipts
      WHERE  file_no = $1
        AND  (status IS DISTINCT FROM 'CANCELLED')
      ORDER  BY date DESC
    `, [decodedFileNo]);

    const totalPaid = result.rows.reduce((sum, row) => sum + Number(row.amount), 0);
    res.json({ history: result.rows, totalPaid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. Available months ───────────────────────────────────────────────────────
router.get('/months', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT to_char(date, 'YYYY-MM') AS month_str FROM general_receipts ORDER BY month_str DESC"
    );
    res.json(result.rows.map(r => r.month_str));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. ALL records — no pagination, no limit ──────────────────────────────────
// Used by:
//   • Receipt.jsx  fetchHistory()  — populates the archive table + file-no autocomplete
//   • Receipt.jsx  handleExport()  — exports everything the user asks for
//   • Verify.jsx   fetchAllReceipts() — summary view
//
// Only returns the columns needed (not the full row) to keep the payload lean.
// Ordered by date DESC so newest-first in autocomplete and the archive table.
router.get('/list/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        receipt_no, date, customer_name, mobile, file_no, hp_financier,
        model, amount, payment_type, payment_mode, payment_date,
        cheque_no, remarks, status
      FROM   general_receipts
      ORDER  BY date DESC, receipt_no DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Save (create) a new receipt ───────────────────────────────────────────
// Uses ON CONFLICT DO UPDATE so duplicate receipt numbers (from manual sequence
// resets or a reprint after a failed save) never hard-fail with a 409. This
// matches the behaviour of dp_receipts and gate_passes. The latest data wins.
router.post('/', async (req, res) => {
  let {
    receipt_no, date, customer_name, mobile, remarks, file_no, hp_financier,
    model, amount, payment_type, payment_mode, payment_date, cheque_no, status
  } = req.body;

  if (!status) status = 'ACTIVE';
  if (amount === '' || amount === undefined || amount === null) amount = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO general_receipts
         (receipt_no, date, customer_name, mobile, remarks, file_no, hp_financier,
          model, amount, payment_type, payment_mode, payment_date, cheque_no, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (receipt_no) DO UPDATE SET
         date          = EXCLUDED.date,
         customer_name = EXCLUDED.customer_name,
         mobile        = EXCLUDED.mobile,
         remarks       = EXCLUDED.remarks,
         file_no       = EXCLUDED.file_no,
         hp_financier  = EXCLUDED.hp_financier,
         model         = EXCLUDED.model,
         amount        = EXCLUDED.amount,
         payment_type  = EXCLUDED.payment_type,
         payment_mode  = EXCLUDED.payment_mode,
         payment_date  = EXCLUDED.payment_date,
         cheque_no     = EXCLUDED.cheque_no,
         status        = EXCLUDED.status`,
      [receipt_no, date, customer_name, mobile, remarks, file_no, hp_financier,
       model, amount, payment_type, payment_mode, payment_date, cheque_no, status]
    );

    // Advance sequence tracker
    try {
      const currentYY   = getFinancialYearYY();
      const insertedSeq = parseInt(String(receipt_no).slice(2), 10);

      await client.query(
        `INSERT INTO app_settings (key, value) VALUES ('receipt_year', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [currentYY]
      );
      await client.query(
        `INSERT INTO app_settings (key, value) VALUES ('receipt_seq', $1)
         ON CONFLICT (key) DO UPDATE
           SET value = CASE
             WHEN EXCLUDED.value::int > COALESCE(app_settings.value, '0')::int
             THEN EXCLUDED.value
             ELSE app_settings.value
           END`,
        [String(insertedSeq)]
      );
    } catch (seqErr) {
      console.warn("Sequence update skipped:", seqErr.message);
    }

    // Rolling 7-year cleanup — also purge audit-log rows for the pruned
    // receipts so the audit entries never outlive their parent receipt.
    // DELETE ... RETURNING gives us exactly the receipt numbers removed, so the
    // audit cleanup is scoped precisely and runs in the same transaction.
    const pruned = await client.query(
      "DELETE FROM general_receipts WHERE date < NOW() - INTERVAL '7 years' RETURNING receipt_no"
    );
    if (pruned.rows.length > 0) {
      const prunedNos = pruned.rows.map(r => r.receipt_no);
      await client.query(
        'DELETE FROM receipt_audit_log WHERE receipt_no = ANY($1::bigint[])',
        [prunedNos]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, receiptNo: receipt_no });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── 7. Update an existing receipt ────────────────────────────────────────────
router.put('/:receipt_no', async (req, res) => {
  const { receipt_no } = req.params;
  let {
    date, customer_name, mobile, remarks, file_no, hp_financier,
    model, amount, payment_type, payment_mode, payment_date, cheque_no, status
  } = req.body;

  if (amount === '' || amount === undefined || amount === null) amount = 0;

  try {
    const existing = await pool.query(
      'SELECT status FROM general_receipts WHERE receipt_no = $1',
      [receipt_no]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Receipt not found." });
    }

    if (existing.rows[0].status === 'CANCELLED' && status !== 'CANCELLED') {
      return res.status(409).json({ error: "Cannot reactivate a cancelled receipt." });
    }

    await pool.query(
      `UPDATE general_receipts SET
         date = $1, customer_name = $2, mobile = $3, remarks = $4,
         file_no = $5, hp_financier = $6, model = $7, amount = $8,
         payment_type = $9, payment_mode = $10, payment_date = $11,
         cheque_no = $12, status = $13
       WHERE receipt_no = $14`,
      [date, customer_name, mobile, remarks, file_no, hp_financier,
       model, amount, payment_type, payment_mode, payment_date,
       cheque_no, status, receipt_no]
    );
    res.json({ success: true, message: "Receipt updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8. List / search — paginated ─────────────────────────────────────────────
//
// This endpoint is used by ArchivePage (display + search with page navigation).
//
// Response shapes:
//   ?month=YYYY-MM          → plain array   (all rows for that month, no limit)
//   ?search=term&page=N     → { rows, total, page, pageSize, totalPages }
//   ?page=N  (no filter)    → { rows, total, page, pageSize, totalPages }
//
// Ordering is ALWAYS by date DESC, receipt_no DESC — never by receipt_no alone —
// so records from older financial years (lower receipt numbers) are not buried.
//
router.get('/list', async (req, res) => {
  const { month, search, page = 1 } = req.query;
  const PAGE_SIZE = 100;
  const pageNum   = Math.max(parseInt(page, 10) || 1, 1);
  const offset    = (pageNum - 1) * PAGE_SIZE;

  try {

    // ── Month filter: plain array, no pagination ──────────────────────────
    if (month) {
      const result = await pool.query(
        `SELECT * FROM general_receipts
         WHERE  to_char(date, 'YYYY-MM') = $1
         ORDER  BY date DESC, receipt_no DESC`,
        [month]
      );
      return res.json(result.rows);
    }

    // ── Search: paginated so old FY records are reachable via page nav ────
    if (search) {
      const sanitized   = search.replace(/[%_\\]/g, '\\$&');
      const likePattern = `%${sanitized}%`;

      const whereClause = `
        WHERE file_no              ILIKE $1
           OR CAST(receipt_no AS TEXT) ILIKE $1
           OR customer_name        ILIKE $1
           OR mobile               ILIKE $1`;

      const [dataResult, countResult] = await Promise.all([
        pool.query(
          `SELECT * FROM general_receipts
           ${whereClause}
           ORDER BY date DESC, receipt_no DESC
           LIMIT  ${PAGE_SIZE} OFFSET $2`,
          [likePattern, offset]
        ),
        pool.query(
          `SELECT COUNT(*) FROM general_receipts ${whereClause}`,
          [likePattern]
        ),
      ]);

      const total = parseInt(countResult.rows[0].count, 10);
      return res.json({
        rows:       dataResult.rows,
        total,
        page:       pageNum,
        pageSize:   PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
      });
    }

    // ── No filter: paginated, date-ordered ────────────────────────────────
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM general_receipts
         ORDER BY date DESC, receipt_no DESC
         LIMIT  ${PAGE_SIZE} OFFSET $1`,
        [offset]
      ),
      pool.query('SELECT COUNT(*) FROM general_receipts'),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return res.json({
      rows:       dataResult.rows,
      total,
      page:       pageNum,
      pageSize:   PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;