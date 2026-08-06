// 定型文の変数展開（P2-2・business-logic.md §5）
//
// 展開に必要なデータ（room.student・ログイン中の人事の displayName）は
// 受信箱を開いた時点でどちらもクライアントに揃っているため、サーバ往復を挟まずここで完結させる。
// ロジックを1箇所に集約する（business-logic.md §5の指示）ため、呼び出し側で置換を書かない。
import { SELECTION_STATUS_META, SNIPPET_VARIABLES, UNSET_VARIABLE_PREFIX, UNSET_VARIABLE_SUFFIX } from "../constants/index.js"

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"]

/** ISO8601(UTC) → 表示用ローカル日時。「8月7日（金）14:00」（business-logic.md §5） */
function formatInterviewDateTime(isoString) {
  const date = new Date(isoString)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAY_LABELS[date.getDay()]
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}月${day}日（${weekday}）${hour}:${minute}`
}

/** @param {object} student stores/rooms.js の room.student と同じ形 */
function valueForToken(token, { student, currentUserDisplayName }) {
  switch (token) {
    case "{学生名}":
      return student?.displayName || ""
    case "{面接日時}":
      return student?.nextInterviewAt ? formatInterviewDateTime(student.nextInterviewAt) : ""
    case "{会議室}":
      return student?.nextInterviewRoom || ""
    case "{面接官}":
      return student?.interviewer || ""
    case "{担当者名}":
      return currentUserDisplayName || ""
    case "{選考段階}":
      return SELECTION_STATUS_META[student?.selectionStatus]?.label || ""
    default:
      return ""
  }
}

/**
 * 定型文の本文にある `{学生名}` 等のプレースホルダを実データへ置換する。
 * 値が無い変数は空文字にせず `【未設定：面接日時】` として残す
 * （送信前に気づけるようにするため。business-logic.md §5）。
 *
 * @param {string} body
 * @param {{ student?: object, currentUserDisplayName?: string }} context
 * @returns {string}
 */
export function renderSnippetBody(body, context) {
  return SNIPPET_VARIABLES.reduce((text, { token, label }) => {
    if (!text.includes(token)) return text

    const value = valueForToken(token, context)
    const replacement = value || `${UNSET_VARIABLE_PREFIX}${label}${UNSET_VARIABLE_SUFFIX}`
    return text.split(token).join(replacement)
  }, body)
}

/** 展開結果に未設定マーカーが残っているか（送信前の警告表示に使う） */
export function hasUnsetVariable(text) {
  return text.includes(UNSET_VARIABLE_PREFIX)
}
