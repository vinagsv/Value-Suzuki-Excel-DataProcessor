import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { pool } from '../config/db.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
});

// Helper to find column name regardless of casing/spacing
const findKey = (row, candidates) => {
  const rowKeys = Object.keys(row);
  for (const candidate of candidates) {
    if (row[candidate] !== undefined) return candidate;
    const found = rowKeys.find(key => 
      key.toLowerCase().replace(/[^a-z0-9]/g, '') === candidate.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (found) return found;
  }
  return null;
};

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Clear old data
    await client.query('TRUNCATE TABLE form22_vehicles RESTART IDENTITY');
    
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // 2. Prepare Batch Data
    const vehiclesToInsert = [];
    
    for (const row of data) {
      const chassisKey = findKey(row, ['CHASSIS NO', 'Chassis No', 'VIN']);
      const nameKey = findKey(row, ['CUSTOMER NAME', 'Customer Name', 'Name']);
      const modelKey = findKey(row, ['MODEL', 'Model']);
      const colorKey = findKey(row, ['COLOUR', 'Color', 'COLOR']);

      const chassis = chassisKey ? row[chassisKey] : null;

      if (chassis) {
        const cleanChassis = String(chassis).replace(/\s+/g, '').toUpperCase();
        vehiclesToInsert.push([
            cleanChassis,
            nameKey ? row[nameKey] : '',
            modelKey ? row[modelKey] : '',
            colorKey ? row[colorKey] : ''
        ]);
      }
    }

    // 3. Manual Batch Insert
    if (vehiclesToInsert.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < vehiclesToInsert.length; i += chunkSize) {
            const chunk = vehiclesToInsert.slice(i, i + chunkSize);
            
            const placeholders = chunk.map((_, idx) => 
                `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`
            ).join(',');
            
            const flatValues = chunk.flat();
            
            const query = `INSERT INTO form22_vehicles (chassis_no, customer_name, model, color) VALUES ${placeholders}`;
            
            await client.query(query, flatValues);
        }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Successfully uploaded ${vehiclesToInsert.length} vehicles.` });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Database upload failed: " + err.message });
  } finally {
    client.release();
  }
});

// Search Endpoint
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const cleanQ = q.trim().replace(/\s+/g, '');

  try {
    const result = await pool.query(
      `SELECT * FROM form22_vehicles 
       WHERE chassis_no ILIKE $1 OR customer_name ILIKE $2 LIMIT 10`,
      [`%${cleanQ}%`, `%${q.trim()}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;