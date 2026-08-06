import {
  SORT_KEY,
  URGENCY,
} from '../../shared/constants.js';

const ROOM_SELECT_SQL = `
  SELECT
    r.id,
    r.handling_status          AS handlingStatus,
    r.urgency,
    r.is_pinned                AS isPinned,
    r.last_student_message_at  AS lastStudentMessageAt,
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
  LEFT JOIN users su ON su.id = r.student_user_id
  LEFT JOIN students st ON st.user_id = su.id
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
    CASE WHEN @sort = @defaultSort THEN r.is_pinned END DESC,
    CASE WHEN @sort = @defaultSort THEN
      CASE r.urgency
        WHEN @highUrgency THEN 0
        WHEN @normalUrgency THEN 1
        WHEN @lowUrgency THEN 2
        ELSE 3
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
    isPinned: Boolean(row.isPinned),
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
    unassignedMode: 'unassigned',
    assignedMode: 'assigned',
  };

  return db.prepare(ROOM_LIST_SQL).all(params).map(toRoom);
}

export function findRoomForUser(db, userId, roomId) {
  return toRoom(db.prepare(ROOM_DETAIL_SQL).get(userId, roomId));
}
