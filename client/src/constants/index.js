// 暫定定義。shared/constants.js 作成後は `export * from '../../../shared/constants.js'` の re-export に差し替える
// 値の定義は .claude/constants.md を参照

export const HANDLING_STATUS = Object.freeze({
  NEEDS_REPLY: "needs_reply",
  IN_PROGRESS: "in_progress",
  WAITING_STUDENT: "waiting_student",
  DONE: "done",
  ON_HOLD: "on_hold",
})

export const HANDLING_STATUS_META = Object.freeze({
  [HANDLING_STATUS.NEEDS_REPLY]: { label: "要返信", color: "#E5484D" },
  [HANDLING_STATUS.IN_PROGRESS]: { label: "対応中", color: "#F5A623" },
  [HANDLING_STATUS.WAITING_STUDENT]: { label: "返信待ち", color: "#4A90D9" },
  [HANDLING_STATUS.DONE]: { label: "完了", color: "#3EA76B" },
  [HANDLING_STATUS.ON_HOLD]: { label: "保留", color: "#8B8D98" },
})

export const HANDLING_STATUS_VALUES = Object.values(HANDLING_STATUS)

export const SELECTION_STATUS = Object.freeze({
  ENTRY: "entry",
  DOCUMENT: "document",
  APTITUDE: "aptitude",
  INTERVIEW_1: "interview_1",
  INTERVIEW_2: "interview_2",
  INTERVIEW_3: "interview_3",
  INTERVIEW_4: "interview_4",
  INTERVIEW_5: "interview_5",
  OFFER: "offer",
  DECLINED: "declined",
})

export const SELECTION_STATUS_META = Object.freeze({
  [SELECTION_STATUS.ENTRY]: { label: "エントリー" },
  [SELECTION_STATUS.DOCUMENT]: { label: "書類" },
  [SELECTION_STATUS.APTITUDE]: { label: "適性検査" },
  [SELECTION_STATUS.INTERVIEW_1]: { label: "一次面接" },
  [SELECTION_STATUS.INTERVIEW_2]: { label: "二次面接" },
  [SELECTION_STATUS.INTERVIEW_3]: { label: "三次面接" },
  [SELECTION_STATUS.INTERVIEW_4]: { label: "四次面接" },
  [SELECTION_STATUS.INTERVIEW_5]: { label: "五次面接" },
  [SELECTION_STATUS.OFFER]: { label: "内定" },
  [SELECTION_STATUS.DECLINED]: { label: "辞退" },
})

export const SELECTION_STATUS_VALUES = Object.values(SELECTION_STATUS)

export const TOPIC_TAG = Object.freeze({
  ABSENCE_LATE: "absence_late",
  SCHEDULING: "scheduling",
  APTITUDE_TEST: "aptitude_test",
  RESULT_WAITING: "result_waiting",
  QUESTION: "question",
  OTHER: "other",
})

export const TOPIC_TAG_META = Object.freeze({
  [TOPIC_TAG.ABSENCE_LATE]: { label: "欠席・遅刻", priority: 1 },
  [TOPIC_TAG.SCHEDULING]: { label: "日程調整", priority: 2 },
  [TOPIC_TAG.APTITUDE_TEST]: { label: "適性検査", priority: 3 },
  [TOPIC_TAG.RESULT_WAITING]: { label: "合否待ち", priority: 4 },
  [TOPIC_TAG.QUESTION]: { label: "質問", priority: 5 },
  [TOPIC_TAG.OTHER]: { label: "その他", priority: 99 },
})

export const TOPIC_TAG_VALUES = Object.values(TOPIC_TAG)

export const URGENCY = Object.freeze({
  HIGH: "high",
  NORMAL: "normal",
  LOW: "low",
})

export const URGENCY_META = Object.freeze({
  [URGENCY.HIGH]: { label: "緊急" },
  [URGENCY.NORMAL]: { label: "通常" },
  [URGENCY.LOW]: { label: "低" },
})

export const URGENCY_VALUES = Object.values(URGENCY)

export const SCHEDULE_STATE = Object.freeze({
  NONE: "none",
  PROPOSED: "proposed",
  INTERVIEWER_CHECK: "interviewer_check",
  ROOM_PENDING: "room_pending",
  CONFIRMED: "confirmed",
})

export const SCHEDULE_STATE_META = Object.freeze({
  [SCHEDULE_STATE.NONE]: { label: "対象外" },
  [SCHEDULE_STATE.PROPOSED]: { label: "候補日提示済" },
  [SCHEDULE_STATE.INTERVIEWER_CHECK]: { label: "面接官確認中" },
  [SCHEDULE_STATE.ROOM_PENDING]: { label: "会議室未押さえ" },
  [SCHEDULE_STATE.CONFIRMED]: { label: "確定" },
})

export const SCHEDULE_STATE_VALUES = Object.values(SCHEDULE_STATE)

export const ROLE = Object.freeze({
  HR: "hr",
  STUDENT: "student",
  ADMIN: "admin",
})

export const ROLE_VALUES = Object.values(ROLE)

export const MESSAGE_TYPE = Object.freeze({
  TEXT: "text",
  SYSTEM: "system",
})

export const MESSAGE_TYPE_VALUES = Object.values(MESSAGE_TYPE)

export const MEMO_SCOPE = Object.freeze({
  PRIVATE: "private",
  SHARED: "shared",
})

export const MEMO_SCOPE_VALUES = Object.values(MEMO_SCOPE)

export const SLA_WARN_HOURS = 12
export const SLA_ALERT_HOURS = 24
