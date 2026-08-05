// P1-1: 受信箱一覧・ルーム詳細。
// フィルタ・ステータス変更・既読(PATCH/read)はP1-7/P1-2/P2-7スコープのため対象外。
import { Router } from 'express';
import db from '../db/db.js';
import { tempAuth } from '../middleware/tempAuth.js';
import { assertRoomMember, RoomAccessDeniedError } from '../services/roomAuth.js';

const router = Router();

const ROOM_LIST_SQL = `
  SELECT
    r.id,
    r.handling_status        AS handlingStatus,
    r.urgency,
    r.is_pinned               AS isPinned,
    r.last_student_message_at AS lastStudentMessageAt,
    su.id                     AS studentUserId,
    su.display_name           AS studentDisplayName,
    su.avatar_color           AS studentAvatarColor,
    st.university             AS studentUniversity,
    st.selection_status       AS studentSelectionStatus,
    au.id                     AS assigneeId,
    au.display_name           AS assigneeDisplayName,
    lm.id                     AS lastMessageId,
    lm.body                   AS lastMessageBody,
    lm.created_at             AS lastMessageCreatedAt,
    lm.sender_id              AS lastMessageSenderId,
    lm.topic_tag              AS topicTag,
    (
      SELECT COUNT(*) FROM messages m
      WHERE m.room_id = r.id
        AND m.deleted_at IS NULL
        AND m.id > rm.last_read_message_id
        AND m.sender_id != rm.user_id
    ) AS unreadCount
  FROM rooms r
  JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
  LEFT JOIN users su ON su.id = r.student_user_id
  LEFT JOIN students st ON st.user_id = su.id
  LEFT JOIN users au ON au.id = r.assignee_user_id
  LEFT JOIN messages lm ON lm.id = r.last_message_id
`;

const ROOM_LIST_ORDER_SQL = `
  ORDER BY
    r.is_pinned DESC,
    CASE r.urgency WHEN 'high' THEN 0 WHEN 'normal' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
    r.last_student_message_at ASC
`;

function elapsedHours(isoString) {
  if (!isoString) return null;
  const elapsedMs = Date.now() - new Date(isoString).getTime();
  return Math.round((elapsedMs / 3_600_000) * 10) / 10;
}

function toRoomListItem(row) {
  return {
    id: row.id,
    student: {
      userId: row.studentUserId,
      displayName: row.studentDisplayName,
      university: row.studentUniversity,
      selectionStatus: row.studentSelectionStatus,
      avatarColor: row.studentAvatarColor,
    },
    handlingStatus: row.handlingStatus,
    urgency: row.urgency,
    topicTag: row.topicTag,
    isPinned: !!row.isPinned,
    assignee: row.assigneeId ? { id: row.assigneeId, displayName: row.assigneeDisplayName } : null,
    unreadCount: row.unreadCount,
    lastMessage: row.lastMessageId
      ? { id: row.lastMessageId, body: row.lastMessageBody, createdAt: row.lastMessageCreatedAt, senderId: row.lastMessageSenderId }
      : null,
    lastStudentMessageAt: row.lastStudentMessageAt,
    elapsedHours: elapsedHours(row.lastStudentMessageAt),
  };
}

router.get('/', tempAuth, (req, res) => {
  const rows = db.prepare(ROOM_LIST_SQL + ROOM_LIST_ORDER_SQL).all(req.user.id);
  res.json({ rooms: rows.map(toRoomListItem) });
});

router.get('/:id', tempAuth, (req, res) => {
  const roomId = Number(req.params.id);

  try {
    assertRoomMember(db, req.user.id, roomId);
  } catch (err) {
    if (err instanceof RoomAccessDeniedError) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    throw err;
  }

  const row = db.prepare(`${ROOM_LIST_SQL} WHERE r.id = ?`).get(req.user.id, roomId);

  if (!row) {
    return res.status(404).json({ success: false, error: 'room not found' });
  }

  res.json({ room: toRoomListItem(row) });
});

export default router;
