const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { pool } = require('../db');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 1. Get List of Available Months
router.get('/list-months', async (req, res) => {
  try {
    const result = await pool.query('SELECT month, year FROM attendance_storage ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Specific Month Data
router.get('/get-data', async (req, res) => {
  const { month, year } = req.query;
  try {
    const result = await pool.query(
        'SELECT data, file_name FROM attendance_storage WHERE month = $1 AND year = $2',
        [month, year]
    );
    if (result.rows.length > 0) {
      res.json({ data: result.rows[0].data, fileName: result.rows[0].file_name });
    } else {
      res.status(404).json({ error: 'Data not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Upload & Replace Logic
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  
  // Frontend sends identified month/year in body
  const { month, year } = req.body; 

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true });
    
    // 1. Delete if same month/year exists (Replace logic)
    if (month && year) {
        await client.query('DELETE FROM attendance_storage WHERE month = $1 AND year = $2', [month, year]);
        
        // 2. Insert new data
        await client.query(
            'INSERT INTO attendance_storage (month, year, file_name, data) VALUES ($1, $2, $3, $4)', 
            [month, year, req.file.originalname, JSON.stringify(jsonData)]
        );
    }

    // 3. Cleanup: Delete data older than 1 year
    await client.query("DELETE FROM attendance_storage WHERE created_at < NOW() - INTERVAL '1 year'");

    await client.query('COMMIT');
    res.json({ message: 'Attendance uploaded', data: jsonData });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
