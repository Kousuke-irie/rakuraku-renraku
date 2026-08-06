<script setup>
// 受信箱の左ペイン（frontend.md §5 のレイアウト枠）
//
// ★このコンポーネントの責務は検索欄・各パーツの配置・行の反復のみ。
//   1行 → RoomListItem、未対応サマリー → SummaryBar（P1-8）、
//   絞り込みと並べ替え → FilterBar（P1-7）がそれぞれ単独で持つ。
//   項目を足すときはこのファイルではなく、該当のコンポーネントを触ること。
//   絞り込みの判定そのものは roomsStore（filteredRooms / sortedRooms）にある。
import { computed } from "vue"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import FilterBar from "./FilterBar.vue"
import PanelIcon from "./PanelIcon.vue"
import RoomListItem from "./RoomListItem.vue"
import SummaryBar from "./SummaryBar.vue"

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region computed
/** 絞り込みと並べ替えの結果（P1-7）。判定は roomsStore 側にある */
const roomList = computed(() => rooms.sortedRooms)

/** 絞り込み中は「表示件数 / 全件数」を出して、隠れている行があることを分かるようにする */
const countLabel = computed(() =>
  rooms.hasActiveFilters
    ? `${roomList.value.length} / ${rooms.myRooms.length}件`
    : `${roomList.value.length}件`
)

/** 検索欄。入力はそのまま filters.q に入れ、絞り込みは filteredRooms が行う */
const searchQuery = computed({
  get: () => rooms.filters.q,
  set: (value) => rooms.applyFilters({ q: value }),
})
// #endregion
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__head">
      <div class="sidebar__title-row">
        <h2 class="sidebar__title">
          受信箱
        </h2>
        <span class="sidebar__count">{{ countLabel }}</span>
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
        v-model="searchQuery"
        class="sidebar__search"
        type="search"
        placeholder="氏名・大学で検索"
        aria-label="氏名・大学で検索"
      >

      <!-- 未対応サマリー（P1-8）。押すとその条件で絞り込む -->
      <div class="summary-row">
        <SummaryBar />
      </div>

      <!-- フィルタ＆ソート（P1-7） -->
      <div class="filters">
        <FilterBar />
      </div>
    </div>

    <!-- 空状態は「絞り込んだ結果ゼロ」と「そもそも0件」を区別する -->
    <p
      v-if="roomList.length === 0 && rooms.hasActiveFilters"
      class="sidebar__empty"
    >
      条件に一致する学生はいません。
      <button
        type="button"
        class="sidebar__empty-action"
        @click="rooms.clearFilters()"
      >
        条件をクリア
      </button>
    </p>
    <p
      v-else-if="roomList.length === 0"
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

/* 中身の見た目は SummaryBar が持つ。ここは配置だけ */
.summary-row {
  margin-top: var(--space-md);
}

/* 中身の見た目は FilterBar が持つ。ここは配置だけ */
.filters {
  margin-top: var(--space-md);
}

.sidebar__empty {
  padding: var(--space-xxl) var(--space-lg);
  color: var(--color-ink-mute);
  font-size: 13px;
  text-align: center;
}

.sidebar__empty-action {
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

.rooms {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
}
</style>
