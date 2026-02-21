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

import { verifyToken, checkRole } from './middleware/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Allow multiple origins for CORS (Main Client + External Portal)
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.PORTAL_URL 
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests) or allowed origins
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

// Protected Routes
app.use('/api/form22', verifyToken, form22Routes);
app.use('/api/gatepass', verifyToken, gatepassRoutes);
app.use('/api/receipts', verifyToken, receiptRoutes);
app.use('/api/attendance', verifyToken, attendanceRoutes);
app.use('/api/general-receipts', verifyToken, generalReceiptRoutes);
app.use('/api/pricelist', verifyToken, pricelistRoutes);

// External Portal Read-Only Route
app.use('/api/portal', verifyToken, portalRoutes);

// Admin Routes (Protected + Role Check)
app.use('/api/admin', verifyToken, checkRole('admin'), adminRoutes);

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