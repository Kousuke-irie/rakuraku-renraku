// 通知（alerts）を開いたときの遷移先（P4-6）。
//
// バナー（ToastStack）と通知一覧（NotificationsView）の両方から使う。
// 「クリックしたら該当画面へ飛ぶ」という挙動を1箇所で決めておくため。
//
// ★ロール（auth ストア）を見て決めないこと。
//   通知の kind が読者を一意に決めるので kind から引くほうが正確で、
//   ストア間の循環 import（auth → ui → auth）も生まれない。
import { ALERT_AUDIENCE, ALERT_KIND_AUDIENCE } from "../constants/index.js"

/** 通知一覧。まとめバナー（未読が溜まっている）から開く先 */
export const NOTIFICATIONS_PATH = "/notifications"

/** 学生向けの通知はマイページ（S-09）で確認する。選考の進捗もFBもそこに載る */
const STUDENT_PATH = "/mypage"

/**
 * その通知を開くべき画面のパス。
 * 人事向けの通知はどれも「その学生に返信する／その学生の情報を直す」で終わるので受信箱へ。
 *
 * @param {{kind: string, roomId: number}} alert
 * @returns {string}
 */
export function alertDestination(alert) {
  if (!alert) return NOTIFICATIONS_PATH
  if (ALERT_KIND_AUDIENCE[alert.kind] === ALERT_AUDIENCE.STUDENT) return STUDENT_PATH

  return alert.roomId ? `/inbox/${alert.roomId}` : NOTIFICATIONS_PATH
}
