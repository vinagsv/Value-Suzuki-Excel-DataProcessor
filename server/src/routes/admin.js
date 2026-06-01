import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { pool } from '../config/db.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const getFinancialYearYY = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  return (month < 3 ? year - 1 : year).toString().slice(-2);
};

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [username, email, hash, role || 'user']
    );
    res.json({ success: true, message: 'User created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.id == id) return res.status(400).json({ error: "Cannot delete your own admin account" });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SETTINGS MANAGEMENT ───────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM app_settings WHERE key IN ('file_prefix', 'portal_email', 'portal_password', 'qr_enabled')"
    );
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });

    if (settings.file_prefix    === undefined) settings.file_prefix    = '';
    if (settings.portal_email   === undefined) settings.portal_email   = '';
    if (settings.portal_password=== undefined) settings.portal_password= '';
    if (settings.qr_enabled     === undefined) settings.qr_enabled     = 'true';

    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public endpoint — only exposes qr_enabled, no auth required beyond verifyToken
router.get('/settings/public', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM app_settings WHERE key = 'qr_enabled'");
    const qr_enabled = result.rows[0]?.value ?? 'true';
    res.json({ qr_enabled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', async (req, res) => {
  const settings = req.body;
  const changedBy = req.user?.email || 'unknown';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const allowedKeys = ['file_prefix', 'portal_email', 'portal_password', 'qr_enabled'];

    // ── Validation: file_prefix must not be blank ─────────────────────────────
    if ('file_prefix' in settings && String(settings.file_prefix ?? '').trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: "File prefix cannot be blank. Enter a valid prefix (e.g. VMA2026/) or keep the current value."
      });
    }

    // ── Fetch current values for audit log ────────────────────────────────────
    const currentRes = await client.query(
      "SELECT key, value FROM app_settings WHERE key IN ('file_prefix', 'portal_email', 'portal_password', 'qr_enabled')"
    );
    const currentValues = {};
    currentRes.rows.forEach(r => { currentValues[r.key] = r.value; });

    // ── Write each allowed key and collect changes for audit ─────────────────
    const changes = {};
    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;

      const newVal = String(value ?? '');
      const oldVal = currentValues[key] ?? '';

      if (newVal !== oldVal) {
        // Redact sensitive values from the audit log
        const redact = (k, v) => (k === 'portal_password' ? '[REDACTED]' : v);
        changes[key] = { from: redact(key, oldVal), to: redact(key, newVal) };
      }

      await client.query(
        'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, newVal]
      );
    }

    // ── Write audit log entry if anything changed ─────────────────────────────
    if (Object.keys(changes).length > 0) {
      console.log(`[SETTINGS AUDIT] ${changedBy} changed settings:`, JSON.stringify(changes));

      // Also write to receipt_audit_log table reusing it for settings changes
      // receipt_no = 0 is used as a sentinel for non-receipt audit entries
      try {
        await client.query(
          `INSERT INTO receipt_audit_log (receipt_no, action, changed_by_email, changed_fields)
           VALUES (0, 'SETTINGS_CHANGED', $1, $2)`,
          [changedBy, JSON.stringify(changes)]
        );
      } catch (auditErr) {
        // Audit log write failure is non-fatal — settings still save
        console.warn('[SETTINGS AUDIT] Could not write to audit log:', auditErr.message);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── SEQUENCE RESET MANAGEMENT ─────────────────────────────────────────────────

router.get('/sequences', async (req, res) => {
  try {
    let dp = 0, gatepass = 0, general = 0;

    try {
      const dpRes = await pool.query("SELECT last_value, is_called FROM dp_receipts_receipt_no_seq");
      if (dpRes.rows.length > 0) {
        const { last_value, is_called } = dpRes.rows[0];
        dp = is_called ? parseInt(last_value, 10) + 1 : parseInt(last_value, 10);
      }
    } catch (e) { console.error("DP seq error", e.message); }

    try {
      const gpRes = await pool.query("SELECT last_value, is_called FROM gate_passes_pass_no_seq");
      if (gpRes.rows.length > 0) {
        const { last_value, is_called } = gpRes.rows[0];
        gatepass = is_called ? parseInt(last_value, 10) + 1 : parseInt(last_value, 10);
      }
    } catch (e) { console.error("GP seq error", e.message); }

    try {
      const genRes = await pool.query("SELECT value FROM app_settings WHERE key = 'receipt_seq'");
      general = parseInt(genRes.rows[0]?.value || 0, 10) + 1;
    } catch (e) { console.error("Gen seq error", e.message); }

    res.json({ dp, gatepass, general });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reset-sequence', async (req, res) => {
  const { type, value } = req.body;
  const val = parseInt(value, 10);
  if (isNaN(val) || val < 1) return res.status(400).json({ error: "Invalid sequence value" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'dp') {
      // Guard: warn if setting below actual max — but allow it since user wants resets
      await client.query(`SELECT setval('dp_receipts_receipt_no_seq', $1::bigint, false)`, [val]);
    } else if (type === 'gatepass') {
      await client.query(`SELECT setval('gate_passes_pass_no_seq', $1::bigint, false)`, [val]);
    } else if (type === 'general') {
      // Guard: do not allow setting below actual max receipt_no to prevent 409 errors
      const maxRes = await client.query("SELECT MAX(receipt_no) as max FROM general_receipts");
      const currentMax = parseInt(maxRes.rows[0]?.max || 0, 10);
      const currentYY = getFinancialYearYY();
      // Construct what the number would look like: YY + padded seq
      const proposedReceiptNo = parseInt(`${currentYY}${String(val).padStart(4, '0')}`, 10);

      if (proposedReceiptNo <= currentMax) {
        await client.query('ROLLBACK');
        const currentSeqStr = String(currentMax).slice(2);
        return res.status(400).json({
          error: `Cannot set receipt sequence to ${val} — it would generate receipt #${proposedReceiptNo} which already exists. Current max is #${currentMax} (seq ${currentSeqStr}). Set a value higher than ${parseInt(currentSeqStr, 10)}.`
        });
      }

      await client.query(
        `INSERT INTO app_settings (key, value) VALUES ('receipt_seq', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [String(val - 1)]
      );
      await client.query(
        `INSERT INTO app_settings (key, value) VALUES ('receipt_year', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [currentYY]
      );
    } else {
      throw new Error("Unknown sequence type");
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `${type.toUpperCase()} sequence forced to start from ${val}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── PRICE LIST UPLOAD ─────────────────────────────────────────────────────────

router.post('/pricelist/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: "Please upload a valid PDF file." });
  }

  const base64Pdf = req.file.buffer.toString('base64');
  if (base64Pdf.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: "PDF too large. Please compress it below 7MB." });
  }

  try {
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('price_list_pdf', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [base64Pdf]
    );
    res.json({ success: true, message: 'Price list PDF uploaded successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;