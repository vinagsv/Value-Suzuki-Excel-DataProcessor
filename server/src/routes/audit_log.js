import express from 'express';
import { pool } from '../config/db.js';
import { checkRole } from '../middleware/auth.js';

const router = express.Router();

// ── IST timestamp helper ─────────────────────────────────────────────────────
const toIST = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(d.getTime() + istOffset);
    return ist.toISOString().replace('T', ' ').substring(0, 19);
};

// ── POST /api/audit-log  — write a log entry ─────────────────────────────────
// Called by the frontend whenever a receipt is edited/cancelled, and by the
// bulk_delete utility for bulk operations.
//
// CREATED is intentionally NOT stored. The "Receipt created on {date}" entry
// shown in the UI is synthesized on read from the receipt's own date (see the
// GET /:receipt_no handler). If a client still sends action=CREATED, we accept
// it as a harmless no-op so an old/cached client never sees a failed save.
router.post('/', async (req, res) => {
    const { receipt_no, action, changed_fields } = req.body;
    const email = req.user?.email || 'unknown';

    // receipt_no may legitimately be 0 (settings sentinel), so check for null/undefined
    if (receipt_no === undefined || receipt_no === null || !action) {
        return res.status(400).json({ error: 'receipt_no and action are required' });
    }

    // CREATED is no longer persisted — accept and skip silently.
    if (action === 'CREATED') {
        return res.json({ success: true, skipped: true });
    }

    const validActions = ['EDITED', 'CANCELLED', 'DELETED', 'BULK_DELETED'];
    if (!validActions.includes(action)) {
        return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
    }

    // Coerce receipt_no to an integer; reject if it isn't numeric
    const receiptNoInt = parseInt(receipt_no, 10);
    if (isNaN(receiptNoInt)) {
        return res.status(400).json({ error: 'receipt_no must be numeric' });
    }

    try {
        await pool.query(
            `INSERT INTO receipt_audit_log (receipt_no, action, changed_by_email, changed_fields)
             VALUES ($1, $2, $3, $4)`,
            [receiptNoInt, action, email, JSON.stringify(changed_fields || {})]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Audit log write error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/audit-log/:receipt_no — history for one receipt ─────────────────
// Available to any authenticated user (used inline in Archive + Verify pages).
//
// A synthetic CREATED entry is prepended, derived from the receipt's own date
// in general_receipts, so the UI still shows "Receipt created on {receipt
// date}" without that row ever being stored. It is only added when the receipt
// actually exists.
router.get('/:receipt_no', async (req, res) => {
    const receiptNoInt = parseInt(req.params.receipt_no, 10);
    if (isNaN(receiptNoInt)) {
        return res.status(400).json({ error: 'receipt_no must be numeric' });
    }
    try {
        const [logResult, receiptResult] = await Promise.all([
            pool.query(
                `SELECT id, receipt_no, action, changed_by_email, changed_fields, changed_at
                 FROM receipt_audit_log
                 WHERE receipt_no = $1
                 ORDER BY changed_at ASC`,
                [receiptNoInt]
            ),
            pool.query(
                `SELECT date FROM general_receipts WHERE receipt_no = $1`,
                [receiptNoInt]
            ),
        ]);

        const rows = logResult.rows.map(r => ({
            ...r,
            changed_at_ist: toIST(r.changed_at),
        }));

        // Synthesize the CREATED entry from the receipt's own date. Only when
        // the receipt exists — a missing receipt yields no CREATED row.
        const receiptDate = receiptResult.rows[0]?.date;
        if (receiptDate) {
            rows.unshift({
                id: `created-${receiptNoInt}`,
                receipt_no: receiptNoInt,
                action: 'CREATED',
                changed_by_email: null,
                changed_fields: {},
                changed_at: receiptDate,
                changed_at_ist: toIST(receiptDate),
            });
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/audit-log — full paginated log (ADMIN ONLY) ─────────────────────
// The full cross-receipt log can expose who changed what across the whole
// system, so it is gated behind the admin role. Per-receipt history above
// remains available to all authenticated users.
//
// CREATED entries are not stored, so the cross-receipt log naturally contains
// only EDITED / CANCELLED / DELETED / BULK_DELETED rows. (The per-receipt view
// is where the synthetic "created on {date}" entry appears.)
router.get('/', checkRole('admin'), async (req, res) => {
    const { limit = 500, from, to, receipt_no } = req.query;

    // Clamp limit to a sane range to avoid accidental huge scans
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 2000);

    let where = [];
    let params = [];
    let idx = 1;

    if (from) {
        where.push(`changed_at >= $${idx++}`);
        params.push(from);
    }
    if (to) {
        where.push(`changed_at <= $${idx++}`);
        params.push(to);
    }
    if (receipt_no) {
        const receiptNoInt = parseInt(receipt_no, 10);
        if (!isNaN(receiptNoInt)) {
            where.push(`receipt_no = $${idx++}`);
            params.push(receiptNoInt);
        }
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(safeLimit);

    try {
        const result = await pool.query(
            `SELECT id, receipt_no, action, changed_by_email, changed_fields, changed_at
             FROM receipt_audit_log
             ${whereClause}
             ORDER BY changed_at DESC
             LIMIT $${idx}`,
            params
        );
        const rows = result.rows.map(r => ({
            ...r,
            changed_at_ist: toIST(r.changed_at),
        }));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;