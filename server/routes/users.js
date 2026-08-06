import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { ROLE, ROLE_VALUES } from '../../shared/constants.js';

/**
 * ユーザー一覧（api.md §2「学生・ユーザー」）
 *
 * 用途は担当者アサインの候補取得（P2-9）。
 * `?role=hr&role=admin` のように複数指定できる（rooms のフィルタと同じ形式）。
 * 人事の氏名一覧は社内情報なので、学生ロールには返さない。
 */
const router = Router();

function parseRoles(value) {
  if (value === undefined || value === '') return null;

  const roles = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(','))
    .filter(Boolean);

  return roles.every((role) => ROLE_VALUES.includes(role)) ? roles : undefined;
}

router.get('/', requireAuth, (req, res) => {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ参照できます' });
  }

  const roles = parseRoles(req.query.role);
  if (roles === undefined) {
    return res.status(400).json({ error: 'invalid_query', message: 'ロールの指定が不正です' });
  }

  // 既定は人事（hr / admin）。学生を一覧できるエンドポイントにはしない
  const targetRoles = roles ?? [ROLE.HR, ROLE.ADMIN];
  const placeholders = targetRoles.map(() => '?').join(', ');

  const users = db
    .prepare(
      `SELECT id, display_name AS displayName, avatar_color AS avatarColor, role
       FROM users
       WHERE role IN (${placeholders})
       ORDER BY id`
    )
    .all(...targetRoles);

  res.json({ users });
});

export default router;
