// 企業からのフィードバックの既読管理（P2-11 / S-09）
//
// 「どのステップの、いつ時点のFBまで読んだか」を端末に持つ。
// 人事がFBを書き直せば updatedAt が進むので、自動的に未読へ戻る。
//
// ★サーバに持たない。既読は端末ごとに違ってよい情報で、これのためにテーブルと
//   エンドポイントを増やす価値が無い。別の端末で開けば未読からになるが、
//   FB本体はサーバが正で、読めなくなるわけではないので実害が無い。
//
// ★認証情報は localStorage に置かないこと（frontend.md §10-5）。
//   ここに置いてよいのは、漏れても害が無く端末ごとに違ってよいものだけ。
import { ref } from "vue"

// #region constants
const STORAGE_PREFIX = "rakuraku:feedback-reads:"
// #endregion

/**
 * @param {number|string} userId 学生本人のID。他人の既読と混ざらないようキーに含める
 */
export function useFeedbackReads(userId) {
  const storageKey = `${STORAGE_PREFIX}${userId}`

  /** @type {import('vue').Ref<Record<string, string>>} statusKey → 読んだFBの updatedAt */
  const reads = ref({})

  /**
   * 書き込みが使えるか。プライベートブラウジングや容量超過では localStorage への
   * 書き込みが例外になる。一度失敗したら以降は試さない（毎回 throw させない）。
   */
  let isPersistable = true

  // #region local methods
  const load = () => {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : null
      // 他タブや手動編集で壊れていることがある。形が違えば無かったことにする
      reads.value = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
    } catch {
      reads.value = {}
    }
  }

  const persist = () => {
    if (!isPersistable) return

    try {
      localStorage.setItem(storageKey, JSON.stringify(reads.value))
    } catch {
      // 既読がこの端末に残らないだけで画面は動く。
      // 学生に見せる意味のある失敗ではないのでトーストも出さない
      isPersistable = false
    }
  }

  /**
   * まだ読んでいないFBが付いているか。
   * ISO8601(UTC) は形式が揃っていれば辞書順の比較がそのまま時系列の比較になる。
   * @param {{statusKey: string, feedback: {updatedAt: string}|null}} step
   */
  const isUnread = (step) => {
    const updatedAt = step?.feedback?.updatedAt
    if (!updatedAt) return false

    const readAt = reads.value[step.statusKey]
    return !readAt || readAt < updatedAt
  }

  /** 既読にする。詳細を開いた（本文が画面に出た）タイミングで呼ぶ */
  const markRead = (step) => {
    const updatedAt = step?.feedback?.updatedAt
    if (!updatedAt || reads.value[step.statusKey] === updatedAt) return

    // 既存を書き換えず新しいオブジェクトに差し替える
    reads.value = { ...reads.value, [step.statusKey]: updatedAt }
    persist()
  }
  // #endregion

  load()

  return { isUnread, markRead }
}

export default useFeedbackReads
