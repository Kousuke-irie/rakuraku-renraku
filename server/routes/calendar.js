import { Router } from 'express';
import {
  DEFAULT_DAILY_END_TIME,
  DEFAULT_DAILY_START_TIME,
  ROLE,
} from '../../shared/constants.js';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { listCalendarSlots, listInterviewers } from '../services/calendarGateway.js';

const router = Router();

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ操作できます' });
  }
  next();
}

router.get('/interviewers', requireAuth, requireHr, (req, res) => {
  res.json({ interviewers: listInterviewers(db) });
});

router.get('/interviewers/:id/slots', requireAuth, requireHr, (req, res, next) => {
  try {
    const result = listCalendarSlots(db, Number(req.params.id), {
      from: req.query.from,
      to: req.query.to,
      durationMinutes: req.query.durationMinutes,
      dailyStartTime: req.query.dailyStartTime ?? DEFAULT_DAILY_START_TIME,
      dailyEndTime: req.query.dailyEndTime ?? DEFAULT_DAILY_END_TIME,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
