import QRCode from 'qrcode';

const API_URL = import.meta.env.VITE_API_URL;

// ── PUBLIC: raw signed string = what the QR encodes = RUID ───────────────────
// Deterministic on the server: the same receipt always produces the same string.
export async function buildEncryptedQrString(receiptNo, date, amount, fileNo) {
  if (!receiptNo || !date || amount === undefined || amount === null) return null;
  try {
    const res = await fetch(`${API_URL}/qr/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ receiptNo, date, amount, fileNo: fileNo || '' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.qrString || null;
  } catch (e) {
    console.error('QR sign request failed:', e.message);
    return null;
  }
}

// ── PUBLIC: signed QR as a PNG data URL (scannable by any phone) ─────────────
export async function buildEncryptedQrDataUrl(receiptNo, date, amount, fileNo) {
  const payload = await buildEncryptedQrString(receiptNo, date, amount, fileNo);
  if (!payload) return null;
  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 120,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (e) {
    console.error('QR render error', e);
    return null;
  }
}

// ── PUBLIC: decrypt and verify a scanned QR string (server-side) ─────────────
export async function decryptAndVerifyQr(qrText) {
  const text = (qrText || '').trim();
  if (!text.startsWith('VMA:')) {
    return { ok: false, error: 'Not a VMA receipt QR code.' };
  }
  try {
    const res = await fetch(`${API_URL}/qr/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ qrText: text }),
    });
    if (!res.ok) {
      return { ok: false, error: 'Verification request failed.' };
    }
    return await res.json();
  } catch (e) {
    return { ok: false, error: 'Network error: ' + e.message };
  }
}