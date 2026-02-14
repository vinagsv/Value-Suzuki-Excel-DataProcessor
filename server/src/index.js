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

// Middleware Import
import { verifyToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

/**
 * --- MIDDLEWARE CONFIGURATION ---
 */
app.use(cors({
  // Ensure this matches your Vite frontend URL
  origin: process.env.CLIENT_URL || 'http://localhost:5173', 
  credentials: true // Crucial for HttpOnly Cookies to work
}));

app.use(express.json());
app.use(cookieParser()); // Parses cookies so they are available in req.cookies

// Public Routes
app.use('/api/auth', authRoutes);

// Protected Routes
app.use('/api/form22', verifyToken, form22Routes);
app.use('/api/gatepass', verifyToken, gatepassRoutes);
app.use('/api/receipts', verifyToken, receiptRoutes);
app.use('/api/attendance', verifyToken, attendanceRoutes);
app.use('/api/general-receipts', verifyToken, generalReceiptRoutes);

// Health Check (Updated to remove sensitive DB info)
app.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send(`Value Suzuki Server Running. Database Status: OK`);
  } catch (err) {
    res.status(500).send(`Server Running but DB Connection Failed`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});