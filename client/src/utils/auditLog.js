const API_URL = import.meta.env.VITE_API_URL;

/**
 * Write a CREATED audit entry.
 * @param {number|string} receiptNo
 * @param {object} fields - all fields of the new receipt
 */
export async function logCreated(receiptNo, fields) {
    try {
        await fetch(`${API_URL}/audit-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receipt_no: receiptNo,
                action: 'CREATED',
                changed_fields: fields,
            }),
        });
    } catch (e) {
        console.warn('Audit log write failed (CREATED):', e.message);
    }
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