<script setup>
// S-08 全学生（frontend.md §5-3）
//
// 受信箱（S-03/S-04）とホーム（S-07）は担当制で、**自分の担当学生しか出ない**
// （roomsStore.myRooms・#28）。この画面は担当外と未配属も含めた全学生を、
// 担当人事ごとの列で俯瞰する「拾い上げ」のための画面。
//
// レイアウトはホームと同じボードだが、
//   - 縦割りは担当人事に固定（切替 UI なし。未配属が一番左）
//   - 未対応サマリー（P1-8）は自分の担当ではなく**全学生**の件数で出す
//   - AI 現況サマリー（P3-1a）は持たない
// の3点が違う。返信はここでは行わず、カードクリックで /inbox/:roomId へ渡す。
import { computed, onMounted } from "vue"
import { useRoomsStore } from "../stores/rooms.js"
import AssigneeBoard from "../components/AssigneeBoard.vue"
import FilterBar from "../components/FilterBar.vue"
import SummaryBar, { SUMMARY_SCOPE } from "../components/SummaryBar.vue"

// #region constants
const TITLE = "全学生"
/** この画面が受信箱と何が違うのかを毎回思い出させる一文 */
const SUBTITLE = "担当外・未配属も含めた全学生を、担当人事ごとに並べています"
// #endregion

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region computed
const roomCount = computed(() => rooms.allSortedRooms.length)

/** 検索欄。絞り込み条件は受信箱・ホームと共有する（roomsStore.filters・frontend.md §3） */
const searchQuery = computed({
  get: () => rooms.filters.q,
  set: (value) => rooms.applyFilters({ q: value }),
})
// #endregion

// #region lifecycle
onMounted(async () => {
  // 他の画面から来たときは取得済みなので叩き直さない
  if (rooms.rooms.length === 0) await rooms.fetchRooms()

  // 担当が0名の人事も列として出すため、人事の一覧が必要（P2-9 と同じ候補一覧）
  if (rooms.assignableUsers.length === 0) await rooms.fetchAssignableUsers()
})
// #endregion
</script>

<template>
  <div class="students">
    <section class="pane">
      <header class="head">
        <div class="head__title-row">
          <div class="head__heading">
            <h1 class="head__title">
              {{ TITLE }}
            </h1>
            <p class="head__subtitle">
              {{ SUBTITLE }}
            </p>
          </div>

          <!-- 件数は自分の担当ではなく全学生から数える（この画面に出ている範囲と揃える） -->
          <SummaryBar :scope="SUMMARY_SCOPE.ALL" />

          <input
            v-model="searchQuery"
            class="head__search"
            type="search"
            placeholder="氏名・大学で検索"
            aria-label="氏名・大学で検索"
          >
        </div>

        <div class="head__filter-row">
          <FilterBar />
          <span class="head__count">{{ roomCount }}件</span>
        </div>
      </header>

      <!-- ボード自身は height:100% で入れ物を埋めるので、下端の余白はここで作る -->
      <div class="board-slot">
        <AssigneeBoard />
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めるだけ。
   ホームと違い右カラム（AI）が無いので1カラム */
.students {
  display: grid;
  height: 100%;
  grid-template-columns: minmax(0, 1fr);
  /* 暗黙の行は auto だと中身（ボードの全カード）より縮まないため、明示的に minmax(0,1fr) にする */
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.head {
  flex: none;
  padding: var(--space-xl) var(--space-xl) var(--space-md);
  border-bottom: 1px solid var(--color-hairline);
}

.head__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  align-items: center;
}

.head__heading {
  flex: 1 1 auto;
  min-width: 0;
}

.head__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.head__subtitle {
  margin: 2px 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.head__search {
  flex: none;
  width: 240px;
  padding: 8px 14px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 13px;
}

.head__filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: center;
  margin-top: var(--space-lg);
}

.head__count {
  flex: none;
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 12px;
  white-space: nowrap;
}

/* 最後のカードが枠の下端に貼り付かないよう、ボードの外で余白を作る */
.board-slot {
  flex: 1 1 auto;
  min-height: 0;
  padding-bottom: var(--space-md);
}
</style>
