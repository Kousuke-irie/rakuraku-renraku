<script setup>
// 全学生ボード（S-08）
//
// 受信箱・ホームは担当制で自分の担当学生しか出ない（roomsStore.myRooms・#28）。
// この画面は**担当外と未配属も含めた全学生**を、担当人事ごとの列で俯瞰する。
//
// ★未配属を一番左に固定する。
//   この画面の目的は「どの人事の受信箱にも出ていない学生の拾い上げ」なので、
//   最初に目に入る位置に置く。
//
// ★担当が0名の人事も列として出す。
//   誰に余裕があるか（＝誰に振れるか）も情報のため。
//
// 縦割りの軸を切り替える UI は持たない（軸は担当人事に固定）。
import { computed } from "vue"
import { useRoomsStore } from "../stores/rooms.js"
import BoardColumns from "./BoardColumns.vue"

// #region constants
/** 未配属列。担当人事が null（未割当・P2-9）の学生が入る */
const UNASSIGNED = Object.freeze({ key: "unassigned", label: "未配属" })
// #endregion

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region local methods
const newColumn = (key, label) => ({ key, label, rooms: [] })
// #endregion

// #region computed
/**
 * 担当人事ごとの列。
 * 入力は roomsStore.allSortedRooms（担当外・未配属も含む全件。フィルタ適用済み）。
 *
 * Map は挿入順を保つので、未配属 → 人事（GET /api/users の順）→ 候補一覧に無い担当者、
 * の順で列が並ぶ。
 */
const columns = computed(() => {
  /** @type {Map<number|null, {key: string, label: string, rooms: object[]}>} */
  const byAssignee = new Map([[null, newColumn(UNASSIGNED.key, UNASSIGNED.label)]])

  for (const user of rooms.assignableUsers) {
    byAssignee.set(user.id, newColumn(`assignee-${user.id}`, user.displayName))
  }

  for (const room of rooms.allSortedRooms) {
    const assigneeId = room.assignee?.id ?? null
    // 候補一覧に載っていない担当者（ロール変更後など）でも列を作り、学生を落とさない
    if (!byAssignee.has(assigneeId)) {
      byAssignee.set(
        assigneeId,
        newColumn(`assignee-${assigneeId}`, room.assignee?.displayName ?? "")
      )
    }
    byAssignee.get(assigneeId).rooms.push(room)
  }

  return [...byAssignee.values()]
})
// #endregion
</script>

<template>
  <!-- 縦割りが担当人事なので、カードには対応・選考・緊急度の3つとも出す（group-by は渡さない） -->
  <BoardColumns
    :columns="columns"
    label="全学生一覧（担当人事別）"
  />
</template>
