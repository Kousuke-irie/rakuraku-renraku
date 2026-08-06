import { AI_ANALYSIS_STATUS } from '../../shared/constants.js';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/gemini.js';
import { emitRoomUpdated } from './realtime.js';
import { classifyAiPriority } from './aiPriorityClassifier.js';
import { buildAiPriorityContext, buildRecentMessages } from './aiPriorityInputBuilder.js';

const LATEST_STUDENT_MESSAGE_GUARD = `
  ? = (
    SELECT m.id
    FROM messages m
    WHERE m.room_id = rooms.id
      AND m.sender_id = rooms.student_user_id
      AND m.deleted_at IS NULL
    ORDER BY m.id DESC
    LIMIT 1
  )
`;

function setInitialStatus(db, { roomId, messageId, status }) {
  return db
    .prepare(
      `UPDATE rooms
       SET ai_priority = NULL,
           ai_priority_reason = NULL,
           ai_requested_action = NULL,
           ai_context_summary = NULL,
           ai_analyzed_message_id = ?,
           ai_analyzed_at = ?,
           ai_model = NULL,
           ai_analysis_status = ?
       WHERE id = ? AND ${LATEST_STUDENT_MESSAGE_GUARD}`,
    )
    .run(
      messageId,
      status === AI_ANALYSIS_STATUS.SKIPPED ? new Date().toISOString() : null,
      status,
      roomId,
      messageId,
    );
}

function saveCompleted(db, { roomId, messageId, result, model }) {
  return db
    .prepare(
      `UPDATE rooms
       SET ai_priority = ?,
           ai_priority_reason = ?,
           ai_requested_action = ?,
           ai_context_summary = ?,
           ai_analyzed_at = ?,
           ai_model = ?,
           ai_analysis_status = ?
       WHERE id = ? AND ai_analyzed_message_id = ?`,
    )
    .run(
      result.priority,
      result.reason,
      result.requestedAction,
      result.contextSummary,
      new Date().toISOString(),
      model,
      AI_ANALYSIS_STATUS.COMPLETED,
      roomId,
      messageId,
    );
}

function saveFailed(db, { roomId, messageId, model }) {
  return db
    .prepare(
      `UPDATE rooms
       SET ai_priority = NULL,
           ai_priority_reason = NULL,
           ai_requested_action = NULL,
           ai_context_summary = NULL,
           ai_analyzed_at = ?,
           ai_model = ?,
           ai_analysis_status = ?
       WHERE id = ? AND ai_analyzed_message_id = ?`,
    )
    .run(
      new Date().toISOString(),
      model,
      AI_ANALYSIS_STATUS.FAILED,
      roomId,
      messageId,
    );
}

export async function analyzeStudentMessage(
  db,
  io,
  { roomId, messageId },
  { apiKey = GEMINI_API_KEY, model = GEMINI_MODEL, classifier = classifyAiPriority } = {},
) {
  const context = buildAiPriorityContext(db, { roomId, messageId });
  if (!context) return;
  if (
    context.analyzedMessageId === messageId &&
    [AI_ANALYSIS_STATUS.COMPLETED, AI_ANALYSIS_STATUS.SKIPPED].includes(context.analysisStatus)
  ) {
    return;
  }

  if (!apiKey || context.shouldSkip) {
    const skipped = setInitialStatus(db, { roomId, messageId, status: AI_ANALYSIS_STATUS.SKIPPED });
    if (skipped.changes > 0) await emitRoomUpdated(io, db, roomId);
    return;
  }

  const pending = setInitialStatus(db, { roomId, messageId, status: AI_ANALYSIS_STATUS.PENDING });
  if (pending.changes === 0) return;
  await emitRoomUpdated(io, db, roomId);

  try {
    const result = await classifier({
      minimalInput: context.minimalInput,
      recentMessagesProvider: () => buildRecentMessages(db, { roomId, messageId }),
      apiKey,
      model,
    });
    const saved = saveCompleted(db, { roomId, messageId, result, model });
    if (saved.changes > 0) await emitRoomUpdated(io, db, roomId);
  } catch (error) {
    const saved = saveFailed(db, { roomId, messageId, model });
    if (saved.changes > 0) await emitRoomUpdated(io, db, roomId);
    console.warn(
      `server: AI priority analysis failed` +
        ` (type=${error?.name ?? 'Error'}, http=${error?.httpStatus ?? '-'}, api=${error?.apiStatus ?? '-'})`,
    );
  }
}

export function queueStudentMessageAnalysis(db, io, message) {
  void analyzeStudentMessage(db, io, {
    roomId: Number(message.roomId),
    messageId: Number(message.id),
  }).catch((error) => {
    console.warn(`server: AI priority queue failed (type=${error?.name ?? 'Error'})`);
  });
}
