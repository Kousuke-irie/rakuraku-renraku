<script setup>
// 経過時間バッジ（P1-4 / business-logic.md §3）。useElapsedTime で1分ごとに再計算する。
//
// 12h（SLA_WARN_HOURS）以上＝黄 / 24h（SLA_ALERT_HOURS）以上＝赤。
// 返信済み・完了（ELAPSED_BADGE_HIDDEN_STATUSES）では非表示にする。
import { computed, toRef } from "vue"
import {
  DEFAULT_HANDLING_STATUS,
  ELAPSED_BADGE_HIDDEN_STATUSES,
  SLA_ALERT_HOURS,
  SLA_WARN_HOURS,
} from "../constants/index.js"
import { useElapsedTime } from "../composables/useElapsedTime.js"

// #region constants
/** バッジの警告レベル（DB には保存しない表示用の内部状態） */
const LEVEL = Object.freeze({
  NORMAL: "normal",
  WARN: "warn",
  ALERT: "alert",
})
// #endregion

const props = defineProps({
  /** rooms.lastStudentMessageAt（ISO8601 UTC）。null なら非表示 */
  since: { type: String, default: null },
  /** 対応ステータス。waiting_student / done では非表示になる */
  handlingStatus: { type: String, default: DEFAULT_HANDLING_STATUS },
})

const { elapsedHours, text, valid } = useElapsedTime(toRef(props, "since"))

// #region computed
const visible = computed(
  () => valid.value && !ELAPSED_BADGE_HIDDEN_STATUSES.includes(props.handlingStatus)
)

const level = computed(() => {
  if (elapsedHours.value === null) return LEVEL.NORMAL
  if (elapsedHours.value >= SLA_ALERT_HOURS) return LEVEL.ALERT
  if (elapsedHours.value >= SLA_WARN_HOURS) return LEVEL.WARN
  return LEVEL.NORMAL
})

// 色だけで超過を伝えないため、記号と読み上げテキストも添える（CLAUDE.md §6-13）
const overdueHours = computed(() => {
  if (level.value === LEVEL.ALERT) return SLA_ALERT_HOURS
  if (level.value === LEVEL.WARN) return SLA_WARN_HOURS
  return null
})
// #endregion
</script>

<template>
  <span
    v-if="visible"
    class="elapsed"
    :class="`elapsed--${level}`"
  >
    <span
      v-if="overdueHours !== null"
      aria-hidden="true"
    >⚠</span>
    <span>{{ text }}</span>
    <span
      v-if="overdueHours !== null"
      class="sr-only"
    >{{ overdueHours }}時間超</span>
  </span>
</template>

<style scoped>
.elapsed {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.elapsed--normal {
  color: #8b8d98;
}

.elapsed--warn {
  color: #b06f00;
  font-weight: 700;
}

.elapsed--alert {
  color: #e5484d;
  font-weight: 700;
}
</style>
