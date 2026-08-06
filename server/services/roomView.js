import {
  AI_ANALYSIS_STATUS,
  AI_RECOMMENDED_PRIORITY,
  HANDLING_STATUS,
  ROLE,
  SORT_KEY,
  URGENCY,
} from '../../shared/constants.js';

const ROOM_SELECT_SQL = `
  SELECT
    r.id,
    r.handling_status          AS handlingStatus,
    r.urgency,
    r.last_student_message_at  AS lastStudentMessageAt,
    r.ai_priority              AS aiPriority,
    r.ai_priority_reason       AS aiPriorityReason,
    r.ai_requested_action      AS aiRequestedAction,
    r.ai_context_summary       AS aiContextSummary,
    r.ai_analyzed_message_id   AS aiAnalyzedMessageId,
    r.ai_analyzed_at           AS aiAnalyzedAt,
    r.ai_analysis_status       AS aiAnalysisStatus,
    viewer.role                AS viewerRole,
    su.id                      AS studentUserId,
    su.display_name            AS studentDisplayName,
    su.avatar_color            AS studentAvatarColor,
    st.university              AS studentUniversity,
    st.faculty                 AS studentFaculty,
    st.grad_year               AS studentGradYear,
    st.selection_status        AS studentSelectionStatus,
    st.next_interview_at       AS nextInterviewAt,
    st.next_interview_room     AS nextInterviewRoom,
    st.interviewer,
    st.schedule_state          AS scheduleState,
    sr.id                      AS scheduleRequestId,
    sr.status                  AS scheduleRequestStatus,
    sr.selection_stage         AS scheduleSelectionStage,
    sr.response_deadline       AS scheduleResponseDeadline,
    sr.booked_starts_at        AS scheduleBookedStartsAt,
    sr.booked_ends_at          AS scheduleBookedEndsAt,
    sr.needs_attention         AS scheduleNeedsAttention,
    ci.display_name            AS scheduleInterviewerName,
    au.id                      AS assigneeId,
    au.display_name            AS assigneeDisplayName,
    lm.id                      AS lastMessageId,
    lm.body                    AS lastMessageBody,
    lm.created_at              AS lastMessageCreatedAt,
    lm.sender_id               AS lastMessageSenderId,
    sm.topic_tag               AS topicTag,
    (
      SELECT COUNT(*)
      FROM messages m
      WHERE m.room_id = r.id
        AND m.deleted_at IS NULL
        AND m.id > rm.last_read_message_id
        AND m.sender_id != rm.user_id
    ) AS unreadCount
  FROM rooms r
  JOIN room_members rm ON rm.room_id = r.id
  JOIN users viewer ON viewer.id = rm.user_id
  LEFT JOIN users su ON su.id = r.student_user_id
  LEFT JOIN students st ON st.user_id = su.id
  LEFT JOIN schedule_requests sr ON sr.id = (
    SELECT request.id
    FROM schedule_requests request
    WHERE request.room_id = r.id
    ORDER BY request.id DESC
    LIMIT 1
  )
  LEFT JOIN calendar_interviewers ci ON ci.id = sr.interviewer_id
  LEFT JOIN users au ON au.id = r.assignee_user_id
  LEFT JOIN messages lm ON lm.id = r.last_message_id
  LEFT JOIN messages sm ON sm.id = (
    SELECT m.id
    FROM messages m
    WHERE m.room_id = r.id
      AND m.sender_id = r.student_user_id
      AND m.deleted_at IS NULL
    ORDER BY m.id DESC
    LIMIT 1
  )
`;

const ROOM_LIST_SQL = `${ROOM_SELECT_SQL}
  WHERE rm.user_id = @userId
    AND (
      @handlingStatuses IS NULL
      OR r.handling_status IN (SELECT value FROM json_each(@handlingStatuses))
    )
    AND (
      @selectionStatuses IS NULL
      OR st.selection_status IN (SELECT value FROM json_each(@selectionStatuses))
    )
    AND (
      @topicTags IS NULL
      OR sm.topic_tag IN (SELECT value FROM json_each(@topicTags))
    )
    AND (
      @urgencies IS NULL
      OR r.urgency IN (SELECT value FROM json_each(@urgencies))
    )
    AND (
      @assigneeMode IS NULL
      OR (@assigneeMode = @unassignedMode AND r.assignee_user_id IS NULL)
      OR (@assigneeMode = @assignedMode AND r.assignee_user_id = @assigneeId)
    )
    AND (
      @queryPattern IS NULL
      OR su.display_name LIKE @queryPattern
      OR st.university LIKE @queryPattern
    )
  ORDER BY
    CASE WHEN @sort = @defaultSort THEN
      CASE
        WHEN r.urgency = @highUrgency THEN 0
        WHEN r.ai_analysis_status = @completedAiStatus
          AND r.ai_priority = @highAiPriority
          AND r.handling_status IN (@needsReplyStatus, @inProgressStatus) THEN 1
        WHEN r.urgency = @normalUrgency THEN 2
        WHEN r.urgency = @lowUrgency THEN 3
        ELSE 4
      END
    END ASC,
    CASE WHEN @sort = @defaultSort THEN r.last_student_message_at END ASC,
    CASE WHEN @sort = @lastMessageSort THEN r.last_message_at END DESC,
    CASE WHEN @sort = @elapsedSort THEN r.last_student_message_at END ASC,
    r.id ASC
`;

const ROOM_DETAIL_SQL = `${ROOM_SELECT_SQL}
  WHERE rm.user_id = ? AND r.id = ?
`;

function elapsedHours(isoString) {
  if (!isoString) return null;
  const elapsedMs = Date.now() - new Date(isoString).getTime();
  return Math.round((elapsedMs / 3_600_000) * 10) / 10;
}

export function toRoom(row) {
  if (!row) return null;

  const canViewAiRecommendation = row.viewerRole === ROLE.HR || row.viewerRole === ROLE.ADMIN;

  return {
    id: row.id,
    student: {
      userId: row.studentUserId,
      displayName: row.studentDisplayName,
      university: row.studentUniversity,
      faculty: row.studentFaculty,
      gradYear: row.studentGradYear,
      selectionStatus: row.studentSelectionStatus,
      avatarColor: row.studentAvatarColor,
      nextInterviewAt: row.nextInterviewAt,
      nextInterviewRoom: row.nextInterviewRoom,
      interviewer: row.interviewer,
      scheduleState: row.scheduleState,
    },
    handlingStatus: row.handlingStatus,
    urgency: row.urgency,
    topicTag: row.topicTag,
    assignee: row.assigneeId
      ? { id: row.assigneeId, displayName: row.assigneeDisplayName }
      : null,
    unreadCount: row.unreadCount,
    lastMessage: row.lastMessageId
      ? {
          id: row.lastMessageId,
          body: row.lastMessageBody,
          createdAt: row.lastMessageCreatedAt,
          senderId: row.lastMessageSenderId,
        }
      : null,
    lastStudentMessageAt: row.lastStudentMessageAt,
    elapsedHours: elapsedHours(row.lastStudentMessageAt),
    scheduleRequest: row.scheduleRequestId
      ? {
          id: row.scheduleRequestId,
          status: row.scheduleRequestStatus,
          selectionStage: row.scheduleSelectionStage,
          responseDeadline: row.scheduleResponseDeadline,
          bookedStartsAt: row.scheduleBookedStartsAt,
          bookedEndsAt: row.scheduleBookedEndsAt,
          needsAttention: Boolean(row.scheduleNeedsAttention),
          interviewerName: row.scheduleInterviewerName,
        }
      : null,
    aiRecommendation: canViewAiRecommendation
      ? {
          status: row.aiAnalysisStatus ?? AI_ANALYSIS_STATUS.SKIPPED,
          priority: row.aiPriority ?? null,
          reason: row.aiPriorityReason ?? null,
          requestedAction: row.aiRequestedAction ?? null,
          contextSummary: row.aiContextSummary ?? null,
          analyzedMessageId: row.aiAnalyzedMessageId ?? null,
          analyzedAt: row.aiAnalyzedAt ?? null,
        }
      : {
          status: AI_ANALYSIS_STATUS.SKIPPED,
          priority: null,
          reason: null,
          requestedAction: null,
          contextSummary: null,
          analyzedMessageId: null,
          analyzedAt: null,
        },
  };
}

export function listRoomsForUser(db, filters) {
  const params = {
    ...filters,
    defaultSort: SORT_KEY.DEFAULT,
    lastMessageSort: SORT_KEY.LAST_MESSAGE,
    elapsedSort: SORT_KEY.ELAPSED,
    highUrgency: URGENCY.HIGH,
    normalUrgency: URGENCY.NORMAL,
    lowUrgency: URGENCY.LOW,
    completedAiStatus: AI_ANALYSIS_STATUS.COMPLETED,
    highAiPriority: AI_RECOMMENDED_PRIORITY.HIGH,
    needsReplyStatus: HANDLING_STATUS.NEEDS_REPLY,
    inProgressStatus: HANDLING_STATUS.IN_PROGRESS,
    unassignedMode: 'unassigned',
    assignedMode: 'assigned',
  };

  return db.prepare(ROOM_LIST_SQL).all(params).map(toRoom);
}

export function findRoomForUser(db, userId, roomId) {
  return toRoom(db.prepare(ROOM_DETAIL_SQL).get(userId, roomId));
}
