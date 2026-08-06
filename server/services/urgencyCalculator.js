import {
  HANDLING_STATUS,
  TOPIC_TAG,
  URGENCY,
  SLA_ALERT_HOURS as DEFAULT_SLA_ALERT_HOURS,
  SLA_WARN_HOURS as DEFAULT_SLA_WARN_HOURS,
} from '../../shared/constants.js';

function envHours(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const SLA_WARN_HOURS = envHours('SLA_WARN_HOURS', DEFAULT_SLA_WARN_HOURS);
export const SLA_ALERT_HOURS = envHours('SLA_ALERT_HOURS', DEFAULT_SLA_ALERT_HOURS);

export function calculateUrgency({ topicTag, elapsedHours, handlingStatus }) {
  if (
    handlingStatus === HANDLING_STATUS.DONE ||
    handlingStatus === HANDLING_STATUS.ON_HOLD
  ) {
    return URGENCY.LOW;
  }
  if (topicTag === TOPIC_TAG.ABSENCE_LATE) return URGENCY.HIGH;
  if (
    elapsedHours >= SLA_ALERT_HOURS &&
    [HANDLING_STATUS.NEEDS_REPLY, HANDLING_STATUS.IN_PROGRESS].includes(handlingStatus)
  ) {
    return URGENCY.HIGH;
  }
  if (
    [TOPIC_TAG.SCHEDULING, TOPIC_TAG.RESULT_WAITING].includes(topicTag) &&
    elapsedHours >= SLA_WARN_HOURS
  ) {
    return URGENCY.HIGH;
  }
  if (handlingStatus === HANDLING_STATUS.WAITING_STUDENT) return URGENCY.LOW;
  return URGENCY.NORMAL;
}

function elapsedHoursSince(isoString, now = Date.now()) {
  if (!isoString) return 0;
  return Math.max(0, (now - new Date(isoString).getTime()) / 3_600_000);
}

export function getRoomUrgencyInput(db, roomId) {
  return db
    .prepare(
      `SELECT
         r.handling_status AS handlingStatus,
         r.last_student_message_at AS lastStudentMessageAt,
         (
           SELECT m.topic_tag
           FROM messages m
           WHERE m.room_id = r.id
             AND m.sender_id = r.student_user_id
             AND m.deleted_at IS NULL
           ORDER BY m.id DESC
           LIMIT 1
         ) AS topicTag
       FROM rooms r
       WHERE r.id = ?`,
    )
    .get(roomId);
}

export function calculateRoomUrgency(db, roomId, now = Date.now()) {
  const input = getRoomUrgencyInput(db, roomId);
  if (!input) return null;

  return calculateUrgency({
    topicTag: input.topicTag,
    elapsedHours: elapsedHoursSince(input.lastStudentMessageAt, now),
    handlingStatus: input.handlingStatus,
  });
}

/**
 * 時間経過で緊急度が変わったルームだけ更新し、変更されたIDを返す。
 */
export function recalculateAllUrgencies(db, now = Date.now()) {
  const rooms = db
    .prepare(
      `SELECT
         r.id,
         r.urgency,
         r.handling_status AS handlingStatus,
         r.last_student_message_at AS lastStudentMessageAt,
         (
           SELECT m.topic_tag
           FROM messages m
           WHERE m.room_id = r.id
             AND m.sender_id = r.student_user_id
             AND m.deleted_at IS NULL
           ORDER BY m.id DESC
           LIMIT 1
         ) AS topicTag
       FROM rooms r`,
    )
    .all();

  const update = db.prepare(`UPDATE rooms SET urgency = ? WHERE id = ?`);
  const changedRoomIds = [];

  const run = db.transaction(() => {
    for (const room of rooms) {
      const urgency = calculateUrgency({
        topicTag: room.topicTag,
        elapsedHours: elapsedHoursSince(room.lastStudentMessageAt, now),
        handlingStatus: room.handlingStatus,
      });
      if (urgency === room.urgency) continue;

      update.run(urgency, room.id);
      changedRoomIds.push(room.id);
    }
  });

  run();
  return changedRoomIds;
}
