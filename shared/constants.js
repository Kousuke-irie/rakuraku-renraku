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

// ---------------------------------------------------------------------------
// 選考ステータスの区分（P4-4 ダッシュボードの集計軸）
// 「エントリー」は選考が始まる前、「内定」は選考が終わって確定した状態であり、
// どちらも“選考中”ではない。辞退だけが離脱。
// ---------------------------------------------------------------------------

export const SELECTION_PHASE = Object.freeze({
  /** 選考が始まる前 */
  PRE: 'pre',
  /** 選考の途中 */
  IN_PROGRESS: 'in_progress',
  /** 選考が終わって確定した */
  SETTLED: 'settled',
  /** 選考から離れた */
  EXITED: 'exited',
});

export const SELECTION_PHASE_META = Object.freeze({
  [SELECTION_PHASE.PRE]: { label: '選考前' },
  [SELECTION_PHASE.IN_PROGRESS]: { label: '選考中' },
  [SELECTION_PHASE.SETTLED]: { label: '確定' },
  [SELECTION_PHASE.EXITED]: { label: '離脱' },
});

export const SELECTION_PHASE_VALUES = Object.values(SELECTION_PHASE);

/** 選考ステータス → 区分。ここに無いものはすべて `in_progress`（書類〜五次面接） */
export const SELECTION_PHASE_BY_STATUS = Object.freeze({
  [SELECTION_STATUS.ENTRY]: SELECTION_PHASE.PRE,
  [SELECTION_STATUS.OFFER]: SELECTION_PHASE.SETTLED,
  [SELECTION_STATUS.DECLINED]: SELECTION_PHASE.EXITED,
});

/** @param {string} status @returns {string} SELECTION_PHASE のいずれか */
export function selectionPhaseOf(status) {
  return SELECTION_PHASE_BY_STATUS[status] ?? SELECTION_PHASE.IN_PROGRESS;
}

/**
 * 選考フロー（S-09 / P2-11）に丸として並べられるステップ。
 *
 * **`declined`（辞退）は含めない。** 辞退は選考の一段階ではなく終端の分岐であり、
 * 「エントリー → 書類 → … → 内定」の線上に置くと進捗の意味が壊れるため。
 * 学生が辞退のときは、フローを描かず終端表示に切り替える（`business-logic.md` §8）。
 *
 * `selection_steps` テーブルの CHECK 制約はこの並びと完全に一致させること。
 */
export const SELECTION_FLOW_STEP_VALUES = Object.freeze(
  SELECTION_STATUS_VALUES.filter((status) => status !== SELECTION_STATUS.DECLINED)
);

/** 学生から見た各ステップの状態（S-09）。色だけでなくラベルでも伝える */
export const FLOW_STEP_STATE = Object.freeze({
  DONE: 'done',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
});

export const FLOW_STEP_STATE_META = Object.freeze({
  [FLOW_STEP_STATE.DONE]: { label: '完了' },
  [FLOW_STEP_STATE.CURRENT]: { label: '進行中' },
  [FLOW_STEP_STATE.UPCOMING]: { label: 'これから' },
});

export const FLOW_STEP_STATE_VALUES = Object.values(FLOW_STEP_STATE);

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

// ---------------------------------------------------------------------------
// AI推奨度（P3-1改訂）
// 人事画面の優先表示にはAI判定を使う。AIが未判定・失敗時だけ既存の urgency を
// フォールバックとして使うため、欠席・遅刻などの即時検知は維持される。
// ---------------------------------------------------------------------------

export const AI_RECOMMENDED_PRIORITY_TITLE = 'AI推奨度';

export const AI_RECOMMENDED_PRIORITY = Object.freeze({
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
});

export const AI_RECOMMENDED_PRIORITY_META = Object.freeze({
  [AI_RECOMMENDED_PRIORITY.HIGH]: { label: '高' },
  [AI_RECOMMENDED_PRIORITY.NORMAL]: { label: '通常' },
  [AI_RECOMMENDED_PRIORITY.LOW]: { label: '低' },
});

export const AI_RECOMMENDED_PRIORITY_VALUES = Object.values(AI_RECOMMENDED_PRIORITY);

export const AI_RECOMMENDED_PRIORITY_ORDER = Object.freeze({
  [AI_RECOMMENDED_PRIORITY.HIGH]: 0,
  [AI_RECOMMENDED_PRIORITY.NORMAL]: 1,
  [AI_RECOMMENDED_PRIORITY.LOW]: 2,
});

export const AI_ANALYSIS_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
});

export const AI_ANALYSIS_STATUS_VALUES = Object.values(AI_ANALYSIS_STATUS);

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

// ---------------------------------------------------------------------------
// 面接日程予約（P3-4 改訂）
// schedule_requests.status が予約フローの正。students.schedule_state は互換表示用に同期する。
// ---------------------------------------------------------------------------

export const SCHEDULE_REQUEST_STATUS = Object.freeze({
  DRAFT: 'draft',
  WAITING_STUDENT: 'waiting_student',
  BOOKED: 'booked',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const SCHEDULE_REQUEST_STATUS_META = Object.freeze({
  [SCHEDULE_REQUEST_STATUS.DRAFT]: { label: '作成中' },
  [SCHEDULE_REQUEST_STATUS.WAITING_STUDENT]: { label: '学生日程選択待ち' },
  [SCHEDULE_REQUEST_STATUS.BOOKED]: { label: '日程確定' },
  [SCHEDULE_REQUEST_STATUS.EXPIRED]: { label: '回答期限切れ' },
  [SCHEDULE_REQUEST_STATUS.CANCELLED]: { label: '取消' },
});

export const SCHEDULE_REQUEST_STATUS_VALUES = Object.values(SCHEDULE_REQUEST_STATUS);

export const INTERVIEW_FORMAT = Object.freeze({
  ONLINE: 'online',
  ONSITE: 'onsite',
});

export const INTERVIEW_FORMAT_META = Object.freeze({
  [INTERVIEW_FORMAT.ONLINE]: { label: 'オンライン' },
  [INTERVIEW_FORMAT.ONSITE]: { label: '対面' },
});

export const INTERVIEW_FORMAT_VALUES = Object.values(INTERVIEW_FORMAT);

export const INTERVIEW_DURATION_OPTIONS = Object.freeze([30, 60, 90]);
export const DEFAULT_INTERVIEW_DURATION_MINUTES = 60;
export const DEFAULT_DAILY_START_TIME = '10:00';
export const DEFAULT_DAILY_END_TIME = '18:00';
export const SCHEDULE_REFRESH_INTERVAL_MS = 30_000;

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

/**
 * 学生本人だけが読み書きする選考メモのキー（S-10）。
 *
 * `'overall'` は選考全体のメモ、それ以外は選考ステップに紐づくメモ。
 *
 * **NULL 許容の status_key にしない。** SQLite の UNIQUE 制約は NULL 同士を重複と
 * 見なさないため、全体メモが学生1人につき何行でも作れてしまう。明示のキーにすることで
 * `UNIQUE(student_user_id, note_key)` だけで1件に固定できる。
 *
 * `student_notes.note_key` の CHECK 制約はこの並びと完全に一致させること。
 */
export const STUDENT_NOTE_OVERALL_KEY = 'overall';

export const STUDENT_NOTE_KEY_VALUES = Object.freeze([
  STUDENT_NOTE_OVERALL_KEY,
  ...SELECTION_FLOW_STEP_VALUES,
]);

// ---------------------------------------------------------------------------
// 一覧の並び順（P1-7 / business-logic.md §6）
// ---------------------------------------------------------------------------

export const SORT_KEY = Object.freeze({
  // urgency → last_student_message_at ASC
  DEFAULT: 'default',
  // 最終メッセージ時刻の新しい順（既定）
  LAST_MESSAGE: 'last_message',
  // 経過時間の長い順
  ELAPSED: 'elapsed',
});

export const SORT_KEY_META = Object.freeze({
  [SORT_KEY.DEFAULT]: { label: 'AI推奨度順' },
  [SORT_KEY.LAST_MESSAGE]: { label: '最終メッセージ順' },
  [SORT_KEY.ELAPSED]: { label: '経過時間順' },
});

export const SORT_KEY_VALUES = Object.values(SORT_KEY);

/** 既定は最終メッセージ順（直近のやり取りから確認できるようにする） */
export const DEFAULT_SORT_KEY = SORT_KEY.LAST_MESSAGE;

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
// ホームのボードを縦割りにする軸（S-07 / frontend.md §5-2）
// ※クライアント内部の表示状態。DB にも API にも出さない。
// 値は StatusChip の CHIP_KIND と揃えてあり、そのままチップの種別として使える。
// ---------------------------------------------------------------------------

export const BOARD_GROUP_BY = Object.freeze({
  HANDLING: 'handling',
  SELECTION: 'selection',
  AI_PRIORITY: 'ai_priority',
});

export const BOARD_GROUP_BY_META = Object.freeze({
  [BOARD_GROUP_BY.HANDLING]: { label: '対応' },
  [BOARD_GROUP_BY.SELECTION]: { label: '選考' },
  [BOARD_GROUP_BY.AI_PRIORITY]: { label: AI_RECOMMENDED_PRIORITY_TITLE },
});

export const BOARD_GROUP_BY_VALUES = Object.values(BOARD_GROUP_BY);

/** 既定は対応ステータス（ログイン直後に「返信すべき学生」から見えるようにする） */
export const DEFAULT_BOARD_GROUP_BY = BOARD_GROUP_BY.HANDLING;

// ---------------------------------------------------------------------------
// AI 現況サマリーの状態（P3-1a / api.md「AI 現況サマリー」・business-logic.md §7-2）
// GET /api/ai/summary のレスポンス status と、ホームの AiSummaryCard の表示状態を兼ねる。
// ---------------------------------------------------------------------------

export const AI_SUMMARY_STATUS = Object.freeze({
  /** 未生成（まだ一度も要求していない） */
  IDLE: 'idle',
  /** 生成中 */
  LOADING: 'loading',
  /** 生成済み */
  READY: 'ready',
  /** タイムアウト・APIエラー・JSON不正 */
  ERROR: 'error',
  /** GEMINI_API_KEY 未設定。AI 機能そのものが使えない */
  UNAVAILABLE: 'unavailable',
});

export const AI_SUMMARY_STATUS_META = Object.freeze({
  [AI_SUMMARY_STATUS.IDLE]: { label: '未生成' },
  [AI_SUMMARY_STATUS.LOADING]: { label: '生成中' },
  [AI_SUMMARY_STATUS.READY]: { label: '生成済み' },
  [AI_SUMMARY_STATUS.ERROR]: { label: '生成に失敗しました' },
  [AI_SUMMARY_STATUS.UNAVAILABLE]: { label: '準備中' },
});

export const AI_SUMMARY_STATUS_VALUES = Object.values(AI_SUMMARY_STATUS);

/** AI が提示する TODO の最大件数（business-logic.md §7-2：多いと「上から処理する」が崩れる） */
export const AI_SUMMARY_TODO_LIMIT = 3;

// ---------------------------------------------------------------------------
// 面接アンケート（S-11）
// 学生が面接ステップごとに★5段階＋自由記述で答え、人事は面接官別に読む。
// ---------------------------------------------------------------------------

/** アンケートの対象になる選考ステップ。schema.sql の CHECK と完全に一致させること */
export const INTERVIEW_SURVEY_STATUS_KEYS = Object.freeze(
  SELECTION_STATUS_VALUES.filter((status) => status.startsWith('interview_')),
);

/** ★の下限・上限。サーバの検証と学生カードのボタン数を必ず揃える */
export const INTERVIEW_SURVEY_RATING_MIN = 1;
export const INTERVIEW_SURVEY_RATING_MAX = 5;

/** 自由記述の上限。サーバの検証と textarea の maxlength を必ず揃える */
export const INTERVIEW_SURVEY_COMMENT_MAX_LENGTH = 1000;

/**
 * ★匿名性の下限。回答がこの件数に満たない面接官は、評価もコメントも人事に出さない。
 *
 * 1〜2件だと面接日程と突き合わせて誰の回答かが特定できてしまう。
 * 「合否には影響しません」と約束して集めている以上、特定可能な状態で見せた時点で
 * 約束違反であり、学生が忖度して書くようになってデータ自体が無価値になる。
 * **この閾値を下げないこと。** 判定は必ずサーバで行う（クライアントで隠さない）。
 */
export const INTERVIEW_SURVEY_MIN_SAMPLE = 3;

/** 面接官を特定できなかった回答をまとめる先。実在の面接官IDと衝突しない値にする */
export const INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_ID = 'unknown';
export const INTERVIEW_SURVEY_UNKNOWN_INTERVIEWER_LABEL = '面接官不明';

/** 自由記述の要約スコープ。人事画面のドロップダウンの「全体」に対応する */
export const INTERVIEW_SURVEY_SCOPE_ALL = 'all';

// ---------------------------------------------------------------------------
// 人事FBアンケート（S-12）
// 選考が終わった学生が、担当人事の**対応**を3軸★5段階＋自由記述で答える。
// 人事は監視ダッシュボード（/dashboard）の全社・個人タブで読む。
//
// ★面接アンケート（S-11）と主語が違う。
//   S-11 … 面接官の**面接**が学生にどう受け取られたか。母数は完了した面接ステップ。
//   S-12 … 担当人事の**やり取り**が学生にどう受け取られたか。母数は選考を終えた学生。
//   定数を共用しない。軸も母数も違うものが、片方の都合で動くのを避ける。
// ---------------------------------------------------------------------------

/**
 * 評価軸。**この3つで固定する。**
 * 増やすと学生の回答負荷が上がって回答率が落ち、減らすと「どこが悪かったのか」が
 * 自由記述からしか読めなくなる。schema.sql の rating_* 列と1対1で対応させること。
 */
export const HR_SURVEY_AXIS = Object.freeze({
  /** C-1「合否連絡が1日遅れる」が学生からどう見えていたか */
  SPEED: 'speed',
  /** C-5「日程調整の進捗が不透明」に対応する軸 */
  CLARITY: 'clarity',
  /** 文面そのものの印象。コンプライアンス検知（P4-2）が拾えない体感が出る */
  COURTESY: 'courtesy',
});

export const HR_SURVEY_AXIS_META = Object.freeze({
  [HR_SURVEY_AXIS.SPEED]: {
    label: '連絡の速さ',
    question: 'ご連絡の早さ・返信までの待ち時間はいかがでしたか',
  },
  [HR_SURVEY_AXIS.CLARITY]: {
    label: '説明の分かりやすさ',
    question: '選考の進み方や日程の案内は分かりやすかったですか',
  },
  [HR_SURVEY_AXIS.COURTESY]: {
    label: '対応の丁寧さ',
    question: 'やり取りの丁寧さ・安心して相談できたかはいかがでしたか',
  },
});

export const HR_SURVEY_AXIS_VALUES = Object.values(HR_SURVEY_AXIS);

/** ★の下限・上限。サーバの検証と学生カードのボタン数を必ず揃える */
export const HR_SURVEY_RATING_MIN = 1;
export const HR_SURVEY_RATING_MAX = 5;

/** 自由記述の上限。サーバの検証と textarea の maxlength を必ず揃える */
export const HR_SURVEY_COMMENT_MAX_LENGTH = 1000;

/**
 * ★匿名性の下限。回答がこの件数に満たない担当者は、評価もコメントも人事に出さない。
 *
 * 面接官（S-11）以上に危うい。担当学生は固定で、選考を終えた学生はさらに少ないため、
 * 1〜2件だと「先週内定を出したあの子だ」と担当者本人がまず特定できてしまう。
 * **この閾値を下げないこと。** 判定は必ずサーバで行う（クライアントで隠さない）。
 */
export const HR_SURVEY_MIN_SAMPLE = 3;

/** 担当者が付いていないルームの回答をまとめる先。実在のユーザーIDと衝突しない値にする */
export const HR_SURVEY_UNKNOWN_ASSIGNEE_ID = 'unknown';
export const HR_SURVEY_UNKNOWN_ASSIGNEE_LABEL = '担当者未割当';

/** 自由記述の要約スコープ。ダッシュボードのドロップダウンの「全体」に対応する */
export const HR_SURVEY_SCOPE_ALL = 'all';

/**
 * アンケートを配る「選考終了」の区分（＝ SELECTION_PHASE）。
 *
 * ★内定だけにしないこと。**辞退した学生の声こそ改善の材料**であり、
 *   そこを取らないと「満足した人だけが答えたアンケート」になる。
 * 判定は selectionPhaseOf() に通す。ステータス名で直接比較しないこと。
 */
export const HR_SURVEY_TRIGGER_PHASES = Object.freeze([
  SELECTION_PHASE.SETTLED,
  SELECTION_PHASE.EXITED,
]);

/** @param {string} selectionStatus @returns {boolean} 選考が終わっていて回答できるか */
export function isHrSurveyAnswerable(selectionStatus) {
  return HR_SURVEY_TRIGGER_PHASES.includes(selectionPhaseOf(selectionStatus));
}

// ---------------------------------------------------------------------------
// 初期値
// ---------------------------------------------------------------------------

export const DEFAULT_HANDLING_STATUS = HANDLING_STATUS.NEEDS_REPLY;
export const DEFAULT_SELECTION_STATUS = SELECTION_STATUS.ENTRY;
export const DEFAULT_TOPIC_TAG = TOPIC_TAG.OTHER;
export const DEFAULT_URGENCY = URGENCY.NORMAL;
export const DEFAULT_AI_ANALYSIS_STATUS = AI_ANALYSIS_STATUS.SKIPPED;
export const DEFAULT_SCHEDULE_STATE = SCHEDULE_STATE.NONE;
export const DEFAULT_SCHEDULE_REQUEST_STATUS = SCHEDULE_REQUEST_STATUS.DRAFT;
export const DEFAULT_INTERVIEW_FORMAT = INTERVIEW_FORMAT.ONLINE;
export const DEFAULT_MEMO_SCOPE = MEMO_SCOPE.PRIVATE;
export const DEFAULT_AI_SUMMARY_STATUS = AI_SUMMARY_STATUS.IDLE;

// ---------------------------------------------------------------------------
// SLA 閾値（P1-4 / business-logic.md §3）
// サーバは環境変数 SLA_WARN_HOURS / SLA_ALERT_HOURS で上書きする。ここは既定値。
// ---------------------------------------------------------------------------

export const SLA_WARN_HOURS = 12;
export const SLA_ALERT_HOURS = 24;

// ---------------------------------------------------------------------------
// SLA 通知の閾値（P4-1 / monitoring.md §3）
// 上の SLA_WARN/ALERT は「緊急度」の閾値、こちらは「通知」の閾値。責務が別なので
// 流用しないこと。サーバは SLA_NOTIFY_HOURS / SLA_ESCALATE_HOURS で上書きする。
// ---------------------------------------------------------------------------

/** N：この時間を超えたら担当者へ通知する */
export const SLA_NOTIFY_HOURS = 24;
/** 2N：この時間を超えたら上長（role='admin'）へエスカレーションする */
export const SLA_ESCALATE_HOURS = 48;

// SLA 通知の対象外にする対応ステータス。
// waiting_student / done は人事が返信済み、on_hold は意図的に止めている（P1-2 の設計判断）。
export const SLA_ALERT_EXEMPT_STATUSES = Object.freeze([
  HANDLING_STATUS.WAITING_STUDENT,
  HANDLING_STATUS.DONE,
  HANDLING_STATUS.ON_HOLD,
]);

// ---------------------------------------------------------------------------
// 面接会議室の未設定通知の閾値（P4-5 / monitoring.md §3b）
// サーバは INTERVIEW_ROOM_ALERT_LEAD_HOURS で上書きする。
// ---------------------------------------------------------------------------

/**
 * 面接開始までこの時間以内になっても会議室が空欄なら通知する。
 * これより先の面接では鳴らさない（「まだ押さえていないだけ」を通知にすると狼少年になる）。
 */
export const INTERVIEW_ROOM_ALERT_LEAD_HOURS = 72;

// ---------------------------------------------------------------------------
// 監視ダッシュボード（P4-4 / monitoring.md §6）
// ---------------------------------------------------------------------------

/** 発生推移グラフの日数。件数0の日もサーバ側で埋めて返す */
export const DASHBOARD_TREND_DAYS = 14;

// ---------------------------------------------------------------------------
// 個人ダッシュボード（P4-8 / monitoring.md §6-2）
// 全社版と同じ /dashboard の中でタブ切り替えする。母数は担当者1人ぶん。
// ---------------------------------------------------------------------------

/** ダッシュボードの母数の切り替え。URL の ?scope= に出る */
export const DASHBOARD_SCOPE = Object.freeze({
  /** 全社（P4-4） */
  COMPANY: 'company',
  /** 担当者1人（P4-8） */
  PERSONAL: 'personal',
});

export const DASHBOARD_SCOPE_META = Object.freeze({
  [DASHBOARD_SCOPE.COMPANY]: { label: '全社' },
  [DASHBOARD_SCOPE.PERSONAL]: { label: '個人' },
});

export const DASHBOARD_SCOPE_VALUES = Object.values(DASHBOARD_SCOPE);

export const DEFAULT_DASHBOARD_SCOPE = DASHBOARD_SCOPE.COMPANY;

/**
 * 返信状況（P4-8）。**対応ステータスとは別の軸。**
 * 対応ステータスが「人事がどう処理したか（人が付ける）」なのに対し、
 * こちらは「学生を実際に何時間待たせているか（時刻から機械的に決まる）」を見る。
 *
 * 3段の閾値は SLA と同じ（SLA_NOTIFY_HOURS / SLA_ESCALATE_HOURS）。
 * 数字がずれると受信箱のバッジと食い違うため、サーバが閾値ごと返す。
 */
export const REPLY_STATE = Object.freeze({
  /** 学生の最後の発言に返信済み（＝待たせていない） */
  REPLIED: 'replied',
  /** 未返信だが通知の閾値内 */
  WAITING: 'waiting',
  /** 未返信で通知の閾値超え */
  OVERDUE: 'overdue',
});

export const REPLY_STATE_VALUES = Object.values(REPLY_STATE);

/**
 * 返信所要時間の分布バケット（P4-8）。
 *
 * 学生の連続発言の**先頭**から、次の人事の発言までの経過時間で分類する
 * （学生が実際に待った時間そのものを測るため）。
 * `maxHours: null` が最後のバケット＝上限なし。**順序に意味がある**ので並べ替えないこと。
 */
export const REPLY_LATENCY_BUCKET = Object.freeze([
  { key: 'under_1h', label: '1時間未満', maxHours: 1 },
  { key: 'h1_3', label: '1〜3時間', maxHours: 3 },
  { key: 'h3_6', label: '3〜6時間', maxHours: 6 },
  { key: 'h6_12', label: '6〜12時間', maxHours: 12 },
  { key: 'h12_24', label: '12〜24時間', maxHours: 24 },
  { key: 'over_24h', label: '24時間超', maxHours: null },
]);

export const REPLY_LATENCY_BUCKET_KEYS = Object.freeze(
  REPLY_LATENCY_BUCKET.map((bucket) => bucket.key),
);

/** 経過時間（時間）をバケットの key に落とす。境界は「以上〜未満」 */
export function replyLatencyBucketOf(hours) {
  const bucket = REPLY_LATENCY_BUCKET.find(
    (candidate) => candidate.maxHours !== null && hours < candidate.maxHours,
  );

  return bucket?.key ?? REPLY_LATENCY_BUCKET[REPLY_LATENCY_BUCKET.length - 1].key;
}

/**
 * 時間帯別グラフの刻み。0〜23時の24点。
 *
 * ★サーバは **UTC の時刻**でカウントして返し、クライアントが表示時にローカルへ回す
 *   （CLAUDE.md §6-2）。JST は整数時間オフセットなので、配列の回転で無損失に変換できる。
 */
export const HOURS_IN_DAY = 24;

// 経過時間バッジを表示しない対応ステータス（返信済み・完了は SLA の対象外）
export const ELAPSED_BADGE_HIDDEN_STATUSES = Object.freeze([
  HANDLING_STATUS.WAITING_STUDENT,
  HANDLING_STATUS.DONE,
]);

// ---------------------------------------------------------------------------
// 監視イベント（P4-0 / monitoring.md §2）
// SLA 通知もコンプライアンス警告も `alerts` 1テーブルに集約する。
// CHECK 制約の文字列と完全に一致させること。
// ---------------------------------------------------------------------------

export const ALERT_KIND = Object.freeze({
  /** N=24h 無返信。担当者（未アサインなら上長）へ通知する */
  SLA_NOTIFY: 'sla_notify',
  /** 2N=48h 無返信。上長へエスカレーションする */
  SLA_ESCALATE: 'sla_escalate',
  /** 人事の発言から就職差別・オワハラ表現を検知した */
  COMPLIANCE: 'compliance',
  /** P4-5。面接日程は決まっているのに会議室が空欄のまま */
  INTERVIEW_ROOM_MISSING: 'interview_room_missing',
  /** P4-7。学生本人へ：選考が次のステップへ進んだ */
  STUDENT_SELECTION_ADVANCED: 'student_selection_advanced',
  /** P4-7。学生本人へ：選考フィードバックが本人に見える状態になった */
  STUDENT_FEEDBACK_PUBLISHED: 'student_feedback_published',
  /** S-12。学生本人へ：選考が終わったので人事対応アンケートをお願いする */
  STUDENT_HR_SURVEY_REQUESTED: 'student_hr_survey_requested',
});

export const ALERT_KIND_META = Object.freeze({
  [ALERT_KIND.SLA_NOTIFY]: { label: '未返信24時間' },
  [ALERT_KIND.SLA_ESCALATE]: { label: '上長エスカレーション' },
  [ALERT_KIND.COMPLIANCE]: { label: 'コンプライアンス警告' },
  [ALERT_KIND.INTERVIEW_ROOM_MISSING]: { label: '会議室未設定' },
  [ALERT_KIND.STUDENT_SELECTION_ADVANCED]: { label: '選考が進みました' },
  [ALERT_KIND.STUDENT_FEEDBACK_PUBLISHED]: { label: 'フィードバック公開' },
  [ALERT_KIND.STUDENT_HR_SURVEY_REQUESTED]: { label: 'アンケートのお願い' },
});

export const ALERT_KIND_VALUES = Object.values(ALERT_KIND);

// ---------------------------------------------------------------------------
// 通知の読者（P4-7 / monitoring.md §3c）★混ざらないための単一の情報源
//
// `alerts` テーブルは人事の監視イベントと学生向けのお知らせを共用する。
// 分離は**この対応表だけ**で行い、読み出し側（server/services/alertView.js）が
// users.role と kind を必ず突き合わせる。宛先（target_user_id）の取り違えが
// あっても、ロールに合わない kind は返らない。
//
// ★新しい kind を足したら必ずここにも足すこと。
//   ALERT_KIND_AUDIENCE に無い kind はどちらのロールにも返らない（安全側に倒す）。
// ---------------------------------------------------------------------------

export const ALERT_AUDIENCE = Object.freeze({
  /** 人事（hr / admin）。受信箱の運用のための監視イベント */
  HR: 'hr',
  /** 学生本人。自分の選考についてのお知らせ */
  STUDENT: 'student',
});

export const ALERT_AUDIENCE_VALUES = Object.values(ALERT_AUDIENCE);

export const ALERT_KIND_AUDIENCE = Object.freeze({
  [ALERT_KIND.SLA_NOTIFY]: ALERT_AUDIENCE.HR,
  [ALERT_KIND.SLA_ESCALATE]: ALERT_AUDIENCE.HR,
  [ALERT_KIND.COMPLIANCE]: ALERT_AUDIENCE.HR,
  [ALERT_KIND.INTERVIEW_ROOM_MISSING]: ALERT_AUDIENCE.HR,
  [ALERT_KIND.STUDENT_SELECTION_ADVANCED]: ALERT_AUDIENCE.STUDENT,
  [ALERT_KIND.STUDENT_FEEDBACK_PUBLISHED]: ALERT_AUDIENCE.STUDENT,
  [ALERT_KIND.STUDENT_HR_SURVEY_REQUESTED]: ALERT_AUDIENCE.STUDENT,
});

/** @param {string} audience ALERT_AUDIENCE のいずれか */
const kindsForAudience = (audience) =>
  Object.freeze(
    ALERT_KIND_VALUES.filter((kind) => ALERT_KIND_AUDIENCE[kind] === audience),
  );

export const HR_ALERT_KINDS = kindsForAudience(ALERT_AUDIENCE.HR);
export const STUDENT_ALERT_KINDS = kindsForAudience(ALERT_AUDIENCE.STUDENT);

/** SLA 系の kind。解消処理（返信時の resolved_at 更新）の対象。 */
export const SLA_ALERT_KINDS = Object.freeze([
  ALERT_KIND.SLA_NOTIFY,
  ALERT_KIND.SLA_ESCALATE,
]);

/**
 * バナーで強調する kind（P4-6）。
 *
 * 「重要」は**すでに手遅れになりかけているもの**に限る。増やすと強調の意味が薄まる。
 * 上長エスカレーションは「担当者が返さないまま2日経った」＝一番まずい状態なのでここに入る。
 */
export const IMPORTANT_ALERT_KINDS = Object.freeze([ALERT_KIND.SLA_ESCALATE]);

export const ALERT_SEVERITY = Object.freeze({
  /** 送信前に警告ダイアログで止める */
  BLOCK: 'block',
  /** 注意を促すが止めない */
  WARN: 'warn',
  /** 記録のみ */
  INFO: 'info',
});

export const ALERT_SEVERITY_META = Object.freeze({
  [ALERT_SEVERITY.BLOCK]: { label: '要修正' },
  [ALERT_SEVERITY.WARN]: { label: '要確認' },
  [ALERT_SEVERITY.INFO]: { label: '参考' },
});

export const ALERT_SEVERITY_VALUES = Object.values(ALERT_SEVERITY);

/** 重い順。複数検知したときの並び順に使う（monitoring.md §4） */
export const ALERT_SEVERITY_ORDER = Object.freeze({
  [ALERT_SEVERITY.BLOCK]: 0,
  [ALERT_SEVERITY.WARN]: 1,
  [ALERT_SEVERITY.INFO]: 2,
});

// ---------------------------------------------------------------------------
// コンプライアンス検知の分類（P4-2 / monitoring.md §4）
// ---------------------------------------------------------------------------

export const COMPLIANCE_CATEGORY = Object.freeze({
  DISCRIMINATION: 'discrimination',
  OWAHARA: 'owahara',
});

export const COMPLIANCE_CATEGORY_META = Object.freeze({
  [COMPLIANCE_CATEGORY.DISCRIMINATION]: { label: '就職差別のおそれ' },
  [COMPLIANCE_CATEGORY.OWAHARA]: { label: 'オワハラのおそれ' },
});

export const COMPLIANCE_CATEGORY_VALUES = Object.values(COMPLIANCE_CATEGORY);

/**
 * 検知結果に必ず添える免責。
 * 「検知しました」と断定すると法的判断の代行に見えるため（monitoring.md §4）。
 */
export const COMPLIANCE_DISCLAIMER = '参考情報です。最終判断は担当者が行ってください。';

/**
 * コンプライアンス検知のルール（P4-2 / monitoring.md §4）。
 *
 * **辞書も AI も同じ語彙を使う。** AI 側だけ `ai_discrimination` のような
 * 粗い分類にすると、ダッシュボードの内訳で粒度が混ざって比較できなくなる。
 * AI がどれにも当てはめられなかったときだけ `other_*` に落とす。
 *
 * 「辞書が見つけたか AI が見つけたか」は `alerts.source` が持つ。
 * ルールコードに混ぜないこと。
 */
export const COMPLIANCE_RULE = Object.freeze({
  // 就職差別のおそれ（厚労省「公正な採用選考の基本」の禁止事項）
  HONSEKI: 'honseki',
  FAMILY_JOB: 'family_job',
  FAMILY_EDU: 'family_edu',
  HOUSING: 'housing',
  ASSETS: 'assets',
  RELIGION: 'religion',
  POLITICS: 'politics',
  THOUGHT: 'thought',
  UNION: 'union',
  NEWSPAPER: 'newspaper',
  /** 上記のどれにも当てはまらない差別のおそれ（AI のみ） */
  OTHER_DISCRIMINATION: 'other_discrimination',

  // オワハラのおそれ
  WITHDRAW_OTHERS: 'withdraw_others',
  DECIDE_NOW: 'decide_now',
  OFFER_CONDITION: 'offer_condition',
  DEADLINE_TODAY: 'deadline_today',
  PRESSURE_SOFT: 'pressure_soft',
  /** 上記のどれにも当てはまらないオワハラのおそれ（AI のみ） */
  OTHER_OWAHARA: 'other_owahara',
});

/**
 * 画面に出す短い日本語名。**コードをそのまま見せない。**
 * `description` は AI にルールを選ばせるときのプロンプトにも使う。
 */
export const COMPLIANCE_RULE_META = Object.freeze({
  [COMPLIANCE_RULE.HONSEKI]: { label: '本籍・出生地', description: '本籍、出生地、国籍を尋ねている' },
  [COMPLIANCE_RULE.FAMILY_JOB]: { label: '家族の職業', description: '家族の職業、勤務先、家族構成を尋ねている' },
  [COMPLIANCE_RULE.FAMILY_EDU]: { label: '家族の学歴', description: '家族の学歴や出身校を尋ねている' },
  [COMPLIANCE_RULE.HOUSING]: { label: '住宅状況', description: '持ち家か賃貸か、間取り、家賃を尋ねている' },
  [COMPLIANCE_RULE.ASSETS]: { label: '家庭の経済状況', description: '世帯収入、資産、家庭の事情や生活水準を尋ねている' },
  [COMPLIANCE_RULE.RELIGION]: { label: '宗教・信仰', description: '宗教、信仰、宗派を尋ねている' },
  [COMPLIANCE_RULE.POLITICS]: { label: '支持政党', description: '支持政党や政治的な考えを尋ねている' },
  [COMPLIANCE_RULE.THOUGHT]: { label: '思想・信条', description: '尊敬する人物、人生観、信条、座右の銘を尋ねている' },
  [COMPLIANCE_RULE.UNION]: { label: '労働組合・学生運動', description: '労働組合、学生運動、社会運動への関与を尋ねている' },
  [COMPLIANCE_RULE.NEWSPAPER]: { label: '購読紙・愛読書', description: '購読新聞や愛読書を尋ねている' },
  [COMPLIANCE_RULE.OTHER_DISCRIMINATION]: { label: 'その他の差別的質問', description: '上記以外で、本人の適性・能力と関係のない事項を尋ねている' },

  [COMPLIANCE_RULE.WITHDRAW_OTHERS]: { label: '他社辞退の要求', description: '他社の選考辞退や就職活動の終了を求めている' },
  [COMPLIANCE_RULE.DECIDE_NOW]: { label: '即決の強要', description: 'その場での即答や即決を求めている' },
  [COMPLIANCE_RULE.OFFER_CONDITION]: { label: '内定の交換条件', description: '内定を交換条件にしている' },
  [COMPLIANCE_RULE.DEADLINE_TODAY]: { label: '極端に短い回答期限', description: '当日中など極端に短い期限で回答を迫っている' },
  [COMPLIANCE_RULE.PRESSURE_SOFT]: { label: '判断の急かし', description: '判断を急がせる表現になっている' },
  [COMPLIANCE_RULE.OTHER_OWAHARA]: { label: 'その他の就活妨害', description: '上記以外で、学生の就職活動の自由を制約している' },
});

export const COMPLIANCE_RULE_VALUES = Object.values(COMPLIANCE_RULE);

/** ルールコード → カテゴリ。`other_*` も含めて全件そろえる */
export const COMPLIANCE_RULE_CATEGORY = Object.freeze({
  [COMPLIANCE_RULE.HONSEKI]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.FAMILY_JOB]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.FAMILY_EDU]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.HOUSING]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.ASSETS]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.RELIGION]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.POLITICS]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.THOUGHT]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.UNION]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.NEWSPAPER]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.OTHER_DISCRIMINATION]: COMPLIANCE_CATEGORY.DISCRIMINATION,
  [COMPLIANCE_RULE.WITHDRAW_OTHERS]: COMPLIANCE_CATEGORY.OWAHARA,
  [COMPLIANCE_RULE.DECIDE_NOW]: COMPLIANCE_CATEGORY.OWAHARA,
  [COMPLIANCE_RULE.OFFER_CONDITION]: COMPLIANCE_CATEGORY.OWAHARA,
  [COMPLIANCE_RULE.DEADLINE_TODAY]: COMPLIANCE_CATEGORY.OWAHARA,
  [COMPLIANCE_RULE.PRESSURE_SOFT]: COMPLIANCE_CATEGORY.OWAHARA,
  [COMPLIANCE_RULE.OTHER_OWAHARA]: COMPLIANCE_CATEGORY.OWAHARA,
});

/** 未知のコードでも画面が壊れないように、ラベルが無ければコードをそのまま返す */
export function complianceRuleLabel(code) {
  return COMPLIANCE_RULE_META[code]?.label ?? code;
}

/** 検知の出どころ（P4-2b）。ダイアログでどちらが拾ったか示す */
export const COMPLIANCE_SOURCE = Object.freeze({
  DICTIONARY: 'dictionary',
  AI: 'ai',
});

export const COMPLIANCE_SOURCE_META = Object.freeze({
  [COMPLIANCE_SOURCE.DICTIONARY]: { label: '辞書' },
  [COMPLIANCE_SOURCE.AI]: { label: 'AI' },
});

export const COMPLIANCE_SOURCE_VALUES = Object.values(COMPLIANCE_SOURCE);

/**
 * LLM による検証の状態（P4-2b）。
 * 辞書判定は常に動くので、これは「AI の上乗せ分が効いたか」だけを表す。
 */
export const COMPLIANCE_AI_STATUS = Object.freeze({
  /** 検証済み */
  OK: 'ok',
  /** タイムアウト・APIエラー・レスポンス不正 */
  ERROR: 'error',
  /** GEMINI_API_KEY 未設定。AI 機能自体が使えない */
  UNAVAILABLE: 'unavailable',
});

export const COMPLIANCE_AI_STATUS_META = Object.freeze({
  [COMPLIANCE_AI_STATUS.OK]: { label: 'AIによる検証済み' },
  [COMPLIANCE_AI_STATUS.ERROR]: { label: 'AIによる検証はできていません' },
  [COMPLIANCE_AI_STATUS.UNAVAILABLE]: { label: 'AIによる検証はできていません' },
});

export const COMPLIANCE_AI_STATUS_VALUES = Object.values(COMPLIANCE_AI_STATUS);

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
  SCHEDULE_WATCH: 'schedule:watch',
  SCHEDULE_UNWATCH: 'schedule:unwatch',
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
  /** P3-1a。生成を依頼した本人にのみ配信する */
  AI_SUMMARY_UPDATED: 'ai:summary_updated',
  SCHEDULE_SLOT_UPDATED: 'schedule:slot_updated',
  SCHEDULE_REQUEST_UPDATED: 'schedule:request_updated',
  SCHEDULE_BOOKED: 'schedule:booked',
  /** P4-1。通知先（target_user_id）本人にのみ配信する */
  ALERT_NEW: 'alert:new',
  /**
   * P4-1b。通知が解消された（人事が返信した等）ことを宛先本人へ知らせる。
   * これが無いと、片付いた通知がリロードするまで一覧とベルに残る。
   */
  ALERT_RESOLVED: 'alert:resolved',
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

// 選考フロー（P2-11）の入力上限。サーバの検証とフォームの maxlength を必ず揃える
export const SELECTION_STEP_LABEL_MAX_LENGTH = 30;
export const SELECTION_STEP_TEXT_MAX_LENGTH = 500;
export const SELECTION_FEEDBACK_MAX_LENGTH = 1000;

// 学生の選考メモ（S-10）の本文上限。サーバの検証と textarea の maxlength を必ず揃える
export const STUDENT_NOTE_MAX_LENGTH = 2000;

// 定型文の本文に埋め込める変数（P2-1設定画面／P2-2 / business-logic.md §5）。
// 実データへの置換は P2-2 の責務。設定画面ではこの一覧を「挿入」候補として出す。
export const SNIPPET_VARIABLES = Object.freeze([
  { token: '{学生名}', label: '学生名' },
  { token: '{面接日時}', label: '面接日時' },
  { token: '{会議室}', label: '会議室' },
  { token: '{面接官}', label: '面接官' },
  { token: '{担当者名}', label: '担当者名' },
  { token: '{選考段階}', label: '選考段階' },
]);
