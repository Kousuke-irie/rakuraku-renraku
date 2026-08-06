<script setup>
// 未対応サマリー（P1-8・frontend.md §5-2）
//
// 「要返信 7件・緊急 2件・24h超 1件」を常時表示する。ホーム（S-07）のヘッダで使う。
//
// ★件数は**自分の担当ルーム**（roomsStore.myRooms）から数える。
//   受信箱は担当制で他人の担当は一覧に出ないため（#28）、rooms 全件を数えると
//   件数と実際に見えている行数が食い違う。
//
// ★件数の情報源について
//   本来は GET /api/summary（roomsStore.summary）を使う（P1-8）。
//   まだ fetchSummary() が空実装なので、**ルーム一覧からの暫定集計**で出している。
//   P1-8 で fetchSummary / summary:updated が入ったら computed を rooms.summary に差し替えること。
//   （InboxSidebar にも同じ暫定集計がある。P1-8 でどちらもこのコンポーネントへ寄せる）
//
// ★クリックでのフィルタ適用も P1-8 の範囲。roomsStore.filteredRooms が空実装のため、
//   今は押しても絞り込めない。誤操作を招かないようボタンにせず表示だけにしてある。
import { computed } from "vue"
import {
  ELAPSED_BADGE_HIDDEN_STATUSES,
  HANDLING_STATUS,
  HANDLING_STATUS_META,
  SLA_ALERT_HOURS,
  URGENCY,
  URGENCY_META,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"

// #region constants
/** チップの配色。緊急＝赤／要返信＝ブランドのオレンジ／24h超＝赤（SLA） */
const TONE = Object.freeze({
  ALERT: "alert",
  WARN: "warn",
})
// #endregion

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region local methods
/** SLA 超過の対象か（返信済み・完了は対象外・constants.md §9） */
const isOverdue = (room) =>
  !ELAPSED_BADGE_HIDDEN_STATUSES.includes(room.handlingStatus) &&
  (room.elapsedHours ?? 0) >= SLA_ALERT_HOURS
// #endregion

// #region computed
const items = computed(() => [
  {
    key: "urgent",
    label: URGENCY_META[URGENCY.HIGH].label,
    count: rooms.myRooms.filter((room) => room.urgency === URGENCY.HIGH).length,
    tone: TONE.ALERT,
  },
  {
    key: "needsReply",
    label: HANDLING_STATUS_META[HANDLING_STATUS.NEEDS_REPLY].label,
    count: rooms.myRooms.filter((room) => room.handlingStatus === HANDLING_STATUS.NEEDS_REPLY)
      .length,
    tone: TONE.WARN,
  },
  {
    key: "overdue24h",
    label: `${SLA_ALERT_HOURS}h超`,
    count: rooms.myRooms.filter(isOverdue).length,
    tone: TONE.ALERT,
  },
])
// #endregion
</script>

<template>
  <ul
    class="summary"
    aria-label="未対応サマリー"
  >
    <li
      v-for="item in items"
      :key="item.key"
      class="summary__item"
      :class="[`summary__item--${item.tone}`, { 'summary__item--empty': item.count === 0 }]"
    >
      <span class="summary__label">{{ item.label }}</span>
      <span class="summary__count">{{ item.count }}</span>
      <span class="summary__unit">件</span>
    </li>
  </ul>
</template>

<style scoped>
.summary {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}

.summary__item {
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
  padding: 5px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.summary__item--alert {
  border-color: color-mix(in srgb, var(--color-sla-alert) 35%, transparent);
  background-color: color-mix(in srgb, var(--color-sla-alert) 9%, var(--color-canvas));
  color: var(--color-sla-alert);
}

.summary__item--warn {
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  background-color: var(--color-orange-soft);
  color: var(--color-primary);
}

/* 0件は主張させない。赤や橙のまま残ると「対応が必要」に見えてしまう */
.summary__item--empty {
  border-color: var(--color-hairline);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
}

.summary__count {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.summary__unit {
  font-size: 11px;
  font-weight: 400;
}
</style>
