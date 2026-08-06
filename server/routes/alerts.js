// P4-1: 通知（監視イベント）の取得・既読化。
//
// 自分宛のものしか触れない。他人宛の id を指定されたら 404 を返す
// （403 だと「その通知は存在する」ことが漏れる。CLAUDE.md §6-6）。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth, requireHr } from '../middleware/auth.js';
import {
  countUnreadAlerts,
  listAlertsForUser,
  markAlertRead,
  markAllAlertsRead,
} from '../services/alertView.js';

const router = Router();

const DEFAULT_LIMIT = 50;

// 通知の宛先は担当人事と上長だけ。学生に届く通知は存在しないので、
// 存在しないものを問い合わせられる口を開けておかない（CLAUDE.md §6-6）。
router.use(requireAuth, requireHr);

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT);

  const alerts = listAlertsForUser(db, req.user.id, {
    unreadOnly: req.query.unread === 'true',
    includeResolved: req.query.includeResolved === 'true',
    limit,
  });

  res.json({ alerts, unreadCount: countUnreadAlerts(db, req.user.id) });
});

router.post('/read-all', (req, res) => {
  const updated = markAllAlertsRead(db, req.user.id);
  res.json({ updated, unreadCount: countUnreadAlerts(db, req.user.id) });
});

// '/read-all' より後に置くこと。先に置くと :id が 'read-all' を食う
router.post('/:id/read', (req, res) => {
  const alertId = Number(req.params.id);

  if (!Number.isInteger(alertId) || alertId <= 0) {
    return res.status(400).json({ error: 'invalid_request', message: '不正な通知IDです' });
  }

  if (!markAlertRead(db, req.user.id, alertId)) {
    return res.status(404).json({ error: 'not_found', message: '通知が見つかりません' });
  }

  res.json({ unreadCount: countUnreadAlerts(db, req.user.id) });
});

export default router;
