import {
  HANDLING_STATUS,
  MESSAGE_TYPE,
  SCHEDULE_REQUEST_STATUS,
  SCHEDULE_STATE,
} from '../../shared/constants.js';
import {
  findCalendarSlot,
  insertCalendarBooking,
} from './calendarGateway.js';
import {
  findScheduleRequest,
  findScheduleRequestRecord,
  ScheduleRequestError,
  scheduleOptionsFromRecord,
} from './scheduleRequests.js';

function conflictError() {
  return new ScheduleRequestError(
    'slot_already_booked',
    'この日時は受付終了しました。別の日時を選択してください。',
    409,
  );
}

function formatBookedSlot(slot) {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const date = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(start);
  const time = (value) => new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
  return `${date} ${time(start)}〜${time(end)}`;
}

export function bookScheduleRequest(db, { requestId, studentUserId, slotId }) {
  const initial = findScheduleRequestRecord(db, requestId);
  if (!initial || Number(initial.studentUserId) !== Number(studentUserId)) {
    throw new ScheduleRequestError('not_found', '日程調整が存在しません', 404);
  }
  if (initial.status === SCHEDULE_REQUEST_STATUS.EXPIRED) {
    throw new ScheduleRequestError('schedule_expired', '回答期限を過ぎています', 409);
  }
  if (initial.status !== SCHEDULE_REQUEST_STATUS.WAITING_STUDENT) {
    throw new ScheduleRequestError('schedule_not_bookable', 'この日程調整は予約できません', 409);
  }
  if (new Date(initial.responseDeadline).getTime() <= Date.now()) {
    db.prepare(`UPDATE schedule_requests SET status = ?, updated_at = ? WHERE id = ?`).run(
      SCHEDULE_REQUEST_STATUS.EXPIRED,
      new Date().toISOString(),
      requestId,
    );
    throw new ScheduleRequestError('schedule_expired', '回答期限を過ぎています', 409);
  }

  const run = db.transaction(() => {
    const record = findScheduleRequestRecord(db, requestId);
    if (record.status !== SCHEDULE_REQUEST_STATUS.WAITING_STUDENT) {
      throw new ScheduleRequestError('schedule_not_bookable', 'この日程調整は予約できません', 409);
    }

    const slot = findCalendarSlot(
      db,
      record.interviewerId,
      slotId,
      scheduleOptionsFromRecord(record),
    );
    if (!slot?.available) throw conflictError();

    let booking;
    try {
      booking = insertCalendarBooking(db, {
        scheduleRequestId: requestId,
        interviewerId: record.interviewerId,
        slot,
      });
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') throw conflictError();
      throw error;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE schedule_requests
       SET status = ?, booked_slot_id = ?, booked_starts_at = ?, booked_ends_at = ?,
           booked_at = ?, needs_attention = 0, updated_at = ?
       WHERE id = ?`,
    ).run(
      SCHEDULE_REQUEST_STATUS.BOOKED,
      slot.slotId,
      slot.startsAt,
      slot.endsAt,
      now,
      now,
      requestId,
    );
    db.prepare(
      `UPDATE students
       SET next_interview_at = ?, next_interview_room = ?, interviewer = ?,
           schedule_state = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      slot.startsAt,
      record.locationText,
      record.interviewerDisplayName,
      SCHEDULE_STATE.CONFIRMED,
      now,
      record.studentUserId,
    );

    // 学生には既存の日程カードを更新して確定日時を見せる。ここは人事だけが見える
    // 社内通知なので、面接官への連絡・会議室決定という次の作業を埋もれさせない。
    const body = `日程が確定しました（${formatBookedSlot(slot)}）。面接担当の方に連絡し、会議室を決定してください。`;
    const messageResult = db
      .prepare(
        `INSERT INTO messages (room_id, sender_id, body, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(record.roomId, record.createdByUserId, body, MESSAGE_TYPE.SYSTEM, now);
    const messageId = Number(messageResult.lastInsertRowid);
    db.prepare(
      `UPDATE rooms
       SET last_message_id = ?, last_message_at = ?, handling_status = ?
       WHERE id = ?`,
    ).run(messageId, now, HANDLING_STATUS.IN_PROGRESS, record.roomId);

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
    return { booking, slot, message, roomId: record.roomId, interviewerId: record.interviewerId };
  });

  const result = run();
  return { ...result, request: findScheduleRequest(db, requestId) };
}
