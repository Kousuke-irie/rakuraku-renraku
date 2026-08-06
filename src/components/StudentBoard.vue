<script setup>
// ホームのボード（S-07・frontend.md §5-2）
//
// ステータスごとに列を作り、学生カードを縦に積む。
// 縦割りの軸は uiStore.boardGroupBy（対応／選考／緊急度）で切り替える。既定は対応ステータス。
//
// ★列は「そのステータスの学生が0人でも」出す。
//   選考パイプラインのどこが空いているかも情報なので、列ごと消すと分からなくなる。
//
// ★並び替え UI は持たない。列の中は常に 緊急度 → 経過時間の長い順で固定する
//   （コンセプト「返信すべき学生が、上から順に並んでいる」・CLAUDE.md §1）。
import { computed } from "vue"
import {
  AI_ANALYSIS_STATUS,
  AI_RECOMMENDED_PRIORITY,
  BOARD_GROUP_BY,
  DEFAULT_BOARD_GROUP_BY,
  HANDLING_STATUS,
  HANDLING_STATUS_META,
  HANDLING_STATUS_VALUES,
  SELECTION_STATUS_META,
  SELECTION_STATUS_VALUES,
  URGENCY_META,
  URGENCY_ORDER,
  URGENCY_VALUES,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import StudentCard from "./StudentCard.vue"

// #region constants
/**
 * 縦割りの軸ごとの定義。
 * values … 列の並び（列挙の宣言順＝選考の進行順）
 * meta   … 列見出しのラベル
 * of     … room から軸の値を取り出す
 */
const AXES = Object.freeze({
  [BOARD_GROUP_BY.HANDLING]: {
    values: HANDLING_STATUS_VALUES,
    meta: HANDLING_STATUS_META,
    of: (room) => room.handlingStatus,
  },
  [BOARD_GROUP_BY.SELECTION]: {
    values: SELECTION_STATUS_VALUES,
    meta: SELECTION_STATUS_META,
    of: (room) => room.student?.selectionStatus,
  },
  [BOARD_GROUP_BY.URGENCY]: {
    values: URGENCY_VALUES,
    meta: URGENCY_META,
    of: (room) => room.urgency,
  },
})

const EMPTY_COLUMN_TEXT = "なし"
// #endregion

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local methods
/**
 * 列の中の並び：ルール緊急 → AI対応推奨度「高」 → 通常 → 低 → 経過時間。
 * 経過時間は「学生の最終メッセージが古いほど長い」ので昇順に並べる。
 */
const byPriority = (a, b) => {
  const rank = (room) => {
    if (URGENCY_ORDER[room.urgency] === 0) return 0
    if (
      room.aiRecommendation?.status === AI_ANALYSIS_STATUS.COMPLETED &&
      room.aiRecommendation?.priority === AI_RECOMMENDED_PRIORITY.HIGH &&
      [HANDLING_STATUS.NEEDS_REPLY, HANDLING_STATUS.IN_PROGRESS].includes(room.handlingStatus)
    ) {
      return 1
    }
    return (URGENCY_ORDER[room.urgency] ?? 8) + 1
  }

  const priority = rank(a) - rank(b)
  if (priority !== 0) return priority

  // 未受信（null）は経過時間が測れないので最後に回す
  const left = a.lastStudentMessageAt ? Date.parse(a.lastStudentMessageAt) : Infinity
  const right = b.lastStudentMessageAt ? Date.parse(b.lastStudentMessageAt) : Infinity
  return left - right
}
// #endregion

// #region computed
const axis = computed(() => AXES[ui.boardGroupBy] ?? AXES[DEFAULT_BOARD_GROUP_BY])

/**
 * 表示用の列。
 * 入力は roomsStore.sortedRooms（フィルタ・並べ替え適用済み・P1-7）。
 */
const columns = computed(() => {
  const grouped = new Map(axis.value.values.map((value) => [value, []]))

  for (const room of rooms.sortedRooms) {
    // 列挙にない値（データ不整合）は列を作らず捨てる。画面に不正値を出さない
    grouped.get(axis.value.of(room))?.push(room)
  }

  return axis.value.values.map((value) => ({
    value,
    label: axis.value.meta[value]?.label ?? value,
    rooms: grouped.get(value).sort(byPriority),
  }))
})
// #endregion
</script>

<template>
  <div
    class="board"
    role="list"
    aria-label="学生一覧"
  >
    <section
      v-for="column in columns"
      :key="column.value"
      class="column"
      role="listitem"
    >
      <header class="column__head">
        <h2 class="column__title">
          {{ column.label }}
        </h2>
        <span class="column__count">{{ column.rooms.length }}</span>
      </header>

      <div class="column__list">
        <p
          v-if="column.rooms.length === 0"
          class="column__empty"
        >
          {{ EMPTY_COLUMN_TEXT }}
        </p>

        <StudentCard
          v-for="room in column.rooms"
          :key="room.id"
          :room="room"
          :group-by="ui.boardGroupBy"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 列が増えると 1280px には収まらないので、ボードごと横スクロールさせる。
   縦は列ごとに独立してスクロールし、見出しは常に見えるようにする */
.board {
  display: flex;
  gap: var(--space-md);
  min-height: 0;
  height: 100%;
  overflow-x: auto;
  padding: var(--space-md) var(--space-xl) 0;
}

/* 選考ステータスは10列あるので1列は狭く取る。
   カードに載せるのが 氏名・チップ・経過時間だけなのはこの幅に収めるため */
.column {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 204px;
  min-height: 0;
}

.column__head {
  display: flex;
  flex: none;
  gap: var(--space-xs);
  align-items: baseline;
  padding: 0 var(--space-xs) var(--space-sm);
}

.column__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
}

.column__count {
  color: var(--color-ink-mute);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.column__list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-sm);
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-sm);
  border-radius: var(--radius-lg);
  background-color: color-mix(in srgb, var(--color-ink) 3%, var(--color-canvas));
  /* 右下に固定した AI ボタンで最終カードが隠れないようにする */
  padding-bottom: var(--ai-fab-clearance);
}

.column__empty {
  margin: 0;
  padding: var(--space-md) 0;
  color: var(--color-ink-mute);
  font-size: 11px;
  text-align: center;
}
</style>
