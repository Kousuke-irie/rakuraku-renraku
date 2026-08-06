import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { ROLE } from '../../shared/constants.js';

/**
 * 定型文（P2-1・api.md §2「メモ・定型文・サマリー」）
 *
 * ルーム非依存の全社共有マスタデータ（database.md §3 snippets）なので
 * ルームメンバー確認は不要。人事のみ参照できればよい。
 */
const router = Router();

router.get('/', requireAuth, (req, res) => {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ参照できます' });
  }

  const snippets = db
    .prepare('SELECT id, command, title, body FROM snippets ORDER BY sort_order ASC')
    .all();

  res.json({ snippets });
});

export default router;
