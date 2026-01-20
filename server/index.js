require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

// Import Routes
const form22Routes = require('./routes/form22');
const gatepassRoutes = require('./routes/gatepass');
const receiptRoutes = require('./routes/receipts');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes Mounting
app.use('/api/form22', form22Routes);
app.use('/api/gatepass', gatepassRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health Check & DB Connection Test
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`Server Running. DB Connected at: ${result.rows[0].now}`);
  } catch (err) {
    res.status(500).send(`Server Running but DB Failed: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  
  // Log DB Connection Status on Startup
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database Connection Failed:', err.message);
    } else {
      console.log('✅ Database Connected Successfully');
    }
  });
});