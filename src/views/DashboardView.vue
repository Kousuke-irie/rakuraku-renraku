<script setup>
// 監視ダッシュボード（P4-4 / P4-8 / monitoring.md §6）
//
// この画面はタブの器に徹する。中身は2枚のパネルが持つ。
//   全社（P4-4）… 取りこぼしが**どこに**あるかを探す
//   個人（P4-8）… **自分の持ち分**がいまどうなっているかを見る
//
// ★別ページに分けずタブにした理由。
//   両者は同じ指標を違う母数で見るもので、**行き来しながら比べる**のが本来の使い方。
//   URL が同じなら往復が1クリックで済む。ナビレールに項目を増やすと、
//   ほぼ同義の選択肢が2つ並んで毎回選ばせることになる。
//   加えて chart.js の遅延読み込み（/dashboard 単位）がそのまま効く。
//
// 学生には出さない（ルーターガードとサーバ側の requireHr の両方で弾く）。
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  DASHBOARD_SCOPE,
  DASHBOARD_SCOPE_META,
  DASHBOARD_SCOPE_VALUES,
  DEFAULT_DASHBOARD_SCOPE,
} from "../constants/index.js"
import DashboardOverviewPanel from "../components/DashboardOverviewPanel.vue"
import DashboardPersonalPanel from "../components/DashboardPersonalPanel.vue"

// #region constants
const TITLE = "監視ダッシュボード"

const TABS = DASHBOARD_SCOPE_VALUES.map((scope) => ({
  scope,
  label: DASHBOARD_SCOPE_META[scope].label,
}))
// #endregion

// #region local variable
const route = useRoute()
const router = useRouter()
// #endregion

// #region computed
/**
 * タブの状態は URL（`?scope=`）に置く。
 * リロードや共有リンクで同じタブに戻れるようにするため。
 */
const scope = computed(() =>
  DASHBOARD_SCOPE_VALUES.includes(route.query.scope)
    ? route.query.scope
    : DEFAULT_DASHBOARD_SCOPE,
)
// #endregion

// #region browser event handler
const onSelectScope = (next) => {
  if (next === scope.value) return

  router.replace({ query: { ...route.query, scope: next } })
}
// #endregion
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__head">
      <h1 class="dashboard__title">
        {{ TITLE }}
      </h1>

      <div
        class="tabs"
        role="tablist"
        :aria-label="`${TITLE}の表示範囲`"
      >
        <button
          v-for="tab in TABS"
          :key="tab.scope"
          type="button"
          role="tab"
          class="tabs__item"
          :class="{ 'tabs__item--active': tab.scope === scope }"
          :aria-selected="tab.scope === scope"
          @click="onSelectScope(tab.scope)"
        >
          {{ tab.label }}
        </button>
      </div>
    </header>

    <!-- タブを離れたら破棄する。開き直したときは最新を取り直したいので保持しない -->
    <DashboardPersonalPanel v-if="scope === DASHBOARD_SCOPE.PERSONAL" />
    <DashboardOverviewPanel v-else />
  </div>
</template>

<style scoped>
.dashboard {
  height: 100%;
  overflow-y: auto;
  padding: var(--space-xs) var(--space-lg) var(--space-xxl);
}

.dashboard__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  align-items: center;
  margin-bottom: var(--space-md);
}

.dashboard__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

/* --- タブ --- */
.tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
}

.tabs__item {
  padding: 5px 18px;
  border: none;
  border-radius: var(--radius-pill);
  background-color: transparent;
  color: var(--color-ink-mute);
  font-size: 13px;
  cursor: pointer;
}

.tabs__item:hover {
  color: var(--color-ink);
}

/* 選択中は色だけでなく太さでも示す（色が判別できなくても分かるように） */
.tabs__item--active {
  background-color: var(--color-ink);
  color: var(--color-canvas);
  font-weight: 600;
}

.tabs__item--active:hover {
  color: var(--color-canvas);
}
</style>
