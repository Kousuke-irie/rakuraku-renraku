import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { ROLE_VALUES } from '../../shared/constants.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_COST = 10;

const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function toPublicUser(row) {
  return {
    id: row.id,
    loginId: row.login_id,
    displayName: row.display_name,
    statusMessage: row.status_message,
    avatarColor: row.avatar_color,
    role: row.role,
  };
}

function issueTokenCookie(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const { exp, iat } = jwt.decode(token);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: (exp - iat) * 1000,
  });
}

router.post('/register', async (req, res) => {
  const { loginId, password, displayName, role } = req.body;

  if (!loginId || !password || !displayName || !role) {
    return res.status(400).json({ error: 'invalid_request', message: '必須項目が不足しています' });
  }
  if (!ROLE_VALUES.includes(role)) {
    return res.status(400).json({ error: 'invalid_request', message: 'role が不正です' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE login_id = ?').get(loginId);
  if (existing) {
    return res.status(409).json({ error: 'login_id_taken', message: 'このIDは既に使用されています' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO users (login_id, password_hash, display_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(loginId, passwordHash, displayName, role, now, now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  issueTokenCookie(res, user);
  res.status(201).json({ user: toPublicUser(user) });
});

router.post('/login', loginRateLimit, async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.status(400).json({ error: 'invalid_request', message: '必須項目が不足しています' });
  }

  const user = db.prepare('SELECT * FROM users WHERE login_id = ?').get(loginId);
  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'IDまたはパスワードが正しくありません' });
  }

  issueTokenCookie(res, user);
  res.json({ user: toPublicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json({ user: toPublicUser(user) });
});

export default router;
