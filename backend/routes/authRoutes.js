const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/authMiddleware');

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Query database for admin user
    let admin = await db.get('SELECT * FROM MASTER_ADMIN WHERE USERNAME = ?', [username]);

    // Validate credentials (supports both DB admin and 'admin' / 'admin' default credentials)
    const isValidAdmin = admin && ((admin.PASSWORD === password || admin.password === password) || (username === 'admin' && password === 'admin'));

    if (!isValidAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Create JWT token payload
    const userPayload = {
      username: admin ? (admin.USERNAME || admin.username) : username,
      name: admin ? (admin.NAME || admin.name) : 'System Administrator',
      role: admin ? (admin.ROLE || admin.role) : 'Super Admin',
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });

    return res.json({
      success: true,
      message: 'Login successful.',
      token: token,
      user: userPayload,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/auth/me
router.get('/me', authMiddleware, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
