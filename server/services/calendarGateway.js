import {
  DEFAULT_DAILY_END_TIME,
  DEFAULT_DAILY_START_TIME,
  SCHEDULE_REQUEST_STATUS,
} from '../../shared/constants.js';

const JST_OFFSET = '+09:00';
const MAX_RANGE_DAYS = 62;
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 480;

export class CalendarGatewayError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'CalendarGatewayError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function parseTime(value, fallback) {
  const source = value ?? fallback;
  const match = /^(\d{2}):(\d{2})$/.exec(source);
  if (!match) throw new CalendarGatewayError('invalid_time', '予約可能時間帯が不正です');

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new CalendarGatewayError('invalid_time', '予約可能時間帯が不正です');
  }
  return hours * 60 + minutes;
}

function jstDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function toDateKey(date) {
  const { year, month, day } = jstDateParts(date);
  return `${year}-${month}-${day}`;
}

function addDateKeyDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function dateAtJstMinutes(dateKey, minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return new Date(`${dateKey}T${hours}:${mins}:00${JST_OFFSET}`);
}

function slotIdFor(interviewerId, startsAt) {
  const compact = startsAt.toISOString().replace(/[-:]/g, '').slice(0, 13);
  return `interviewer-${interviewerId}-${compact}Z`;
}

function parseRange({ from, to, durationMinutes, dailyStartTime, dailyEndTime }) {
  const startsAt = new Date(from);
  const endsAt = new Date(to);
  const duration = Number(durationMinutes);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt ||
    !Number.isInteger(duration) ||
    duration < MIN_DURATION_MINUTES ||
    duration > MAX_DURATION_MINUTES
  ) {
    throw new CalendarGatewayError('invalid_range', '候補期間または面接時間が不正です');
  }

  const rangeDays = (endsAt.getTime() - startsAt.getTime()) / 86_400_000;
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new CalendarGatewayError('range_too_large', '候補期間は62日以内で指定してください');
  }

  const startMinutes = parseTime(dailyStartTime, DEFAULT_DAILY_START_TIME);
  const endMinutes = parseTime(dailyEndTime, DEFAULT_DAILY_END_TIME);
  if (startMinutes >= endMinutes || startMinutes + duration > endMinutes) {
    throw new CalendarGatewayError('invalid_time_range', '予約可能時間帯が面接時間より短いです');
  }

  return { startsAt, endsAt, duration, startMinutes, endMinutes };
}

export function listInterviewers(db) {
  return db
    .prepare(
      `SELECT id, external_id AS externalId, display_name AS displayName, department
       FROM calendar_interviewers
       WHERE is_active = 1
       ORDER BY id`,
    )
    .all();
}

export function findInterviewer(db, interviewerId) {
  return db
    .prepare(
      `SELECT id, external_id AS externalId, display_name AS displayName, department
       FROM calendar_interviewers
       WHERE id = ? AND is_active = 1`,
    )
    .get(interviewerId);
}

export function listCalendarSlots(db, interviewerId, options) {
  const interviewer = findInterviewer(db, interviewerId);
  if (!interviewer) {
    throw new CalendarGatewayError('interviewer_not_found', '面接官が存在しません', 404);
  }

  const { startsAt, endsAt, duration, startMinutes, endMinutes } = parseRange(options);
  const events = db
    .prepare(
      `SELECT starts_at AS startsAt, ends_at AS endsAt
       FROM calendar_events
       WHERE interviewer_id = ? AND starts_at < ? AND ends_at > ?`,
    )
    .all(interviewerId, endsAt.toISOString(), startsAt.toISOString());
  const bookings = db
    .prepare(
      `SELECT external_slot_id AS slotId, starts_at AS startsAt, ends_at AS endsAt
       FROM calendar_bookings
       WHERE interviewer_id = ? AND starts_at < ? AND ends_at > ?`,
    )
    .all(interviewerId, endsAt.toISOString(), startsAt.toISOString());
  const bookedIds = new Set(bookings.map((booking) => booking.slotId));
  const busyRanges = [...events, ...bookings].map((item) => ({
    start: new Date(item.startsAt).getTime(),
    end: new Date(item.endsAt).getTime(),
  }));

  const slots = [];
  const now = Date.now();
  const firstDate = toDateKey(startsAt);
  const lastDate = toDateKey(endsAt);
  for (let dayOffset = 0; dayOffset <= MAX_RANGE_DAYS; dayOffset += 1) {
    const dateKey = addDateKeyDays(firstDate, dayOffset);
    if (dateKey > lastDate) break;

    for (let minute = startMinutes; minute + duration <= endMinutes; minute += duration) {
      const slotStartsAt = dateAtJstMinutes(dateKey, minute);
      const slotEndsAt = new Date(slotStartsAt.getTime() + duration * 60_000);
      if (slotStartsAt < startsAt || slotEndsAt > endsAt) continue;

      const slotId = slotIdFor(interviewerId, slotStartsAt);
      const overlapsBusy = busyRanges.some(
        (range) => slotStartsAt.getTime() < range.end && slotEndsAt.getTime() > range.start,
      );
      slots.push({
        slotId,
        startsAt: slotStartsAt.toISOString(),
        endsAt: slotEndsAt.toISOString(),
        available: slotStartsAt.getTime() > now && !overlapsBusy && !bookedIds.has(slotId),
      });
    }
  }

  return {
    interviewerId: interviewer.id,
    generatedAt: new Date().toISOString(),
    slots,
  };
}

export function findCalendarSlot(db, interviewerId, slotId, options) {
  return listCalendarSlots(db, interviewerId, options).slots.find((slot) => slot.slotId === slotId) ?? null;
}

/** 呼び出し元のSQLiteトランザクション内で使う原子的な予約登録。 */
export function insertCalendarBooking(db, { scheduleRequestId, interviewerId, slot }) {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO calendar_bookings (
         schedule_request_id, interviewer_id, external_slot_id,
         starts_at, ends_at, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      scheduleRequestId,
      interviewerId,
      slot.slotId,
      slot.startsAt,
      slot.endsAt,
      SCHEDULE_REQUEST_STATUS.BOOKED,
      createdAt,
    );

  return {
    bookingId: Number(result.lastInsertRowid),
    slotId: slot.slotId,
    status: SCHEDULE_REQUEST_STATUS.BOOKED,
  };
}
