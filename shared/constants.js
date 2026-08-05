// 列挙値の単一の情報源。client / server はここから import する。
// 値をコード内に文字列リテラルで直接書かないこと（.claude/constants.md 参照）。

export const ROLE = Object.freeze({
  HR: 'hr',
  STUDENT: 'student',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.values(ROLE);

export const ROOM_TYPE = Object.freeze({
  DM: 'dm',
  GROUP: 'group',
});

export const ROOM_TYPE_VALUES = Object.values(ROOM_TYPE);

export const HANDLING_STATUS = Object.freeze({
  NEEDS_REPLY: 'needs_reply',
  IN_PROGRESS: 'in_progress',
  WAITING_STUDENT: 'waiting_student',
  DONE: 'done',
  ON_HOLD: 'on_hold',
});

export const HANDLING_STATUS_META = Object.freeze({
  [HANDLING_STATUS.NEEDS_REPLY]: { label: '要返信', color: '#E5484D' },
  [HANDLING_STATUS.IN_PROGRESS]: { label: '対応中', color: '#F5A623' },
  [HANDLING_STATUS.WAITING_STUDENT]: { label: '返信待ち', color: '#4A90D9' },
  [HANDLING_STATUS.DONE]: { label: '完了', color: '#3EA76B' },
  [HANDLING_STATUS.ON_HOLD]: { label: '保留', color: '#8B8D98' },
});

export const HANDLING_STATUS_VALUES = Object.values(HANDLING_STATUS);

export const SELECTION_STATUS = Object.freeze({
  ENTRY: 'entry',
  DOCUMENT: 'document',
  APTITUDE: 'aptitude',
  INTERVIEW_1: 'interview_1',
  INTERVIEW_2: 'interview_2',
  INTERVIEW_3: 'interview_3',
  INTERVIEW_4: 'interview_4',
  INTERVIEW_5: 'interview_5',
  OFFER: 'offer',
  DECLINED: 'declined',
});

export const SELECTION_STATUS_META = Object.freeze({
  [SELECTION_STATUS.ENTRY]: { label: 'エントリー' },
  [SELECTION_STATUS.DOCUMENT]: { label: '書類' },
  [SELECTION_STATUS.APTITUDE]: { label: '適性検査' },
  [SELECTION_STATUS.INTERVIEW_1]: { label: '一次面接' },
  [SELECTION_STATUS.INTERVIEW_2]: { label: '二次面接' },
  [SELECTION_STATUS.INTERVIEW_3]: { label: '三次面接' },
  [SELECTION_STATUS.INTERVIEW_4]: { label: '四次面接' },
  [SELECTION_STATUS.INTERVIEW_5]: { label: '五次面接' },
  [SELECTION_STATUS.OFFER]: { label: '内定' },
  [SELECTION_STATUS.DECLINED]: { label: '辞退' },
});

export const SELECTION_STATUS_VALUES = Object.values(SELECTION_STATUS);

export const TOPIC_TAG = Object.freeze({
  ABSENCE_LATE: 'absence_late',
  SCHEDULING: 'scheduling',
  APTITUDE_TEST: 'aptitude_test',
  RESULT_WAITING: 'result_waiting',
  QUESTION: 'question',
  OTHER: 'other',
});

export const TOPIC_TAG_META = Object.freeze({
  [TOPIC_TAG.ABSENCE_LATE]: { label: '欠席・遅刻', priority: 1 },
  [TOPIC_TAG.SCHEDULING]: { label: '日程調整', priority: 2 },
  [TOPIC_TAG.APTITUDE_TEST]: { label: '適性検査', priority: 3 },
  [TOPIC_TAG.RESULT_WAITING]: { label: '合否待ち', priority: 4 },
  [TOPIC_TAG.QUESTION]: { label: '質問', priority: 5 },
  [TOPIC_TAG.OTHER]: { label: 'その他', priority: 99 },
});

export const TOPIC_TAG_VALUES = Object.values(TOPIC_TAG);

export const URGENCY = Object.freeze({
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
});

export const URGENCY_META = Object.freeze({
  [URGENCY.HIGH]: { label: '緊急' },
  [URGENCY.NORMAL]: { label: '通常' },
  [URGENCY.LOW]: { label: '低' },
});

export const URGENCY_VALUES = Object.values(URGENCY);

export const SCHEDULE_STATE = Object.freeze({
  NONE: 'none',
  PROPOSED: 'proposed',
  INTERVIEWER_CHECK: 'interviewer_check',
  ROOM_PENDING: 'room_pending',
  CONFIRMED: 'confirmed',
});

export const SCHEDULE_STATE_META = Object.freeze({
  [SCHEDULE_STATE.NONE]: { label: '対象外' },
  [SCHEDULE_STATE.PROPOSED]: { label: '候補日提示済' },
  [SCHEDULE_STATE.INTERVIEWER_CHECK]: { label: '面接官確認中' },
  [SCHEDULE_STATE.ROOM_PENDING]: { label: '会議室未押さえ' },
  [SCHEDULE_STATE.CONFIRMED]: { label: '確定' },
});

export const SCHEDULE_STATE_VALUES = Object.values(SCHEDULE_STATE);

export const MESSAGE_TYPE = Object.freeze({
  TEXT: 'text',
  SYSTEM: 'system',
});

export const MESSAGE_TYPE_VALUES = Object.values(MESSAGE_TYPE);

export const MEMO_SCOPE = Object.freeze({
  PRIVATE: 'private',
  SHARED: 'shared',
});

export const MEMO_SCOPE_META = Object.freeze({
  [MEMO_SCOPE.PRIVATE]: { label: '個人メモ' },
  [MEMO_SCOPE.SHARED]: { label: '共有メモ' },
});

export const MEMO_SCOPE_VALUES = Object.values(MEMO_SCOPE);

// ---------------------------------------------------------------------------
// 一覧の並び順（P1-7 / business-logic.md §6）
// ---------------------------------------------------------------------------

export const SORT_KEY = Object.freeze({
  // 既定：is_pinned DESC → urgency → last_student_message_at ASC
  DEFAULT: 'default',
  // 最終メッセージ時刻の新しい順
  LAST_MESSAGE: 'last_message',
  // 経過時間の長い順
  ELAPSED: 'elapsed',
});

export const SORT_KEY_META = Object.freeze({
  [SORT_KEY.DEFAULT]: { label: '緊急度順' },
  [SORT_KEY.LAST_MESSAGE]: { label: '最終メッセージ順' },
  [SORT_KEY.ELAPSED]: { label: '経過時間順' },
});

export const SORT_KEY_VALUES = Object.values(SORT_KEY);

export const DEFAULT_SORT_KEY = SORT_KEY.DEFAULT;

// 緊急度のソート順（小さいほど上位）。比較のたびに配列を組み立てないためのマップ。
export const URGENCY_ORDER = Object.freeze({
  [URGENCY.HIGH]: 0,
  [URGENCY.NORMAL]: 1,
  [URGENCY.LOW]: 2,
});

// ---------------------------------------------------------------------------
// 送信状態（B-3 / frontend.md §7）※クライアント内部の状態。DB には保存しない
// ---------------------------------------------------------------------------

export const SEND_STATUS = Object.freeze({
  SENDING: 'sending',
  SENT: 'sent',
  READ: 'read',
  FAILED: 'failed',
});

export const SEND_STATUS_META = Object.freeze({
  [SEND_STATUS.SENDING]: { label: '送信中' },
  [SEND_STATUS.SENT]: { label: '送信済' },
  [SEND_STATUS.READ]: { label: '既読' },
  [SEND_STATUS.FAILED]: { label: '送信失敗' },
});

export const SEND_STATUS_VALUES = Object.values(SEND_STATUS);

// ---------------------------------------------------------------------------
// 初期値
// ---------------------------------------------------------------------------

export const DEFAULT_HANDLING_STATUS = HANDLING_STATUS.NEEDS_REPLY;
export const DEFAULT_SELECTION_STATUS = SELECTION_STATUS.ENTRY;
export const DEFAULT_TOPIC_TAG = TOPIC_TAG.OTHER;
export const DEFAULT_URGENCY = URGENCY.NORMAL;
export const DEFAULT_SCHEDULE_STATE = SCHEDULE_STATE.NONE;
export const DEFAULT_MEMO_SCOPE = MEMO_SCOPE.PRIVATE;

// ---------------------------------------------------------------------------
// SLA 閾値（P1-4 / business-logic.md §3）
// サーバは環境変数 SLA_WARN_HOURS / SLA_ALERT_HOURS で上書きする。ここは既定値。
// ---------------------------------------------------------------------------

export const SLA_WARN_HOURS = 12;
export const SLA_ALERT_HOURS = 24;

// 経過時間バッジを表示しない対応ステータス（返信済み・完了は SLA の対象外）
export const ELAPSED_BADGE_HIDDEN_STATUSES = Object.freeze([
  HANDLING_STATUS.WAITING_STUDENT,
  HANDLING_STATUS.DONE,
]);

// ---------------------------------------------------------------------------
// Socket.IO イベント名（api.md §3）
// client / server の双方がここから import する。文字列を直書きしないこと。
// ---------------------------------------------------------------------------

// Client → Server
export const SOCKET_EMIT = Object.freeze({
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  MESSAGE_SEND: 'message:send',
  MESSAGE_READ: 'message:read',
  ROOM_STATUS_UPDATE: 'room:status_update',
});

// Server → Client
export const SOCKET_ON = Object.freeze({
  MESSAGE_NEW: 'message:new',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_DELETED: 'message:deleted',
  READ_UPDATED: 'read:updated',
  ROOM_UPDATED: 'room:updated',
  MEMO_UPDATED: 'memo:updated',
  SUMMARY_UPDATED: 'summary:updated',
  ERROR: 'error',
});

// ---------------------------------------------------------------------------
// 動作パラメータ
// ---------------------------------------------------------------------------

// 履歴取得の1ページ件数（api.md：GET /rooms/:id/messages の limit 既定値）
export const MESSAGE_PAGE_SIZE = 50;
// message:sent の ack をこの時間待って来なければ送信失敗扱い（frontend.md §7）
export const SEND_ACK_TIMEOUT_MS = 5000;
// 送信取消が可能な時間（B-3）
export const MESSAGE_DELETE_WINDOW_HOURS = 24;
// 経過時間バッジの再計算間隔（useElapsedTime）
export const ELAPSED_REFRESH_INTERVAL_MS = 60_000;
// 一覧に出す最終メッセージ抜粋の文字数（frontend.md §5）
export const LAST_MESSAGE_PREVIEW_LENGTH = 40;
// 送信取消したメッセージの表示文言
export const DELETED_MESSAGE_TEXT = 'メッセージの送信を取り消しました';
// 未設定変数のプレースホルダ（P2-2 / business-logic.md §5）例：【未設定：面接日時】
export const UNSET_VARIABLE_PREFIX = '【未設定：';
export const UNSET_VARIABLE_SUFFIX = '】';
