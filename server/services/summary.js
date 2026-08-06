import { HANDLING_STATUS, URGENCY } from '../../shared/constants.js';
import { SLA_ALERT_HOURS } from './urgencyCalculator.js';

export function getSummary(db, now = Date.now()) {
  const overdueCutoff = new Date(now - SLA_ALERT_HOURS * 3_600_000).toISOString();

  return db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN handling_status = ? THEN 1 ELSE 0 END), 0) AS needsReply,
         COALESCE(SUM(CASE WHEN urgency = ? THEN 1 ELSE 0 END), 0) AS urgent,
         COALESCE(SUM(
           CASE
             WHEN last_student_message_at IS NOT NULL
              AND last_student_message_at <= ?
              AND handling_status NOT IN (?, ?)
             THEN 1 ELSE 0
           END
         ), 0) AS overdue24h,
         COALESCE(SUM(CASE WHEN assignee_user_id IS NULL THEN 1 ELSE 0 END), 0) AS unassigned
       FROM rooms`,
    )
    .get(
      HANDLING_STATUS.NEEDS_REPLY,
      URGENCY.HIGH,
      overdueCutoff,
      HANDLING_STATUS.WAITING_STUDENT,
      HANDLING_STATUS.DONE,
    );
}
