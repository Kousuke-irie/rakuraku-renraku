// 経過時間の算出と整形（P1-4 / business-logic.md §3・frontend.md §9）
//
// サーバは elapsedHours を返すが、表示の更新はクライアント側で1分ごとに再計算する（api.md §2）。
// サーバへの再取得は不要。
import { computed, getCurrentScope, onScopeDispose, ref, unref } from "vue"
import { ELAPSED_REFRESH_INTERVAL_MS } from "../constants/index.js"

// #region constants
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
// #endregion

// #region shared ticker
// 表示更新用の現在時刻。**全インスタンスで setInterval を1本だけ共有する**
// （一覧の行数ぶんタイマーを作らないため）。購読が0になったら停止する。
const now = ref(Date.now())
let timerId = null
let subscriberCount = 0

const startTicker = () => {
  // 購読開始時に必ず現在時刻へ追いつく。
  // （購読が0の間はタイマーが止まり now が古くなるため。これを省くと
  //   受信箱を離れて戻った直後に最大60秒古い経過時間が表示される）
  now.value = Date.now()

  subscriberCount += 1
  if (timerId !== null) return
  timerId = setInterval(() => {
    now.value = Date.now()
  }, ELAPSED_REFRESH_INTERVAL_MS)
}

const stopTicker = () => {
  subscriberCount = Math.max(0, subscriberCount - 1)
  if (subscriberCount > 0 || timerId === null) return
  clearInterval(timerId)
  timerId = null
}
// #endregion

/**
 * 経過時間を `<1m` / `45m` / `26h` 形式に整形する（business-logic.md §3）。
 *
 * **1日を超えても「日」に繰り上げず h のままにする。** SLA の閾値（12h / 24h）と
 * 同じ単位で並ぶので、「1日2時間」より「26h」の方が超過幅を直接比較できる。
 *
 * @param {number} ms 経過ミリ秒
 * @returns {string}
 */
export const formatElapsed = (ms) => {
  if (ms < MS_PER_MINUTE) return "<1m"
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m`
  return `${Math.floor(ms / MS_PER_HOUR)}h`
}

/**
 * 基準時刻からの経過時間を1分ごとに再計算する。
 * @param {import('vue').Ref<string|null>|string|null} since ISO8601(UTC) の基準時刻（例：rooms.lastStudentMessageAt）
 * @returns {{
 *   elapsedMs: import('vue').ComputedRef<number|null>,
 *   elapsedHours: import('vue').ComputedRef<number|null>,
 *   text: import('vue').ComputedRef<string>,
 *   valid: import('vue').ComputedRef<boolean>,
 * }} since が null / 不正な日時なら elapsedMs は null、valid は false
 */
export function useElapsedTime(since) {
  startTicker()
  // コンポーネント外から呼ばれた場合は警告を出さずにタイマーを維持する
  if (getCurrentScope()) onScopeDispose(stopTicker)

  const sinceMs = computed(() => {
    const value = unref(since)
    if (!value) return null
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  })

  // 端末時刻のずれで未来になっても負数を出さない
  const elapsedMs = computed(() =>
    sinceMs.value === null ? null : Math.max(0, now.value - sinceMs.value)
  )

  const elapsedHours = computed(() =>
    elapsedMs.value === null ? null : elapsedMs.value / MS_PER_HOUR
  )

  const text = computed(() => (elapsedMs.value === null ? "" : formatElapsed(elapsedMs.value)))

  const valid = computed(() => elapsedMs.value !== null)

  return { elapsedMs, elapsedHours, text, valid }
}
