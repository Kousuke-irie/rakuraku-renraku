<script setup>
// 通知一覧（P4-1・ナビレールのベルから開く）
//
// 中身は SLA 監視の結果。学生の最終発言から24時間で担当者へ、48時間で上長へ届く。
// コンプライアンス警告（P4-2）はここには出ない。あちらは宛先を持たず、
// 本人へは送信前ダイアログで伝え、集計はダッシュボード（P4-4）が担う。
//
// 返信すると解消され、既定では一覧から消える（monitoring.md §3）。
// 「上から処理すれば終わる」状態を保つため、片付いたものを残さない。
import { computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { ALERT_KIND, ALERT_KIND_META } from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

// #region global state
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
// #endregion

// #region computed
const unreadCount = computed(() => ui.alertsUnreadCount)

const kindLabel = (kind) => ALERT_KIND_META[kind]?.label ?? kind

/** 経過時間は「25.3時間」ではなく「25時間」で十分。桁を減らして読みやすくする */
const elapsedLabel = (hours) => (hours === null ? "" : `${Math.floor(hours)}時間経過`)

const formatTime = (iso) =>
  new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
// #endregion

// #region lifecycle
onMounted(() => ui.fetchAlerts())
// #endregion

// #region browser event handler
/** 行クリック：既読にしてから該当ルームを開く */
const onOpen = async (alert) => {
  await ui.markAlertRead(alert.id)
  await router.push(`/inbox/${alert.roomId}`)
}
// #endregion
</script>

<template>
  <div class="notifications">
    <div class="card">
      <header class="card__head">
        <div class="card__title-row">
          <h1 class="card__title">
            通知
          </h1>
          <button
            v-if="unreadCount > 0"
            type="button"
            class="button-ghost"
            @click="ui.markAllAlertsRead()"
          >
            すべて既読にする
          </button>
        </div>
        <p class="card__note">
          未読 {{ unreadCount }}件 ／ 表示 {{ ui.alerts.length }}件
        </p>
      </header>

      <p
        v-if="ui.alertsLoaded && ui.alerts.length === 0"
        class="card__placeholder"
      >
        未対応の通知はありません。<br>
        返信が24時間滞ると、ここに通知が届きます。
      </p>

      <ul
        v-else
        class="list"
      >
        <li
          v-for="alert in ui.alerts"
          :key="alert.id"
        >
          <button
            type="button"
            class="row"
            :class="{ 'row--unread': !alert.readAt }"
            @click="onOpen(alert)"
          >
            <!-- 未読は点で示すが、色だけに頼らずテキストも添える（CLAUDE.md §6-13） -->
            <span
              class="row__dot"
              :class="{ 'row__dot--on': !alert.readAt }"
              aria-hidden="true"
            />
            <span class="row__body">
              <span class="row__head">
                <span
                  class="row__kind"
                  :class="{ 'row__kind--escalate': alert.kind === ALERT_KIND.SLA_ESCALATE }"
                >{{ kindLabel(alert.kind) }}</span>
                <span class="row__student">{{ alert.studentName }}</span>
                <span
                  v-if="!alert.readAt"
                  class="sr-only"
                >未読</span>
              </span>
              <span class="row__detail">{{ alert.detail }}</span>
              <span class="row__meta">
                <span v-if="alert.elapsedHours !== null">{{ elapsedLabel(alert.elapsedHours) }}</span>
                <span
                  v-if="alert.assigneeName"
                  class="row__assignee"
                >担当：{{ alert.assigneeName }}</span>
                <span class="row__time">{{ formatTime(alert.createdAt) }}</span>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めて中央寄せするだけ */
.notifications {
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  overflow: hidden;
  padding: var(--space-xs) 0 var(--space-sm);
}

/* 受信箱・トークのペインと同じ「白カード」の作りに揃える */
.card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.card__head {
  flex: none;
  padding: var(--space-lg) var(--space-xxl);
  border-bottom: 1px solid var(--color-hairline);
}

.card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.card__note {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.card__placeholder {
  padding: var(--space-huge) var(--space-xxl);
  color: var(--color-ink-mute);
  font-size: 13px;
  line-height: 1.9;
  text-align: center;
}

.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  width: 100%;
  padding: var(--space-md) var(--space-xxl);
  border: 0;
  border-bottom: 1px solid var(--color-hairline);
  background: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.row:hover {
  background-color: var(--color-orange-soft);
}

.row--unread {
  background-color: var(--color-canvas-cream);
}

.row__dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: var(--radius-pill);
  background-color: transparent;
}

.row__dot--on {
  background-color: var(--color-sla-alert);
}

.row__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.row__kind {
  padding: 1px var(--space-sm);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas-lavender);
  color: var(--color-ink);
  font-size: 11px;
  line-height: 1.6;
}

/* 上長へのエスカレーションは一段強い扱いにする */
.row__kind--escalate {
  background-color: var(--color-sla-alert);
  color: #ffffff;
}

.row__student {
  font-size: 14px;
  font-weight: 600;
}

.row__detail {
  color: var(--color-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  color: var(--color-ink-mute);
  font-size: 12px;
}
</style>
