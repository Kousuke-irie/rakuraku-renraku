// 仮実装：担当①の A-3（JWT httpOnly Cookie 認証）が完了するまでのつなぎ。
// x-user-id ヘッダを無条件に信用する。本番相当の認証ではない。
// A-3 完了後は server/middleware/auth.js に一行差し替えること。
import db from '../db/db.js';

export function tempAuth(req, res, next) {
  const userId = Number(req.header('x-user-id'));

  if (!userId) {
    return res.status(401).json({ success: false, error: 'x-user-id header is required' });
  }

  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);

  if (!user) {
    return res.status(401).json({ success: false, error: 'unknown user' });
  }

  req.user = { id: user.id, role: user.role };
  next();
}
