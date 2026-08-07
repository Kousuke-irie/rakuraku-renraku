// P4-4: 監視ダッシュボードの集計を1回で返す。
//
// 閲覧は人事全員（hr / admin）。担当者別の遵守率も含めて共有する。
// **相互監視のため**であり、隠すと「取りこぼしを拾い上げる」が個人の努力に戻る。
// 学生には出さない（requireHr が弾く）。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth, requireHr } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboard.js';
import { findAssignee, getPersonalDashboard } from '../services/personalDashboard.js';

const router = Router();

router.get('/', requireAuth, requireHr, (req, res) => {
  res.json(getDashboard(db));
});

/**
 * P4-8: 担当者1人ぶんの集計。`?assigneeId=` 省略時は自分。
 *
 * 他人の id も指定できる。全社版で担当者別の遵守率を全員に見せているのと同じ理由で、
 * ここだけ本人限定にすると相互監視が成り立たない（monitoring.md §6）。
 */
router.get('/personal', requireAuth, requireHr, (req, res) => {
  const raw = req.query.assigneeId;

  let assigneeId = req.user.id;
  if (raw !== undefined && raw !== '') {
    assigneeId = Number(raw);
    if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
      return res.status(400).json({ error: 'invalid_query', message: '担当者の指定が不正です' });
    }
  }

  const assignee = findAssignee(db, assigneeId);
  if (!assignee) {
    return res.status(404).json({ error: 'not_found', message: '担当者が見つかりません' });
  }

  return res.json({ assignee, ...getPersonalDashboard(db, assignee.id) });
});

export default router;
