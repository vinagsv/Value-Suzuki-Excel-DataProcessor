import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { verifyToken } from '../middleware/auth.js'; 

const router = express.Router();

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'User not found' });

    const user = userResult.rows[0];
    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: 'Invalid password' });

    // 1. Set JWT Token to expire in exactly 9 hours
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '9h' } 
    );

    // 2. Set HTTP-Only Cookie to expire in exactly 9 hours (in milliseconds)
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 9 * 60 * 60 * 1000 
    });

    res.json({ role: user.role, email: user.email, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE PROFILE
router.put('/update-profile', verifyToken, async (req, res) => {
  const { newEmail, newPassword, currentPassword } = req.body;
  const userId = req.user.id;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    const validPass = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPass) return res.status(400).json({ error: 'Current password incorrect' });

    let query = 'UPDATE users SET email = $1';
    let params = [newEmail];
    
    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      query += ', password_hash = $2 WHERE id = $3';
      params.push(hash, userId);
    } else {
      query += ' WHERE id = $2';
      params.push(userId);
    }

    await pool.query(query, params);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ message: 'Logged out' });
});

// NEW: Get Portal Credentials (Authenticated Users Only)
router.get('/portal-creds', verifyToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT key, value FROM app_settings WHERE key IN ('portal_email', 'portal_password')");
        const creds = {};
        result.rows.forEach(r => creds[r.key] = r.value);
        res.json(creds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;