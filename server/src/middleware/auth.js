import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (user.rows.length === 0) return res.status(400).json({ error: 'User not found' });

    const validPass = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPass) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '12h' }
    );

    // --- KEY CHANGE HERE ---
    // We must use 'none' for sameSite to allow cross-domain cookies (Netlify -> Railway)
    // When using 'none', 'secure' MUST be true.
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,       // Required for SameSite="None"
      sameSite: 'none',   // Allows cross-site cookie usage
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    res.json({ role: user.rows[0].role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout to clear cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: 'Logged out' });
});

export default router;