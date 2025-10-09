const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usersDb = require('../db/users');

const router = express.Router();

// In-memory fallback user store
const users = new Map();
if (!usersDb.TABLE_NAME) {
  // create a default admin user: admin / admin
  (async () => {
    const hash = await bcrypt.hash('admin', 10);
    users.set('admin', { username: 'admin', passwordHash: hash, name: 'Administrator' });
  })();
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    if (usersDb.TABLE_NAME) {
      const existing = await usersDb.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: 'User already exists' });
      await usersDb.createUser({ username, passwordHash, name });
      const token = signToken({ username });
      return res.status(201).json({ token });
    }
    if (users.has(username)) return res.status(409).json({ error: 'User already exists' });
    users.set(username, { username, passwordHash, name });
    const token = signToken({ username });
    return res.status(201).json({ token });
  } catch (err) {
    console.error('Error registering user:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    if (usersDb.TABLE_NAME) {
      const user = await usersDb.getUserByUsername(username);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken({ username });
      return res.json({ token });
    }
    const user = users.get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ username });
    return res.json({ token });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
