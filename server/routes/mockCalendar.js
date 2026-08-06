import { Router } from 'express';
import { DEFAULT_DAILY_END_TIME, DEFAULT_DAILY_START_TIME } from '../../shared/constants.js';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { listCalendarSlots, listInterviewers } from '../services/calendarGateway.js';
import { bookScheduleRequest } from '../services/scheduleBookingService.js';
import {
  emitMessageNew,
  emitRoomUpdated,
  emitScheduleBooked,
  emitScheduleRequestUpdated,
  emitScheduleSlotUpdated,
} from '../services/realtime.js';

const router = Router();

router.get('/interviewers', requireAuth, (req, res) => {
  res.json({ interviewers: listInterviewers(db) });
});

router.get('/interviewers/:interviewerId/slots', requireAuth, (req, res, next) => {
  try {
    res.json(
      listCalendarSlots(db, Number(req.params.interviewerId), {
        from: req.query.from,
        to: req.query.to,
        durationMinutes: req.query.durationMinutes,
        dailyStartTime: req.query.dailyStartTime ?? DEFAULT_DAILY_START_TIME,
        dailyEndTime: req.query.dailyEndTime ?? DEFAULT_DAILY_END_TIME,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post('/bookings', requireAuth, async (req, res, next) => {
  try {
    const result = bookScheduleRequest(db, {
      requestId: Number(req.body?.scheduleRequestId),
      studentUserId: req.user.id,
      slotId: req.body?.slotId,
    });
    const io = req.app.get('io');
    await emitMessageNew(io, db, result.message);
    await emitRoomUpdated(io, db, result.roomId);
    emitScheduleRequestUpdated(io, result.request);
    emitScheduleBooked(io, result.request);
    emitScheduleSlotUpdated(io, {
      interviewerId: result.interviewerId,
      slotId: result.slot.slotId,
      available: false,
    });
    res.status(201).json(result.booking);
  } catch (error) {
    next(error);
  }
});

export default router;
