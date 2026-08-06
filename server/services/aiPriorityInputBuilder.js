import { HANDLING_STATUS, MESSAGE_TYPE, ROLE, TOPIC_TAG } from '../../shared/constants.js';

export const AI_INPUT_LIMIT = Object.freeze({
  LATEST_STUDENT_MESSAGE: 1000,
  PREVIOUS_HR_MESSAGE: 500,
  RECENT_MESSAGE: 500,
  RECENT_MESSAGE_COUNT: 6,
  NEXT_EVENT_HOURS: 72,
});

const REQUEST_PATTERN = /[?？]|教えて|いつ|どう|変更|できます|でしょうか|お願いしたい|確認して|返信|連絡|知りたい/;
const ACKNOWLEDGEMENT_PATTERN = /^(承知(しました|いたしました)?|了解(しました)?|確認しました|ありがとうございます|ありがとうございました|よろしくお願いいたします|よろしくお願いします)[。！!\s]*$/;

function truncate(value, maxLength) {
  if (typeof value !== 'string') return null;
  return Array.from(value).slice(0, maxLength).join('');
}

function hoursBetween(from, to) {
  const elapsed = (to - new Date(from).getTime()) / 3_600_000;
  return Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed * 10) / 10) : 0;
}

export function isAcknowledgementOnly(body) {
  if (typeof body !== 'string') return false;
  const normalized = body.trim();
  if (!normalized || normalized.length > 40 || REQUEST_PATTERN.test(normalized)) return false;
  return ACKNOWLEDGEMENT_PATTERN.test(normalized);
}

export function buildAiPriorityContext(db, { roomId, messageId, now = Date.now() }) {
  const target = db
    .prepare(
      `SELECT
         r.id AS roomId,
         r.student_user_id AS studentUserId,
         r.handling_status AS handlingStatus,
         r.ai_analyzed_message_id AS analyzedMessageId,
         r.ai_analysis_status AS analysisStatus,
         st.next_interview_at AS nextInterviewAt,
         m.id AS messageId,
         m.body,
         m.topic_tag AS topicTag,
         m.created_at AS createdAt,
         (
           SELECT latest.id
           FROM messages latest
           WHERE latest.room_id = r.id
             AND latest.sender_id = r.student_user_id
             AND latest.deleted_at IS NULL
             AND latest.type = ?
           ORDER BY latest.id DESC
           LIMIT 1
         ) AS latestStudentMessageId
       FROM rooms r
       JOIN students st ON st.user_id = r.student_user_id
       JOIN messages m ON m.room_id = r.id AND m.id = ?
       WHERE r.id = ? AND m.sender_id = r.student_user_id AND m.deleted_at IS NULL`,
    )
    .get(MESSAGE_TYPE.TEXT, messageId, roomId);

  if (!target || target.latestStudentMessageId !== target.messageId) return null;

  const previousHr = db
    .prepare(
      `SELECT m.body
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = ?
         AND m.id < ?
         AND m.deleted_at IS NULL
         AND m.type = ?
         AND u.role IN (?, ?)
       ORDER BY m.id DESC
       LIMIT 1`,
    )
    .get(roomId, messageId, MESSAGE_TYPE.TEXT, ROLE.HR, ROLE.ADMIN);

  const minimalInput = {
    latestStudentMessage: truncate(target.body, AI_INPUT_LIMIT.LATEST_STUDENT_MESSAGE),
    previousHrMessage: truncate(previousHr?.body, AI_INPUT_LIMIT.PREVIOUS_HR_MESSAGE),
    topicTag: target.topicTag,
    elapsedHours: hoursBetween(target.createdAt, now),
  };

  if (target.nextInterviewAt) {
    const hoursUntil = (new Date(target.nextInterviewAt).getTime() - now) / 3_600_000;
    if (Number.isFinite(hoursUntil) && hoursUntil >= 0 && hoursUntil <= AI_INPUT_LIMIT.NEXT_EVENT_HOURS) {
      minimalInput.nextEvent = {
        type: 'interview',
        hoursUntil: Math.round(hoursUntil * 10) / 10,
      };
    }
  }

  return {
    ...target,
    minimalInput,
    shouldSkip:
      target.handlingStatus === HANDLING_STATUS.ON_HOLD ||
      target.topicTag === TOPIC_TAG.ABSENCE_LATE ||
      isAcknowledgementOnly(target.body),
  };
}

export function buildRecentMessages(db, { roomId, messageId }) {
  const rows = db
    .prepare(
      `SELECT u.role, m.body
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = ?
         AND m.id <= ?
         AND m.deleted_at IS NULL
         AND m.type = ?
         AND u.role IN (?, ?, ?)
       ORDER BY m.id DESC
       LIMIT ?`,
    )
    .all(
      roomId,
      messageId,
      MESSAGE_TYPE.TEXT,
      ROLE.STUDENT,
      ROLE.HR,
      ROLE.ADMIN,
      AI_INPUT_LIMIT.RECENT_MESSAGE_COUNT,
    )
    .reverse();

  return rows.map((row) => ({
    sender: row.role === ROLE.STUDENT ? 'student' : 'hr',
    body: truncate(row.body, AI_INPUT_LIMIT.RECENT_MESSAGE),
  }));
}
