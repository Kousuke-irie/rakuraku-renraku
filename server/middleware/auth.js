import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { ROLE } from '../../shared/constants.js';

// HTTP・Socket.IO 双方の認証で共有する検証ロジック（単一の情報源）。
// 検証に失敗した場合はnullを返す（例外を投げない。呼び出し側で401/connect_errorに変換する）。
export function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = verifyToken(req.cookies?.token);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: 'ログインが必要です' });
  }
  req.user = user;
  next();
}

/**
 * 上長（admin）専用エンドポイントのガード（P4-4）。
 * 担当者別の遵守率は評価につながる情報なので、人事全員には開放しない。
 * **requireAuth の後に置くこと。**
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: 'この画面は管理者のみ閲覧できます' });
  }
  next();
}
