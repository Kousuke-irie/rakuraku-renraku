import { Router } from 'express';
import {
  INTERVIEW_DURATION_OPTIONS,
  INTERVIEW_FORMAT_VALUES,
  ROLE,
  SCHEDULE_REQUEST_STATUS,
} from '../../shared/constants.js';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { findInterviewer, listCalendarSlots } from '../services/calendarGateway.js';
import { bookScheduleRequest } from '../services/scheduleBookingService.js';
import { assertRoomMember } from '../services/roomAuth.js';
import {
  createScheduleRequest,
  expireWaitingScheduleRequests,
  findScheduleRequest,
  findScheduleRequestRecord,
  listScheduleRequestsForRoom,
  ScheduleRequestError,
  scheduleOptionsFromRecord,
} from '../services/scheduleRequests.js';
import {
  emitMessageNew,
  emitRoomUpdated,
  emitScheduleBooked,
  emitScheduleRequestUpdated,
  emitScheduleSlotUpdated,
  emitSummaryUpdated,
} from '../services/realtime.js';

const router = Router();
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isHr(role) {
  return role === ROLE.HR || role === ROLE.ADMIN;
}

function normalizeIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseCreateBody(body) {
  const source = body ?? {};
  const interviewerId = Number(source.interviewerId);
  const selectionStage = typeof source.selectionStage === 'string' ? source.selectionStage.trim() : '';
  const durationMinutes = Number(source.durationMinutes);
  const availableFrom = normalizeIso(source.availableFrom);
  const availableUntil = normalizeIso(source.availableUntil);
  const responseDeadline = normalizeIso(source.responseDeadline);
  const dailyStartTime = source.dailyStartTime;
  const dailyEndTime = source.dailyEndTime;
  const locationText = typeof source.locationText === 'string' ? source.locationText.trim() || null : null;

  if (
    !Number.isInteger(interviewerId) ||
    !selectionStage || selectionStage.length > 50 ||
    !INTERVIEW_DURATION_OPTIONS.includes(durationMinutes) ||
    !availableFrom || !availableUntil || availableFrom >= availableUntil ||
    !responseDeadline || new Date(responseDeadline).getTime() <= Date.now() ||
    !TIME_PATTERN.test(dailyStartTime) || !TIME_PATTERN.test(dailyEndTime) ||
    dailyStartTime >= dailyEndTime ||
    !INTERVIEW_FORMAT_VALUES.includes(source.interviewFormat) ||
    (locationText?.length ?? 0) > 500
  ) {
    return null;
  }

  return {
    interviewerId,
    selectionStage,
    durationMinutes,
    availableFrom,
    availableUntil,
    dailyStartTime,
    dailyEndTime,
    responseDeadline,
    interviewFormat: source.interviewFormat,
    locationText,
  };
}

function assertScheduleAccess(req, record) {
  if (!record) throw new ScheduleRequestError('not_found', '日程調整が存在しません', 404);
  if (req.user.role === ROLE.STUDENT) {
    if (Number(record.studentUserId) !== Number(req.user.id)) {
      throw new ScheduleRequestError('not_found', '日程調整が存在しません', 404);
    }
    return;
  }
  if (!isHr(req.user.role)) throw new ScheduleRequestError('forbidden', '操作できません', 403);
  assertRoomMember(db, req.user.id, record.roomId);
}

async function expireAndEmit(io, requestId = null) {
  const expired = expireWaitingScheduleRequests(db, requestId);
  await Promise.all(expired.map((request) => emitScheduleRequestUpdated(io, request)));
  return expired;
}

router.post('/rooms/:roomId/schedule-requests', requireAuth, async (req, res, next) => {
  try {
    if (!isHr(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ作成できます' });
    }
    const roomId = Number(req.params.roomId);
    assertRoomMember(db, req.user.id, roomId);
    const room = db.prepare(`SELECT student_user_id AS studentUserId FROM rooms WHERE id = ?`).get(roomId);
    if (!room?.studentUserId) {
      return res.status(404).json({ error: 'not_found', message: '学生ルームが存在しません' });
    }
    const input = parseCreateBody(req.body);
    if (!input || !findInterviewer(db, input.interviewerId)) {
      return res.status(400).json({ error: 'invalid_request', message: '入力内容が不正です' });
    }
    const preview = listCalendarSlots(db, input.interviewerId, {
      from: input.availableFrom,
      to: input.availableUntil,
      durationMinutes: input.durationMinutes,
      dailyStartTime: input.dailyStartTime,
      dailyEndTime: input.dailyEndTime,
    });
    if (!preview.slots.some((slot) => slot.available)) {
      return res.status(409).json({ error: 'no_available_slots', message: '対象期間に予約可能枠がありません' });
    }

    await expireAndEmit(req.app.get('io'), null);
    const result = createScheduleRequest(db, {
      ...input,
      roomId,
      studentUserId: room.studentUserId,
      createdByUserId: req.user.id,
    });
    const io = req.app.get('io');
    await emitMessageNew(io, db, result.message);
    await emitRoomUpdated(io, db, roomId);
    emitScheduleRequestUpdated(io, result.request);
    emitSummaryUpdated(io, db);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/rooms/:roomId/schedule-requests', requireAuth, async (req, res, next) => {
  try {
    const roomId = Number(req.params.roomId);
    assertRoomMember(db, req.user.id, roomId);
    await expireAndEmit(req.app.get('io'), null);
    res.json({ requests: listScheduleRequestsForRoom(db, roomId) });
  } catch (error) {
    next(error);
  }
});

router.get('/schedule-requests/:id', requireAuth, async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    const record = findScheduleRequestRecord(db, requestId);
    assertScheduleAccess(req, record);
    await expireAndEmit(req.app.get('io'), requestId);
    res.json({ request: findScheduleRequest(db, requestId) });
  } catch (error) {
    next(error);
  }
});

router.get('/schedule-requests/:id/slots', requireAuth, async (req, res, next) => {
  try {
    const requestId = Number(req.params.id);
    let record = findScheduleRequestRecord(db, requestId);
    assertScheduleAccess(req, record);
    await expireAndEmit(req.app.get('io'), requestId);
    record = findScheduleRequestRecord(db, requestId);
    const result = listCalendarSlots(db, record.interviewerId, scheduleOptionsFromRecord(record));
    const needsAttention =
      record.status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT &&
      !result.slots.some((slot) => slot.available);
    if (Boolean(record.needsAttention) !== needsAttention) {
      db.prepare(
        `UPDATE schedule_requests SET needs_attention = ?, updated_at = ? WHERE id = ?`,
      ).run(needsAttention ? 1 : 0, new Date().toISOString(), requestId);
      const updated = findScheduleRequest(db, requestId);
      const io = req.app.get('io');
      emitScheduleRequestUpdated(io, updated);
      await emitRoomUpdated(io, db, record.roomId);
    }
    res.json({ ...result, status: record.status });
  } catch (error) {
    next(error);
  }
});

router.post('/schedule-requests/:id/book', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== ROLE.STUDENT) {
      return res.status(403).json({ error: 'forbidden', message: '学生本人のみ予約できます' });
    }
    const slotId = typeof req.body?.slotId === 'string' ? req.body.slotId : '';
    if (!slotId) {
      return res.status(400).json({ error: 'invalid_request', message: '日時を選択してください' });
    }
    await expireAndEmit(req.app.get('io'), Number(req.params.id));
    const result = bookScheduleRequest(db, {
      requestId: Number(req.params.id),
      studentUserId: req.user.id,
      slotId,
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
    res.status(201).json({ booking: result.booking, request: result.request });
  } catch (error) {
    next(error);
  }
});

export default router;
