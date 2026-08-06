// P4-4: 監視ダッシュボードの集計を1回で返す。
//
// 閲覧は上長（admin）限定。担当者別の遵守率は評価につながる情報なので
// 人事全員には開放しない（monitoring.md 決定事項9）。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboard.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, (req, res) => {
  res.json(getDashboard(db));
});

export default router;
