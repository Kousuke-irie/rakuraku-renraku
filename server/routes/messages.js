// B-2/B-3基盤: メッセージ履歴取得・送信(RESTフォールバック)。
// 送信取消(DELETE /messages/:id)は対象外。
import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { assertRoomMember } from '../services/roomAuth.js';
import { classifyTopicTag } from '../services/tagClassifier.js';
import { calculateRoomUrgency } from '../services/urgencyCalculator.js';
import { emitAlertsResolved, emitMessageNew, emitSummaryUpdated } from '../services/realtime.js';
import { applyStatusTransition } from '../services/statusTransition.js';
import { queueStudentMessageAnalysis } from '../services/aiPriority.js';
import { findScheduleRequest } from '../services/scheduleRequests.js';
import {
  normalizeAcknowledgedCodes,
  queueAiComplianceRecord,
  recordComplianceAlerts,
} from '../services/complianceAlerts.js';
import { checkCompliance, isCheckedRole } from '../services/complianceChecker.js';
import { checkComplianceWithAi, mergeFindings } from '../services/complianceAi.js';
import { resolveSlaAlerts } from '../services/slaMonitor.js';
import {
  COMPLIANCE_AI_STATUS,
  MESSAGE_TYPE,
  ROLE,
  SCHEDULE_REQUEST_STATUS,
} from '../../shared/constants.js';

const router = Router();

const DEFAULT_LIMIT = 50;

// クライアント（messages ストア）は roomId でキャッシュし clientMsgId で
// 楽観描画を突き合わせる。SELECT する列は api.md の message の形と一致させること。
const MESSAGE_COLUMNS = `
  id,
  room_id       AS roomId,
  sender_id     AS senderId,
  body,
  type,
  topic_tag     AS topicTag,
  client_msg_id AS clientMsgId,
  schedule_request_id AS scheduleRequestId,
  created_at    AS createdAt,
  deleted_at    AS deletedAt
`;

function attachScheduleRequest(message) {
  if (!message?.scheduleRequestId) return message;
  return { ...message, scheduleRequest: findScheduleRequest(db, message.scheduleRequestId) };
}

export function findMessageByClientMsgId(clientMsgId) {
  return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE client_msg_id = ?`).get(clientMsgId);
}

router.get('/rooms/:id/messages', requireAuth, (req, res) => {
  const roomId = Number(req.params.id);
  // RoomAccessDeniedError は errorHandler が 403 `{ error, message }` に変換する。
  assertRoomMember(db, req.user.id, roomId);

  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT);
  const before = req.query.before ? Number(req.query.before) : null;

  // 対応ステータスの変更履歴（type='system'・P1-2）は人事の社内情報なので学生には返さない。
  // リアルタイム配信側の除外は services/realtime.js が担う。
  const params = {
    roomId,
    limit,
    includeSystem: req.user.role === ROLE.STUDENT ? 0 : 1,
    systemType: MESSAGE_TYPE.SYSTEM,
  };

  const rows = before
    ? db
        .prepare(
          `SELECT ${MESSAGE_COLUMNS}
           FROM messages
           WHERE room_id = @roomId AND id < @before AND deleted_at IS NULL
             AND (@includeSystem = 1 OR type != @systemType)
           ORDER BY id DESC LIMIT @limit`,
        )
        .all({ ...params, before })
    : db
        .prepare(
          `SELECT ${MESSAGE_COLUMNS}
           FROM messages
           WHERE room_id = @roomId AND deleted_at IS NULL
             AND (@includeSystem = 1 OR type != @systemType)
           ORDER BY id DESC LIMIT @limit`,
        )
        .all(params);

  res.json({ messages: rows.map(attachScheduleRequest) });
});

/**
 * P4-3: 送信前チェック。状態を変えない問い合わせなので REST に置く（api.md §1）。
 *
 * 辞書ベースの同期処理のみで、外部通信もDB書き込みも行わない。
 * ここが遅いと送信ボタンが固まるので、重い処理を足さないこと。
 *
 * このAPIはあくまで人事への親切であり、監視の本体ではない。
 * クライアントが呼ばずに送信しても insertMessage 側で検知・記録される。
 */
router.post('/messages/check', requireAuth, async (req, res, next) => {
  try {
    const roomId = Number(req.body?.roomId);
    const { body } = req.body ?? {};

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ error: 'invalid_request', message: 'roomId が必要です' });
    }
    if (typeof body !== 'string') {
      return res.status(400).json({ error: 'invalid_request', message: '本文が必要です' });
    }

    // 他人のルームの本文を検査させない（CLAUDE.md §6-6）
    assertRoomMember(db, req.user.id, roomId);

    // 学生の発言は検査対象外。学生が呼んでも常に空を返す
    if (!isCheckedRole(req.user.role)) {
      return res.json({ results: [], ai: { status: COMPLIANCE_AI_STATUS.OK } });
    }

    // 辞書は必ず動く。AI は繋がるときだけ上乗せする（P4-2b）。
    // AI が落ちていても status を返すだけで、辞書の結果はそのまま生きる。
    const dictionaryResults = checkCompliance(db, body);
    const ai = await checkComplianceWithAi(body);

    res.json({
      results: mergeFindings(dictionaryResults, ai.results),
      ai: { status: ai.status },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/rooms/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const roomId = Number(req.params.id);
    assertRoomMember(db, req.user.id, roomId);

    const { body, clientMsgId, acknowledgedCodes } = req.body;

    if (typeof body !== 'string' || body.trim() === '') {
      return res.status(400).json({ error: 'invalid_request', message: '本文が空です' });
    }
    if (typeof clientMsgId !== 'string' || clientMsgId === '') {
      return res.status(400).json({ error: 'invalid_request', message: 'clientMsgId が必要です' });
    }

    const existing = findMessageByClientMsgId(clientMsgId);

    if (existing) {
      return res.status(200).json({ message: existing });
    }

    const io = req.app.get('io');
    const message = insertMessage({
      roomId,
      senderId: req.user.id,
      senderRole: req.user.role,
      body,
      clientMsgId,
      acknowledgedCodes: normalizeAcknowledgedCodes(acknowledgedCodes),
      io,
    });

    await emitMessageNew(io, db, message);
    emitSummaryUpdated(io, db);
    if (req.user.role === ROLE.STUDENT) queueStudentMessageAnalysis(db, io, message);
    // 辞書分は insertMessage 内で記録済み。AI 分だけ保存トランザクションの外で追う
    queueAiComplianceRecord(db, {
      roomId,
      messageId: message.id,
      actorUserId: req.user.id,
      senderRole: req.user.role,
      body,
      acknowledgedCodes: normalizeAcknowledgedCodes(acknowledgedCodes),
    });

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

// message.js(Socket)と共有する保存処理。1トランザクションでmessages+roomsを更新する。
//
// acknowledgedCodes は送信前チェック（P4-3）で人事が承知したルールコード。
// 未指定なら「チェック未経由」として記録される（monitoring.md §5）。
//
// io は SLA 通知の解消を宛先へ配信するために受け取る（P4-1b）。
// **配信はコミット後**に行う。トランザクション内で送ると、ロールバックしたときに
// 「解消したはずの通知」が相手の画面から消えたまま復活しない。
export function insertMessage({ roomId, senderId, senderRole, body, clientMsgId, acknowledgedCodes = null, io = null }) {
  const now = new Date().toISOString();
  let resolvedAlerts = [];

  const run = db.transaction(() => {
    const topicTag = senderRole === ROLE.STUDENT ? classifyTopicTag(db, body) : null;
    const { lastInsertRowid: messageId } = db
      .prepare(
        `INSERT INTO messages (room_id, sender_id, body, type, topic_tag, client_msg_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(roomId, senderId, body, MESSAGE_TYPE.TEXT, topicTag, clientMsgId, now);

    if (senderRole === ROLE.STUDENT) {
      db.prepare(
        `UPDATE rooms SET last_message_id = ?, last_message_at = ?, last_student_message_at = ? WHERE id = ?`,
      ).run(messageId, now, now, roomId);
    } else {
      db.prepare(`UPDATE rooms SET last_message_id = ?, last_message_at = ? WHERE id = ?`).run(
        messageId,
        now,
        roomId,
      );
    }

    // 日程確定後の学生向け確定連絡は、学生の返答を求めない運用にする。
    // そのため、人事がテンプレートで連絡しても「対応中」を「返信待ち」へ戻さない。
    const hasBookedSchedule = (senderRole === ROLE.HR || senderRole === ROLE.ADMIN) && Boolean(
      db.prepare(
        `SELECT 1
         FROM schedule_requests
         WHERE room_id = ? AND status = ?
         LIMIT 1`,
      ).get(roomId, SCHEDULE_REQUEST_STATUS.BOOKED),
    );
    applyStatusTransition(db, roomId, senderRole, { keepInProgress: hasBookedSchedule });

    // P4-1：人事が返信したらこのルームの未解決 SLA 通知を閉じる。
    // コンプライアンス警告は「起きた事実」なので閉じない。
    if (isCheckedRole(senderRole)) resolvedAlerts = resolveSlaAlerts(db, roomId);

    const urgency = calculateRoomUrgency(db, roomId);
    db.prepare(`UPDATE rooms SET urgency = ? WHERE id = ?`).run(urgency, roomId);

    // P4-2：人事の発言を検査して alerts に記録する。学生の発言は対象外。
    // 辞書ベースなので外部通信は発生せず、保存トランザクション内で完結してよい。
    recordComplianceAlerts(db, {
      roomId,
      messageId,
      actorUserId: senderId,
      senderRole,
      body,
      acknowledgedCodes,
    });

    return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`).get(messageId);
  });

  const message = run();
  emitAlertsResolved(io, db, resolvedAlerts);

  return message;
}

export default router;
