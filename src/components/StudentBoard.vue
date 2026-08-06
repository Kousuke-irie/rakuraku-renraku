<script setup>
// ホームのボード（S-07・frontend.md §5-2）
//
// 対応／選考／AI推奨度 のいずれかで列を作り、学生カードを縦に積む。
// 縦割りの軸は uiStore.boardGroupBy で切り替える。既定は対応ステータス。
//
// 列を横に並べる表示と「列の中はAI推奨度の高い順」という並びは BoardColumns が持つ。
// ここは **軸ごとに列を組み立てる** ことだけを担う。
import { computed } from "vue"
import {
  AI_RECOMMENDED_PRIORITY_META,
  AI_RECOMMENDED_PRIORITY_VALUES,
  BOARD_GROUP_BY,
  DEFAULT_BOARD_GROUP_BY,
  HANDLING_STATUS_META,
  HANDLING_STATUS_VALUES,
  SELECTION_STATUS_META,
  SELECTION_STATUS_VALUES,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import BoardColumns from "./BoardColumns.vue"

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
  [BOARD_GROUP_BY.AI_PRIORITY]: {
    values: AI_RECOMMENDED_PRIORITY_VALUES,
    meta: AI_RECOMMENDED_PRIORITY_META,
    of: (room) => room.priority ?? room.urgency,
  },
})
// #endregion

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
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
    key: value,
    label: axis.value.meta[value]?.label ?? value,
    rooms: grouped.get(value),
  }))
})
// #endregion
</script>

<template>
  <BoardColumns
    :columns="columns"
    :group-by="ui.boardGroupBy"
    label="学生一覧"
    fab-clearance
  />
</template>
