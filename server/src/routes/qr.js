// ============================================================
// FILE: server/src/routes/qr.js   (NEW FILE)
//
// Server-side QR signing + verification. The HMAC secret and AES key now
// live ONLY on the server (non-VITE env vars) so they are never shipped in
// the client bundle. Previously VITE_QR_SECRET / VITE_QR_AES_KEY were inlined
// into the frontend JS, meaning anyone could read them and forge a QR that
// passed the "HMAC signature valid" check. Moving this server-side makes the
// integrity check actually meaningful.
//
// Byte layout produced/consumed:  iv(12) | ciphertext | gcmTag(16)
// This matches WebCrypto's AES-GCM output (which appends the 16-byte auth tag
// to the ciphertext), so QRs remain compatible with anything that decodes
// standard AES-GCM and with QRs printed before this migration — PROVIDED the
// QR_SECRET / QR_AES_KEY values are set to the same strings the client used.
//
// Register in index.js:
//   import qrRoutes from './routes/qr.js';
//   app.use('/api/qr', verifyToken, qrRoutes);
//
// Required env vars (server .env, NO VITE_ prefix):
//   QR_SECRET    — same value as the old VITE_QR_SECRET
//   QR_AES_KEY   — same value as the old VITE_QR_AES_KEY
// ============================================================

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const QR_SECRET  = process.env.QR_SECRET  || '';
const QR_AES_KEY = process.env.QR_AES_KEY || '';

if (!QR_SECRET || !QR_AES_KEY) {
  console.warn('⚠️  QR_SECRET / QR_AES_KEY not set — QR signing/verification will fail.');
}

// AES-256 needs a 32-byte key. Match the client's old padding/truncation so
// existing QRs verify: pad with '0' then slice to 32 bytes.
const keyBuf = () => Buffer.from(QR_AES_KEY.padEnd(32, '0').slice(0, 32), 'utf8');

// Normalize amount so "50000.00" (DB) and "50000" (form) hash identically.
const normalizeAmount = (amount) => {
  const n = parseFloat(amount);
  return isNaN(n) ? String(amount) : String(n);
};

const hmacFull = (msg) => crypto.createHmac('sha256', QR_SECRET).update(msg, 'utf8').digest();
const hmacTag  = (msg) => hmacFull(msg).toString('hex').slice(0, 16);

// Deterministic IV derived from the payload — same receipt always yields the
// same QR, so the QR on a printed receipt matches the RUID shown in Archives.
const deterministicIV = (plaintext) => hmacFull('IV:' + plaintext).subarray(0, 12);

const toBase64Url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const buildSignedPlain = (receiptNo, date, amount, fileNo) => {
  const base = `VMA|${receiptNo}|${date}|${normalizeAmount(amount)}|${fileNo || ''}`;
  return `${base}|${hmacTag(base)}`;
};

// ── POST /api/qr/sign ────────────────────────────────────────────────────────
// Body: { receiptNo, date, amount, fileNo }
// Returns: { qrString }  (e.g. "VMA:base64url...")
router.post('/sign', (req, res) => {
  if (!QR_SECRET || !QR_AES_KEY) {
    return res.status(500).json({ error: 'QR signing not configured on server.' });
  }

  const { receiptNo, date, amount, fileNo } = req.body || {};
  if (!receiptNo || !date || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'receiptNo, date and amount are required' });
  }

  try {
    const signed = buildSignedPlain(receiptNo, date, amount, fileNo);
    const iv     = deterministicIV(signed);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf(), iv);
    const enc    = Buffer.concat([cipher.update(signed, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag(); // 16 bytes

    // iv | ciphertext | tag  — mirrors WebCrypto's appended-tag layout
    const combined = Buffer.concat([iv, enc, tag]);
    res.json({ qrString: 'VMA:' + toBase64Url(combined) });
  } catch (e) {
    console.error('QR sign error:', e.message);
    res.status(500).json({ error: 'QR sign failed' });
  }
});

// ── POST /api/qr/verify ──────────────────────────────────────────────────────
// Body: { qrText }
// Returns: { ok:true, receiptNo, date, amount, fileNo } | { ok:false, error }
router.post('/verify', (req, res) => {
  if (!QR_SECRET || !QR_AES_KEY) {
    return res.status(500).json({ ok: false, error: 'QR verification not configured on server.' });
  }

  const text = (req.body?.qrText || '').trim();
  if (!text.startsWith('VMA:')) {
    return res.json({ ok: false, error: 'Not a VMA receipt QR code.' });
  }

  try {
    const combined = fromBase64Url(text.slice(4));
    // Need at least iv(12) + tag(16) + 1 byte of ciphertext
    if (combined.length < 12 + 16 + 1) {
      return res.json({ ok: false, error: 'QR data too short.' });
    }

    const iv         = combined.subarray(0, 12);
    const tag        = combined.subarray(combined.length - 16);
    const cipherData = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf(), iv);
    decipher.setAuthTag(tag);

    let plain;
    try {
      plain = Buffer.concat([decipher.update(cipherData), decipher.final()]).toString('utf8');
    } catch {
      return res.json({ ok: false, error: 'Decryption failed — receipt may be from a different system or tampered.' });
    }

    const parts = plain.split('|');
    if (parts.length !== 6 || parts[0] !== 'VMA') {
      return res.json({ ok: false, error: 'Invalid QR structure.' });
    }

    const [, receiptNo, date, amount, fileNo, sigTag] = parts;
    const base        = `VMA|${receiptNo}|${date}|${normalizeAmount(amount)}|${fileNo}`;
    const expectedTag = hmacTag(base);

    // Constant-time compare to avoid timing leaks on the tag check.
    const a = Buffer.from(sigTag);
    const b = Buffer.from(expectedTag);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.json({ ok: false, error: 'HMAC mismatch — receipt may be forged.' });
    }

    res.json({ ok: true, receiptNo, date, amount: normalizeAmount(amount), fileNo });
  } catch (e) {
    res.json({ ok: false, error: 'Unexpected error: ' + e.message });
  }
});

export default router;