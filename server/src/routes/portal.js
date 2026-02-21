import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// GET /api/portal/customer/:fileNo
// Read-only route to fetch customer details and receipts by file number
router.get('/customer/:fileNo', async (req, res) => {
  const { fileNo } = req.params;
  const decodedFileNo = decodeURIComponent(fileNo);

  try {
    // Fetch all receipts for the given file number
    const result = await pool.query(`
      SELECT 
        receipt_no, 
        date, 
        customer_name, 
        mobile, 
        amount, 
        payment_type, 
        payment_mode, 
        status 
      FROM general_receipts 
      WHERE file_no = $1
      ORDER BY date DESC
    `, [decodedFileNo]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No records found for this file number' });
    }

    // Extract customer info from the most recent valid receipt (or the first one available if all cancelled)
    const validReceipts = result.rows.filter(r => r.status !== 'CANCELLED');
    const sourceReceipt = validReceipts.length > 0 ? validReceipts[0] : result.rows[0];

    // Calculate total amount received (excluding cancelled receipts)
    const totalPaid = validReceipts.reduce((sum, row) => sum + Number(row.amount), 0);

    // Format the response for the external client
    const responseData = {
      success: true,
      data: {
        fileNumber: decodedFileNo,
        customerName: sourceReceipt.customer_name,
        mobile: sourceReceipt.mobile || null,
        totalAmountReceived: totalPaid,
        receipts: result.rows.map(r => ({
          receiptNo: r.receipt_no,
          date: r.date,
          amount: Number(r.amount),
          paymentType: r.payment_type,
          paymentMode: r.payment_mode,
          status: r.status
        }))
      }
    };

    res.json(responseData);
  } catch (err) {
    console.error("Portal API Error:", err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;