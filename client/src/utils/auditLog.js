const API_URL = import.meta.env.VITE_API_URL;

/**
 * Creation is no longer logged as a stored audit row. The "Receipt created on
 * {date}" entry shown in the UI is synthesized on read from the receipt's own
 * date (see GET /api/audit-log/:receipt_no on the server). Kept as a no-op so
 * existing callers (Receipt.jsx) don't need to change and no CREATED rows are
 * ever written.
 * @param {number|string} receiptNo
 * @param {object} fields - all fields of the new receipt (unused)
 */
export async function logCreated(receiptNo, fields) {
    return; // intentionally does nothing — creation is derived from receipt date
}

/**
 * Write an EDITED audit entry — computes diff automatically.
 * @param {number|string} receiptNo
 * @param {object} before - snapshot of old values
 * @param {object} after  - snapshot of new values
 */
export async function logEdited(receiptNo, before, after) {
    const diff = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of allKeys) {
        const fromVal = before[k] ?? '';
        const toVal   = after[k]  ?? '';
        if (String(fromVal) !== String(toVal)) {
            diff[k] = { from: String(fromVal), to: String(toVal) };
        }
    }
    if (Object.keys(diff).length === 0) return; // nothing changed

    try {
        await fetch(`${API_URL}/audit-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receipt_no: receiptNo,
                action: 'EDITED',
                changed_fields: diff,
            }),
        });
    } catch (e) {
        console.warn('Audit log write failed (EDITED):', e.message);
    }
}

/**
 * Write a CANCELLED audit entry.
 * @param {number|string} receiptNo
 */
export async function logCancelled(receiptNo) {
    try {
        await fetch(`${API_URL}/audit-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receipt_no: receiptNo,
                action: 'CANCELLED',
                changed_fields: {},
            }),
        });
    } catch (e) {
        console.warn('Audit log write failed (CANCELLED):', e.message);
    }
}

/**
 * Fetch QR enabled state from the public (non-admin) settings endpoint.
 * Falls back to true on any error.
 */
export async function fetchQrEnabled() {
    try {
        const res = await fetch(`${API_URL}/admin/settings/public`, { credentials: 'include' });
        if (res.ok) {
            const d = await res.json();
            return d.qr_enabled !== 'false';
        }
    } catch {}
    return true;
}