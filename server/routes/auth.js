import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { JWT_SECRET, JWT_EXPIRES_IN, IS_PRODUCTION } from '../config/env.js';
import { ROLE, ROLE_VALUES } from '../../shared/constants.js';

const router = Router();

const BCRYPT_COST = 10;

// 公開登録で作成できるロール。hr / admin を公開登録で作らせないこと。
// hr は接続時に socket の `hr` ルームへ join し、全ルームの `message:new`
// （本文込み）を受け取るため、誰でも hr を名乗れると全学生の会話が漏れる。
// hr / admin はシード（server/db/seed.js）または管理者機能で作成する。
const SELF_REGISTRABLE_ROLES = [ROLE.STUDENT];

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

// clearCookie は発行時と同じ属性を渡さないと消えない場合がある（本番の Secure Cookie 等）。
// 属性を1箇所にまとめ、発行と破棄で必ず同じ値を使う。
const TOKEN_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PRODUCTION,
  path: '/',
});

function issueTokenCookie(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const { exp, iat } = jwt.decode(token);
  res.cookie('token', token, { ...TOKEN_COOKIE_OPTIONS, maxAge: (exp - iat) * 1000 });
}

router.post('/register', async (req, res) => {
  const { loginId, password, displayName, role } = req.body;

  if (!loginId || !password || !displayName || !role) {
    return res.status(400).json({ error: 'invalid_request', message: '必須項目が不足しています' });
  }
  if (!ROLE_VALUES.includes(role)) {
    return res.status(400).json({ error: 'invalid_request', message: 'role が不正です' });
  }
  if (!SELF_REGISTRABLE_ROLES.includes(role)) {
    return res
      .status(403)
      .json({ error: 'forbidden_role', message: 'このロールでは登録できません' });
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
  res.clearCookie('token', TOKEN_COOKIE_OPTIONS);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    // トークンは有効でもユーザーが消えている（削除済み）ケース。Cookie も破棄する。
    res.clearCookie('token', TOKEN_COOKIE_OPTIONS);
    return res.status(401).json({ error: 'unauthorized', message: 'ログインが必要です' });
  }
  res.json({ user: toPublicUser(user) });
});

export default router;
