<script setup>
// S-07 ホーム（frontend.md §5-2）
//
// 人事のログイン後の着地点。ステータスごとの列に学生カードを積んだボードで俯瞰する画面で、
// **返信はここでは行わない**（カードクリックで /inbox/:roomId へ渡す）。
//
// 縦割りの軸は BoardGroupSwitch（対応／選考／緊急度）で切り替える。既定は選考。
// 並び替え UI は持たない（列の中は常に緊急度の高い順で固定）。
//
// 右カラムは AI 現況サマリー（P3-1a）。右下の円形ボタンで開閉する。
// ワードマーク・アカウント・ログアウトは全画面共通の AppNavRail（AppShell）が持つので、
// このビューはセルを height:100% で埋めるだけ。
import { computed, onMounted } from "vue"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import AiLauncherButton from "../components/AiLauncherButton.vue"
import AiSummaryCard from "../components/AiSummaryCard.vue"
import BoardGroupSwitch from "../components/BoardGroupSwitch.vue"
import HomeFilterBar from "../components/HomeFilterBar.vue"
import StudentBoard from "../components/StudentBoard.vue"
import SummaryBar from "../components/SummaryBar.vue"

// #region constants
const TITLE = "ホーム"
/** コンセプトの一文（CLAUDE.md §1）。この画面が何であるかを毎回思い出させる */
const SUBTITLE = "返信すべき学生が、上から順に並んでいます"
/** 検索は Q-5（全文検索にするか氏名のみか）が未決のため、まだ活性にしない */
const SEARCH_HINT = "検索は P1-7 で実装予定です"
// #endregion

// #region global state
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region computed
const roomCount = computed(() => rooms.rooms.length)
// #endregion

// #region lifecycle
onMounted(async () => {
  // 受信箱から戻ってきたときは取得済みなので叩き直さない
  if (rooms.rooms.length === 0) await rooms.fetchRooms()

  // AI 要約はログイン時にサーバ側で生成済みの想定。ここでは取りに行くだけで、
  // 失敗しても一覧の表示は妨げない（business-logic.md §7-2）
  await rooms.fetchAiSummary()
})
// #endregion
</script>

<template>
  <div
    class="home"
    :class="{ 'home--no-ai': !ui.aiPanelOpen }"
  >
    <section class="pane pane--main">
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

          <SummaryBar />

          <input
            class="head__search"
            type="search"
            placeholder="氏名・大学で検索"
            :title="SEARCH_HINT"
            disabled
          >
        </div>

        <div class="head__filter-row">
          <BoardGroupSwitch />
          <HomeFilterBar />
          <span class="head__count">{{ roomCount }}件</span>
        </div>
      </header>

      <StudentBoard />
    </section>

    <aside
      v-if="ui.aiPanelOpen"
      class="pane pane--ai"
    >
      <AiSummaryCard />
    </aside>

    <AiLauncherButton />
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めるだけ */
.home {
  display: grid;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) 320px;
  /* 暗黙の行は auto だと中身（一覧の全行）より縮まないため、明示的に minmax(0,1fr) にする */
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-md);
  min-height: 0;
}

/* AI パネルを閉じたぶんはテーブルが受け取る */
.home--no-ai {
  grid-template-columns: minmax(0, 1fr);
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.pane--main {
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

/* 縦割りの切替とフィルタの間に区切りを入れ、別のコントロールだと分かるようにする */
.head__filter-row > :nth-child(2) {
  padding-left: var(--space-md);
  border-left: 1px solid var(--color-hairline);
}

.head__count {
  flex: none;
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 12px;
  white-space: nowrap;
}

/* AI カード自身が面と影を持つので、この列は入れ物に徹する。
   下端は右下の AI ボタンぶん空ける（カードのフッタにある「要約を生成」が隠れるため） */
.pane--ai {
  min-width: 0;
  padding-bottom: var(--ai-fab-clearance);
}
</style>
