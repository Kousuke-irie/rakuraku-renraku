// P4-4: 監視ダッシュボードの集計を1回で返す。
//
// 閲覧は人事全員（hr / admin）。担当者別の遵守率も含めて共有する。
// **相互監視のため**であり、隠すと「取りこぼしを拾い上げる」が個人の努力に戻る。
// 学生には出さない（requireHr が弾く）。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth, requireHr } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboard.js';

const router = Router();

router.get('/', requireAuth, requireHr, (req, res) => {
  res.json(getDashboard(db));
});

export default router;
