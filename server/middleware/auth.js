import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

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
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = user;
  next();
}
