import { Router } from 'express';
import { hash as _hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { TABLE_NAME, getUserByUsername, createUser } from '../db/users';

const router = Router();

// In-memory fallback user store
const users = new Map();
if (!TABLE_NAME) {
  // create a default admin user: admin / admin
  (async () => {
    const hash = await _hash('admin', 10);
    users.set('admin', { username: 'admin', passwordHash: hash, name: 'Administrator' });
  })();
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return sign(payload, secret, { expiresIn: '8h' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const passwordHash = await _hash(password, 10);
    if (TABLE_NAME) {
      const existing = await getUserByUsername(username);
      if (existing) return res.status(409).json({ error: 'User already exists' });
      await createUser({ username, passwordHash, name });
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
    if (TABLE_NAME) {
      const user = await getUserByUsername(username);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken({ username });
      return res.json({ token });
    }
    const user = users.get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ username });
    return res.json({ token });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
