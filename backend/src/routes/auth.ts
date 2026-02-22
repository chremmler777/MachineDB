import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/connection.js';
import { verifyToken, generateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.username, user.role);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        plant: user.plant,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, username, role, plant, created_at FROM users WHERE id = $1', [req.user?.userId]);
    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
