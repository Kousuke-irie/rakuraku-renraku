import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getSummary } from '../services/summary.js';
import { ROLE } from '../../shared/constants.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ参照できます' });
  }

  res.json(getSummary(db));
});

export default router;
