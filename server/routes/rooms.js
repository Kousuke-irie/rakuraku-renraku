import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertRoomMember } from '../services/roomAuth.js';
import { findRoomForUser, listRoomsForUser } from '../services/roomView.js';
import {
  emitMessageNew,
  emitReadUpdated,
  emitRoomUpdated,
  emitSummaryUpdated,
} from '../services/realtime.js';
import { updateAssignee, updateHandlingStatus } from '../services/roomStatus.js';
import { markRoomRead } from '../services/readReceipt.js';
import { expireWaitingScheduleRequests } from '../services/scheduleRequests.js';
import {
  DEFAULT_SORT_KEY,
  AI_RECOMMENDED_PRIORITY_VALUES,
  HANDLING_STATUS_VALUES,
  ROLE,
  SELECTION_STATUS_VALUES,
  SORT_KEY_VALUES,
  TOPIC_TAG_VALUES,
} from '../../shared/constants.js';

const router = Router();
const ASSIGNEE_MODE = Object.freeze({ UNASSIGNED: 'unassigned', ASSIGNED: 'assigned' });

function isHr(role) {
  return role === ROLE.HR || role === ROLE.ADMIN;
}

function parseList(value) {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => String(item).split(',')).filter(Boolean);
}

function parseEnumList(value, allowedValues) {
  const values = parseList(value);
  return values.every((item) => allowedValues.includes(item)) ? values : null;
}

function jsonOrNull(values) {
  return values.length > 0 ? JSON.stringify(values) : null;
}

function parseRoomFilters(query, userId) {
  const handlingStatus = parseEnumList(query.handlingStatus, HANDLING_STATUS_VALUES);
  const selectionStatus = parseEnumList(query.selectionStatus, SELECTION_STATUS_VALUES);
  const topicTag = parseEnumList(query.topicTag, TOPIC_TAG_VALUES);
  const priority = parseEnumList(query.priority, AI_RECOMMENDED_PRIORITY_VALUES);
  const sort = query.sort ?? DEFAULT_SORT_KEY;

  if (
    handlingStatus === null ||
    selectionStatus === null ||
    topicTag === null ||
    priority === null ||
    !SORT_KEY_VALUES.includes(sort)
  ) {
    return null;
  }

  let assigneeMode = null;
  let assigneeId = null;
  if (query.assigneeId === ASSIGNEE_MODE.UNASSIGNED) {
    assigneeMode = ASSIGNEE_MODE.UNASSIGNED;
  } else if (query.assigneeId !== undefined && query.assigneeId !== '') {
    assigneeId = Number(query.assigneeId);
    if (!Number.isInteger(assigneeId) || assigneeId <= 0) return null;
    assigneeMode = ASSIGNEE_MODE.ASSIGNED;
  }

  if (query.onlyMine === 'true') {
    assigneeMode = ASSIGNEE_MODE.ASSIGNED;
    assigneeId = userId;
  }

  const search = typeof query.q === 'string' ? query.q.trim() : '';
  return {
    userId,
    handlingStatuses: jsonOrNull(handlingStatus),
    selectionStatuses: jsonOrNull(selectionStatus),
    topicTags: jsonOrNull(topicTag),
    priorities: jsonOrNull(priority),
    assigneeMode,
    assigneeId,
    queryPattern: search ? `%${search}%` : null,
    sort,
  };
}

router.get('/', requireAuth, (req, res) => {
  expireWaitingScheduleRequests(db);
  const filters = parseRoomFilters(req.query, req.user.id);
  if (!filters) {
    return res.status(400).json({
      error: 'invalid_query',
      message: 'フィルタまたはソート条件が不正です',
    });
  }

  res.json({ rooms: listRoomsForUser(db, filters) });
});

router.get('/:id', requireAuth, (req, res) => {
  expireWaitingScheduleRequests(db);
  const roomId = Number(req.params.id);
  assertRoomMember(db, req.user.id, roomId);

  const room = findRoomForUser(db, req.user.id, roomId);
  if (!room) {
    return res.status(404).json({ error: 'not_found', message: 'ルームが存在しません' });
  }

  res.json({ room });
});

/** PATCH /rooms/:id で変更できる項目 */
const PATCHABLE_KEYS = Object.freeze(['handlingStatus', 'assigneeUserId']);

/** 担当人事に指定できるのは hr / admin のユーザーのみ。null は「未割当」 */
function isAssignableUser(assigneeUserId) {
  if (assigneeUserId === null) return true;
  if (!Number.isInteger(assigneeUserId) || assigneeUserId <= 0) return false;

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(assigneeUserId);
  return Boolean(user) && isHr(user.role);
}

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isHr(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ変更できます' });
    }

    const roomId = Number(req.params.id);
    assertRoomMember(db, req.user.id, roomId);

    const keys = Object.keys(req.body ?? {});
    if (keys.length === 0 || !keys.every((key) => PATCHABLE_KEYS.includes(key))) {
      return res.status(400).json({
        error: 'invalid_request',
        message: `このエンドポイントでは ${PATCHABLE_KEYS.join(' / ')} のみ変更できます`,
      });
    }

    const { handlingStatus, assigneeUserId } = req.body;
    if (handlingStatus !== undefined && !HANDLING_STATUS_VALUES.includes(handlingStatus)) {
      return res.status(400).json({ error: 'invalid_request', message: '対応ステータスが不正です' });
    }
    if (assigneeUserId !== undefined && !isAssignableUser(assigneeUserId)) {
      return res.status(400).json({ error: 'invalid_request', message: '担当人事の指定が不正です' });
    }

    let changed = false;
    let systemMessage = null;

    if (handlingStatus !== undefined) {
      const result = updateHandlingStatus(db, { roomId, userId: req.user.id, handlingStatus });
      changed = changed || result.changed;
      systemMessage = result.message;
    }
    if (assigneeUserId !== undefined) {
      changed = updateAssignee(db, { roomId, assigneeUserId }).changed || changed;
    }

    const room = findRoomForUser(db, req.user.id, roomId);
    if (changed) {
      const io = req.app.get('io');
      if (systemMessage) await emitMessageNew(io, db, systemMessage);
      await emitRoomUpdated(io, db, roomId);
      // 未対応サマリーの「未割当」件数（P1-8）もアサイン変更で動く
      emitSummaryUpdated(io, db);
    }

    res.json({ room });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    const lastReadMessageId = Number(req.body?.lastReadMessageId);
    assertRoomMember(db, req.user.id, roomId);

    if (!Number.isInteger(lastReadMessageId) || lastReadMessageId <= 0) {
      return res.status(400).json({ error: 'invalid_request', message: '既読位置が不正です' });
    }

    const persistedId = markRoomRead(db, {
      roomId,
      userId: req.user.id,
      lastReadMessageId,
    });
    if (persistedId === null) {
      return res.status(400).json({
        error: 'invalid_request',
        message: '指定されたメッセージはこのルームに存在しません',
      });
    }

    const payload = { roomId, userId: req.user.id, lastReadMessageId: persistedId };
    const io = req.app.get('io');
    emitReadUpdated(io, payload);
    await emitRoomUpdated(io, db, roomId);

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;
