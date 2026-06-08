import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pool } from './config/db.js';

// Import Routes
import authRoutes from './routes/auth.js';
import form22Routes from './routes/form22.js';
import gatepassRoutes from './routes/gatepass.js';
import receiptRoutes from './routes/dp_receipts.js';
import attendanceRoutes from './routes/attendance.js';
import generalReceiptRoutes from './routes/general_receipts.js';
import adminRoutes from './routes/admin.js'; 
import pricelistRoutes from './routes/pricelist.js';
import portalRoutes from './routes/portal.js';
import auditLogRoutes from './routes/audit_log.js';
import qrRoutes from './routes/qr.js';

import { verifyToken, checkRole } from './middleware/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.PORTAL_URL 
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, 
  credentials: true 
}));

app.use(express.json());
app.use(cookieParser());

// Public Routes
app.use('/api/auth', authRoutes);
// Made public as per requirement
app.use('/api/receipts', receiptRoutes); // DP Receipts
app.use('/api/attendance', attendanceRoutes);
app.use('/api/pricelist', pricelistRoutes);

// Protected Routes
app.use('/api/form22', verifyToken, form22Routes);
app.use('/api/gatepass', verifyToken, gatepassRoutes);
app.use('/api/general-receipts', verifyToken, generalReceiptRoutes);

// Audit log: requires auth. Per-receipt history (GET /:receipt_no) and writes
// (POST /) are available to all authenticated users; the full cross-receipt
// log (GET /) is gated to admins INSIDE the router itself.
app.use('/api/audit-log', verifyToken, auditLogRoutes);

// External Portal Read-Only Route
app.use('/api/portal', verifyToken, portalRoutes);

// Admin Routes (Protected + Role Check)
app.use('/api/admin', verifyToken, checkRole('admin'), adminRoutes);

app.use('/api/qr', verifyToken, qrRoutes);

// Health Check
app.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send(`Value One Server Running. Database Status: OK`);
  } catch (err) {
    res.status(500).send(`Server Running but DB Connection Failed`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});