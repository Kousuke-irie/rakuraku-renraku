import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertRoomMember } from '../services/roomAuth.js';
import { emitAlertsResolved, emitRoomUpdated } from '../services/realtime.js';
import { resolveStaleInterviewRoomAlerts } from '../services/interviewRoomMonitor.js';
import { findRoomIdByStudent, findStudent, updateStudent } from '../services/studentProfile.js';
import { listFeedbacksForHr, saveFeedback } from '../services/selectionFlow.js';
import {
  ROLE,
  SCHEDULE_STATE_VALUES,
  SELECTION_FEEDBACK_MAX_LENGTH,
  SELECTION_FLOW_STEP_VALUES,
  SELECTION_STATUS_VALUES,
} from '../../shared/constants.js';

/**
 * 学生プロフィール（P2-4 / P3-4・api.md §2「学生・ユーザー」）
 *
 * 認可は「人事ロールであること」＋「その学生のルームの room_members であること」の二段構え。
 * 学生本人による自分のプロフィール更新はスコープ外（選考ステータスは人事が管理するため）。
 */
const router = Router();

/** 会議室名・面接官名の上限。UI の1行に収まる範囲に留める */
const TEXT_MAX_LENGTH = 100;

function requireHr(req, res, next) {
  if (req.user.role !== ROLE.HR && req.user.role !== ROLE.ADMIN) {
    return res.status(403).json({ error: 'forbidden', message: '人事担当者のみ操作できます' });
  }
  next();
}

function invalidRequest(res, message) {
  return res.status(400).json({ error: 'invalid_request', message });
}

/** 空文字は「未設定」として NULL に寄せる（表示側の「未設定」と一致させる） */
function parseOptionalText(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;

  const text = value.trim();
  if (text.length > TEXT_MAX_LENGTH) return undefined;
  return text === '' ? null : text;
}

/** ISO8601 を UTC に正規化して保存する（CLAUDE.md §6-2） */
function parseOptionalDateTime(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseEnum(value, allowedValues) {
  return allowedValues.includes(value) ? value : undefined;
}

/**
 * リクエストボディを検証して更新用の patch に変換する。
 * 値が不正なキーが1つでもあれば null を返す（部分適用して一部だけ保存されるのを避ける）。
 */
function parseStudentPatch(body) {
  const source = body ?? {};
  const patch = {};

  const parsers = {
    selectionStatus: (value) => parseEnum(value, SELECTION_STATUS_VALUES),
    scheduleState: (value) => parseEnum(value, SCHEDULE_STATE_VALUES),
    nextInterviewAt: parseOptionalDateTime,
    nextInterviewRoom: parseOptionalText,
    interviewer: parseOptionalText,
  };

  for (const [key, parse] of Object.entries(parsers)) {
    if (source[key] === undefined) continue;

    const parsed = parse(source[key]);
    if (parsed === undefined) return null;
    patch[key] = parsed;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/** その学生のルームに人事がアクセスできるか検証し、ルームIDを返す */
function assertStudentAccess(userId, req) {
  const roomId = findRoomIdByStudent(db, userId);
  if (roomId === null) return null;

  assertRoomMember(db, req.user.id, roomId);
  return roomId;
}

router.get('/:userId', requireAuth, requireHr, (req, res) => {
  const userId = Number(req.params.userId);
  const student = findStudent(db, userId);
  if (!student || assertStudentAccess(userId, req) === null) {
    return res.status(404).json({ error: 'not_found', message: '学生が存在しません' });
  }

  res.json({ student });
});

router.patch('/:userId', requireAuth, requireHr, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!findStudent(db, userId)) {
      return res.status(404).json({ error: 'not_found', message: '学生が存在しません' });
    }

    const roomId = assertStudentAccess(userId, req);
    if (roomId === null) {
      return res.status(404).json({ error: 'not_found', message: 'ルームが存在しません' });
    }

    const patch = parseStudentPatch(req.body);
    if (!patch) {
      return invalidRequest(res, '更新内容が不正です');
    }

    const student = updateStudent(db, userId, patch);
    const io = req.app.get('io');

    // P4-5：会議室が入った／日程が変わった時点で、会議室未設定の通知を閉じる。
    // ★閉じるのは即時、立てるのは60秒タイマー。日時を入れた直後に会議室を
    //   入力するのが普通の操作順なので、即時に検知すると入力途中で通知が飛ぶ。
    emitAlertsResolved(io, db, resolveStaleInterviewRoomAlerts(db, { roomId }));

    // 受信箱の行にも選考ステータスが出ているので、他の人事の画面にも反映する
    await emitRoomUpdated(io, db, roomId);

    res.json({ student });
  } catch (error) {
    next(error);
  }
});

/**
 * 選考フィードバック（P2-11）。人事が受信箱のプロフィールパネルから書く。
 *
 * 学生本人がここを叩くことはない。学生は GET /selection-flow/me から
 * **完了済みステップのぶんだけ**受け取る（進行中の評価が合否連絡より先に漏れないように）。
 */
router.get('/:userId/feedbacks', requireAuth, requireHr, (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!findStudent(db, userId) || assertStudentAccess(userId, req) === null) {
      return res.status(404).json({ error: 'not_found', message: '学生が存在しません' });
    }

    res.json({ feedbacks: listFeedbacksForHr(db, userId) });
  } catch (error) {
    next(error);
  }
});

router.put('/:userId/feedbacks/:statusKey', requireAuth, requireHr, (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!findStudent(db, userId) || assertStudentAccess(userId, req) === null) {
      return res.status(404).json({ error: 'not_found', message: '学生が存在しません' });
    }

    const { statusKey } = req.params;
    if (!SELECTION_FLOW_STEP_VALUES.includes(statusKey)) {
      return invalidRequest(res, '選考ステップの指定が不正です');
    }

    if (req.body?.body !== undefined && typeof req.body.body !== 'string') {
      return invalidRequest(res, 'フィードバックは文字列で指定してください');
    }

    // 空文字は「取り消し」。saveFeedback 側で行を削除する
    const body = (req.body?.body ?? '').trim();
    if (body.length > SELECTION_FEEDBACK_MAX_LENGTH) {
      return invalidRequest(
        res,
        `フィードバックは${SELECTION_FEEDBACK_MAX_LENGTH}文字以内で入力してください`
      );
    }

    const feedback = saveFeedback(db, {
      studentUserId: userId,
      statusKey,
      body,
      authorId: req.user.id,
    });

    res.json({ feedback });
  } catch (error) {
    next(error);
  }
});

export default router;
