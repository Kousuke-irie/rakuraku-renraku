import {
  HANDLING_STATUS,
  MESSAGE_TYPE,
  SCHEDULE_REQUEST_STATUS,
  SCHEDULE_STATE,
  URGENCY,
} from '../../shared/constants.js';

const SCHEDULE_SELECT_SQL = `
  SELECT
    sr.id,
    sr.room_id                AS roomId,
    sr.student_user_id        AS studentUserId,
    sr.interviewer_id         AS interviewerId,
    sr.created_by_user_id     AS createdByUserId,
    sr.selection_stage        AS selectionStage,
    sr.duration_minutes       AS durationMinutes,
    sr.available_from         AS availableFrom,
    sr.available_until        AS availableUntil,
    sr.daily_start_time       AS dailyStartTime,
    sr.daily_end_time         AS dailyEndTime,
    sr.response_deadline      AS responseDeadline,
    sr.interview_format       AS interviewFormat,
    sr.location_text          AS locationText,
    sr.needs_attention        AS needsAttention,
    sr.status,
    sr.booked_slot_id         AS bookedSlotId,
    sr.booked_starts_at       AS bookedStartsAt,
    sr.booked_ends_at         AS bookedEndsAt,
    sr.booked_at              AS bookedAt,
    sr.created_at             AS createdAt,
    sr.updated_at             AS updatedAt,
    ci.external_id            AS interviewerExternalId,
    ci.display_name           AS interviewerDisplayName,
    ci.department             AS interviewerDepartment
  FROM schedule_requests sr
  JOIN calendar_interviewers ci ON ci.id = sr.interviewer_id
`;

export class ScheduleRequestError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'ScheduleRequestError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function toScheduleRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.roomId,
    interviewer: {
      id: row.interviewerId,
      externalId: row.interviewerExternalId,
      displayName: row.interviewerDisplayName,
      department: row.interviewerDepartment,
    },
    selectionStage: row.selectionStage,
    durationMinutes: row.durationMinutes,
    availableFrom: row.availableFrom,
    availableUntil: row.availableUntil,
    dailyStartTime: row.dailyStartTime,
    dailyEndTime: row.dailyEndTime,
    responseDeadline: row.responseDeadline,
    interviewFormat: row.interviewFormat,
    locationText: row.locationText,
    needsAttention: Boolean(row.needsAttention),
    status: row.status,
    bookedSlotId: row.bookedSlotId,
    bookedStartsAt: row.bookedStartsAt,
    bookedEndsAt: row.bookedEndsAt,
    bookedAt: row.bookedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function findScheduleRequestRecord(db, requestId) {
  return db.prepare(`${SCHEDULE_SELECT_SQL} WHERE sr.id = ?`).get(requestId);
}

export function findScheduleRequest(db, requestId) {
  return toScheduleRequest(findScheduleRequestRecord(db, requestId));
}

export function listScheduleRequestsForRoom(db, roomId) {
  return db
    .prepare(`${SCHEDULE_SELECT_SQL} WHERE sr.room_id = ? ORDER BY sr.id DESC`)
    .all(roomId)
    .map(toScheduleRequest);
}

export function scheduleOptionsFromRecord(record) {
  return {
    from: record.availableFrom,
    to: record.availableUntil,
    durationMinutes: record.durationMinutes,
    dailyStartTime: record.dailyStartTime,
    dailyEndTime: record.dailyEndTime,
  };
}

export function createScheduleRequest(db, input) {
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO schedule_requests (
           room_id, student_user_id, interviewer_id, created_by_user_id,
           selection_stage, duration_minutes, available_from, available_until,
           daily_start_time, daily_end_time, response_deadline,
           interview_format, location_text, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.roomId,
        input.studentUserId,
        input.interviewerId,
        input.createdByUserId,
        input.selectionStage,
        input.durationMinutes,
        input.availableFrom,
        input.availableUntil,
        input.dailyStartTime,
        input.dailyEndTime,
        input.responseDeadline,
        input.interviewFormat,
        input.locationText,
        SCHEDULE_REQUEST_STATUS.WAITING_STUDENT,
        now,
        now,
      );
    const requestId = Number(result.lastInsertRowid);
    const messageResult = db
      .prepare(
        `INSERT INTO messages (
           room_id, sender_id, body, type, schedule_request_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.roomId,
        input.createdByUserId,
        `${input.selectionStage}の日程を選択してください`,
        MESSAGE_TYPE.TEXT,
        requestId,
        now,
      );
    const messageId = Number(messageResult.lastInsertRowid);

    db.prepare(
      `UPDATE rooms
       SET last_message_id = ?, last_message_at = ?, handling_status = ?, urgency = ?
       WHERE id = ?`,
    ).run(messageId, now, HANDLING_STATUS.WAITING_STUDENT, URGENCY.LOW, input.roomId);
    db.prepare(`UPDATE students SET schedule_state = ?, updated_at = ? WHERE user_id = ?`).run(
      SCHEDULE_STATE.PROPOSED,
      now,
      input.studentUserId,
    );

    return { requestId, messageId };
  });

  try {
    const { requestId, messageId } = run();
    const request = findScheduleRequest(db, requestId);
    const message = db
      .prepare(
        `SELECT
           id, room_id AS roomId, sender_id AS senderId, body, type,
           topic_tag AS topicTag, client_msg_id AS clientMsgId,
           schedule_request_id AS scheduleRequestId,
           created_at AS createdAt, deleted_at AS deletedAt
         FROM messages WHERE id = ?`,
      )
      .get(messageId);
    return { request, message: { ...message, scheduleRequest: request } };
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ScheduleRequestError(
        'active_schedule_request_exists',
        'この学生には日程選択待ちの依頼がすでにあります',
        409,
      );
    }
    throw error;
  }
}

/** 期限切れ判定の単一の情報源。変更したrequestを返す。 */
export function expireWaitingScheduleRequests(db, requestId = null) {
  const now = new Date().toISOString();
  const records = requestId === null
    ? db
        .prepare(
          `${SCHEDULE_SELECT_SQL}
           WHERE sr.status = ? AND sr.response_deadline <= ?`,
        )
        .all(SCHEDULE_REQUEST_STATUS.WAITING_STUDENT, now)
    : db
        .prepare(
          `${SCHEDULE_SELECT_SQL}
           WHERE sr.id = ? AND sr.status = ? AND sr.response_deadline <= ?`,
        )
        .all(requestId, SCHEDULE_REQUEST_STATUS.WAITING_STUDENT, now);

  if (records.length === 0) return [];
  const update = db.prepare(
    `UPDATE schedule_requests
     SET status = ?, needs_attention = 0, updated_at = ?
     WHERE id = ? AND status = ?`,
  );
  const run = db.transaction(() => {
    for (const record of records) {
      update.run(
        SCHEDULE_REQUEST_STATUS.EXPIRED,
        now,
        record.id,
        SCHEDULE_REQUEST_STATUS.WAITING_STUDENT,
      );
      db.prepare(`UPDATE students SET schedule_state = ?, updated_at = ? WHERE user_id = ?`).run(
        SCHEDULE_STATE.NONE,
        now,
        record.studentUserId,
      );
    }
  });
  run();

  return records.map((record) => ({
    ...toScheduleRequest(record),
    status: SCHEDULE_REQUEST_STATUS.EXPIRED,
    needsAttention: false,
    updatedAt: now,
  }));
}
