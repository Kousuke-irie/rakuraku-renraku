<script setup>
// 学生カードを縦に積んだ「列」を横に並べるボードの表示部（frontend.md §5-2）
//
// ホーム（S-07・縦割りは対応／選考／緊急度）と全学生（S-08・縦割りは担当人事）で共通に使う。
// **どんな軸で縦割りするかは呼び出し側が決める。** ここは受け取った列を並べるだけ。
//
// ★列は「その列の学生が0人でも」出す。
//   どこが空いているかも情報なので、列ごと消すと分からなくなる。
//
// ★並び替え UI は持たない。列の中は常に 緊急度 → 経過時間の長い順で固定する
//   （コンセプト「返信すべき学生が、上から順に並んでいる」・CLAUDE.md §1）。
//   どのボードでも同じ並びになるよう、この並べ替えはここに集約する。
import { computed } from "vue"
import {
  AI_ANALYSIS_STATUS,
  AI_RECOMMENDED_PRIORITY,
  HANDLING_STATUS,
  URGENCY_ORDER,
} from "../constants/index.js"
import StudentCard from "./StudentCard.vue"

// #region constants
const EMPTY_COLUMN_TEXT = "なし"
// #endregion

const props = defineProps({
  /**
   * 左から並べる列。
   * @type {import('vue').PropType<{key: string, label: string, rooms: object[]}[]>}
   */
  columns: { type: Array, required: true },
  /** ボード全体の読み上げ名 */
  label: { type: String, default: "学生一覧" },
  /** 縦割りに使っている軸（BOARD_GROUP_BY のいずれか）。この軸のチップはカードに出さない */
  groupBy: { type: String, default: "" },
  /** 右下に固定した AI ボタンがある画面では、最後のカードが隠れないよう下端を空ける */
  fabClearance: { type: Boolean, default: false },
})

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
/** 呼び出し側の配列を壊さないよう、複製してから並べ替える */
const sortedColumns = computed(() =>
  props.columns.map((column) => ({ ...column, rooms: [...column.rooms].sort(byPriority) }))
)
// #endregion
</script>

<template>
  <div
    class="board"
    :class="{ 'board--fab': fabClearance }"
    role="list"
    :aria-label="label"
  >
    <section
      v-for="column in sortedColumns"
      :key="column.key"
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
          :group-by="groupBy"
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
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

/* 右下に固定した AI ボタンで最終カードが隠れないようにする（ホームのみ） */
.board--fab .column__list {
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
