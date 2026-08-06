import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Database from 'better-sqlite3';
import {
  HANDLING_STATUS,
  INTERVIEW_FORMAT,
  MESSAGE_TYPE,
  ROLE,
  ROOM_TYPE,
  SCHEDULE_REQUEST_STATUS,
  SELECTION_STATUS,
  URGENCY,
} from '../../shared/constants.js';
import { listCalendarSlots } from './calendarGateway.js';
import { bookScheduleRequest } from './scheduleBookingService.js';

const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

function localIso(days, hour) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0).toISOString();
}

function setup() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  const now = new Date().toISOString();
  const insertUser = db.prepare(
    `INSERT INTO users (login_id, password_hash, display_name, role, created_at, updated_at)
     VALUES (?, 'hash', ?, ?, ?, ?)`,
  );
  const hrId = Number(insertUser.run('hr', '人事', ROLE.HR, now, now).lastInsertRowid);
  const studentIds = [1, 2].map((number) =>
    Number(insertUser.run(`student${number}`, `学生${number}`, ROLE.STUDENT, now, now).lastInsertRowid));
  const insertStudent = db.prepare(
    `INSERT INTO students (user_id, selection_status, updated_at) VALUES (?, ?, ?)`,
  );
  const insertRoom = db.prepare(
    `INSERT INTO rooms (type, student_user_id, handling_status, urgency, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const roomIds = studentIds.map((studentId) => {
    insertStudent.run(studentId, SELECTION_STATUS.INTERVIEW_1, now);
    return Number(
      insertRoom.run(
        ROOM_TYPE.DM,
        studentId,
        HANDLING_STATUS.WAITING_STUDENT,
        URGENCY.LOW,
        now,
      ).lastInsertRowid,
    );
  });
  const interviewerId = Number(
    db.prepare(
      `INSERT INTO calendar_interviewers (
         external_id, display_name, department, created_at, updated_at
       ) VALUES ('test-interviewer', '面接官', '開発部', ?, ?)`,
    ).run(now, now).lastInsertRowid,
  );
  const availableFrom = localIso(1, 10);
  const availableUntil = localIso(1, 12);
  const insertRequest = db.prepare(
    `INSERT INTO schedule_requests (
       room_id, student_user_id, interviewer_id, created_by_user_id,
       selection_stage, duration_minutes, available_from, available_until,
       daily_start_time, daily_end_time, response_deadline,
       interview_format, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, '一次面接', 60, ?, ?, '10:00', '12:00', ?, ?, ?, ?, ?)`,
  );
  const requestIds = studentIds.map((studentId, index) =>
    Number(
      insertRequest.run(
        roomIds[index],
        studentId,
        interviewerId,
        hrId,
        availableFrom,
        availableUntil,
        new Date(Date.now() + 3_600_000).toISOString(),
        INTERVIEW_FORMAT.ONLINE,
        SCHEDULE_REQUEST_STATUS.WAITING_STUDENT,
        now,
        now,
      ).lastInsertRowid,
    ));

  return { db, studentIds, requestIds, interviewerId, availableFrom, availableUntil };
}

test('擬似カレンダーは既存予定と予約済み枠を受付終了として返す', () => {
  const context = setup();
  const { db, interviewerId, availableFrom, availableUntil } = context;
  db.prepare(
    `INSERT INTO calendar_events (interviewer_id, starts_at, ends_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(interviewerId, availableFrom, new Date(new Date(availableFrom).getTime() + 60 * 60_000).toISOString(), new Date().toISOString());

  const result = listCalendarSlots(db, interviewerId, {
    from: availableFrom,
    to: availableUntil,
    durationMinutes: 60,
    dailyStartTime: '10:00',
    dailyEndTime: '12:00',
  });
  assert.equal(result.slots.length, 2);
  assert.equal(result.slots[0].available, false);
  assert.equal(result.slots[1].available, true);
  db.close();
});

test('同じ枠への同時相当の予約は一方だけ成功し、プロフィールも同期する', () => {
  const context = setup();
  const { db, studentIds, requestIds, interviewerId, availableFrom, availableUntil } = context;
  const slot = listCalendarSlots(db, interviewerId, {
    from: availableFrom,
    to: availableUntil,
    durationMinutes: 60,
    dailyStartTime: '10:00',
    dailyEndTime: '12:00',
  }).slots.find((candidate) => candidate.available);

  const booked = bookScheduleRequest(db, {
    requestId: requestIds[0],
    studentUserId: studentIds[0],
    slotId: slot.slotId,
  });
  assert.equal(booked.request.status, SCHEDULE_REQUEST_STATUS.BOOKED);
  assert.equal(
    db.prepare(`SELECT handling_status AS handlingStatus FROM rooms WHERE id = ?`).get(booked.request.roomId).handlingStatus,
    HANDLING_STATUS.IN_PROGRESS,
  );
  const notification = db
    .prepare(`SELECT body, type FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT 1`)
    .get(booked.request.roomId);
  assert.equal(notification.type, MESSAGE_TYPE.SYSTEM);
  assert.match(notification.body, /面接担当の方に連絡し、会議室を決定してください。/);
  assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM calendar_bookings`).get().count, 1);
  assert.equal(
    db.prepare(`SELECT next_interview_at AS nextInterviewAt FROM students WHERE user_id = ?`).get(studentIds[0]).nextInterviewAt,
    slot.startsAt,
  );

  assert.throws(
    () => bookScheduleRequest(db, {
      requestId: requestIds[1],
      studentUserId: studentIds[1],
      slotId: slot.slotId,
    }),
    (error) => error.statusCode === 409 && error.code === 'slot_already_booked',
  );
  assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM calendar_bookings`).get().count, 1);
  db.close();
});
