import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { generateAiSummary, getAiSummaryState } from '../services/aiSummary.js';
import { emitAiSummaryUpdated } from '../services/realtime.js';
import { AI_SUMMARY_STATUS, ROLE } from '../../shared/constants.js';

const router = Router();

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ参照できます' });
  }
  next();
}

function generateAndNotify(req, force) {
  const io = req.app.get('io');
  return generateAiSummary(db, { userId: req.user.id, force }).then((summary) => {
    emitAiSummaryUpdated(io, req.user.id, summary);
    return summary;
  });
}

router.get('/', requireAuth, requireHr, (req, res) => {
  let summary = getAiSummaryState(req.user.id);
  if (summary.status === AI_SUMMARY_STATUS.IDLE) {
    // セッション復元やサーバ再起動後も、ホームを開くだけで生成されるようにする。
    void generateAndNotify(req, false);
    summary = getAiSummaryState(req.user.id);
  }
  res.json(summary);
});

router.post('/', requireAuth, requireHr, async (req, res) => {
  const summary = await generateAndNotify(req, true);
  res.json(summary);
});

export default router;
