<script setup>
// 受信箱の左ペイン（frontend.md §5 のレイアウト枠）
//
// ★このコンポーネントの責務はヘッダ（検索・サマリー・フィルタ）と行の反復のみ。
//   1行の見た目とふるまいは RoomListItem が単独で持つので、行に項目を足すときは
//   このファイルではなく RoomListItem を触ること。
//
//   検索・サマリークリック・フィルタ・ソートは**まだ非活性**。
//   P1-7（FilterBar）／P1-8（SummaryBar）でそれぞれのコンポーネントに置き換え、
//   件数の算出も P1-8 で GET /api/summary（roomsStore.summary）へ寄せる。
import { computed } from "vue"
import {
  ELAPSED_BADGE_HIDDEN_STATUSES,
  HANDLING_STATUS,
  SLA_ALERT_HOURS,
  SORT_KEY_META,
  URGENCY,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import PanelIcon from "./PanelIcon.vue"
import RoomListItem from "./RoomListItem.vue"

// #region constants
/** 絞り込みの種別。P1-7 で FilterBar に置き換わるまでの見た目だけの並び。
 *  担当者による絞り込み・ソートは提供しない（常に自分の担当のみを表示するため）。 */
const FILTER_LABELS = ["対応", "選考", "タグ", "緊急度"]
// #endregion

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local methods
/** 24h超の集計対象か（返信済み・完了は SLA の対象外・constants.md §9） */
const isOverdue = (room) =>
  !ELAPSED_BADGE_HIDDEN_STATUSES.includes(room.handlingStatus) &&
  (room.elapsedHours ?? 0) >= SLA_ALERT_HOURS
// #endregion

// #region computed
/**
 * 一覧の並びはサーバが既定順（ピン→緊急度→経過時間）で返す。並べ替えUIは P1-7
 * filteredRooms は常にログイン中の人事の担当ルームのみに絞る（rooms ストア参照）。
 */
const roomList = computed(() => rooms.filteredRooms)

/** P1-8 で GET /api/summary に置き換える暫定集計 */
const summaryItems = computed(() => [
  {
    key: "needsReply",
    label: "要返信",
    count: roomList.value.filter((room) => room.handlingStatus === HANDLING_STATUS.NEEDS_REPLY)
      .length,
  },
  {
    key: "urgent",
    label: "緊急",
    count: roomList.value.filter((room) => room.urgency === URGENCY.HIGH).length,
  },
  {
    key: "overdue24h",
    label: `${SLA_ALERT_HOURS}h超`,
    count: roomList.value.filter(isOverdue).length,
  },
])

const sortLabel = computed(() => SORT_KEY_META[rooms.sortKey]?.label ?? "")
// #endregion
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__head">
      <div class="sidebar__title-row">
        <h2 class="sidebar__title">
          受信箱
        </h2>
        <span class="sidebar__count">{{ roomList.length }}件</span>
        <!-- 最小化。復帰用のボタンは畳んだ跡に残る細いカードに出る -->
        <button
          type="button"
          class="icon-button sidebar__collapse"
          title="一覧を最小化する"
          aria-label="一覧を最小化する"
          @click="ui.toggleRoomList()"
        >
          <PanelIcon
            side="left"
            direction="left"
          />
        </button>
      </div>

      <input
        class="sidebar__search"
        type="search"
        placeholder="氏名・大学で検索"
        disabled
      >

      <!-- サマリーバー（P1-8）：件数は実データ、クリックでの絞り込みは未実装 -->
      <ul class="summary">
        <li
          v-for="item in summaryItems"
          :key="item.key"
          class="summary__item"
        >
          <span class="summary__label">{{ item.label }}</span>
          <span class="summary__count">{{ item.count }}</span>
        </li>
      </ul>

      <!-- フィルタ＆ソート（P1-7）：形のみ -->
      <div class="filters">
        <button
          v-for="label in FILTER_LABELS"
          :key="label"
          type="button"
          class="filters__chip"
          disabled
        >
          {{ label }} ▾
        </button>
        <span class="filters__sort">{{ sortLabel }} ▾</span>
      </div>
    </div>

    <p
      v-if="roomList.length === 0"
      class="sidebar__empty"
    >
      対応が必要な学生はいません 🎉
    </p>

    <ol class="rooms">
      <RoomListItem
        v-for="room in roomList"
        :key="room.id"
        :room="room"
      />
    </ol>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background-color: var(--color-canvas);
}

.sidebar__head {
  flex: none;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--color-hairline);
}

.sidebar__title-row {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
}

.sidebar__title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.sidebar__count {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.sidebar__collapse {
  align-self: center;
  margin-left: auto;
}

.sidebar__search {
  width: 100%;
  margin-top: var(--space-md);
  padding: 8px 12px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 13px;
}

.summary {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  list-style: none;
}

.summary__item {
  display: flex;
  flex: 1 1 0;
  gap: var(--space-xs);
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) var(--space-xs);
  border-radius: var(--radius-md);
  background-color: var(--color-orange-soft);
}

.summary__label {
  color: var(--color-ink-mute);
  font-size: 11px;
}

.summary__count {
  font-size: 14px;
  font-weight: 700;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
  margin-top: var(--space-md);
}

.filters__chip {
  padding: 3px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 11px;
}

.filters__sort {
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.sidebar__empty {
  padding: var(--space-xxl) var(--space-lg);
  color: var(--color-ink-mute);
  font-size: 13px;
  text-align: center;
}

.rooms {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
}
</style>
