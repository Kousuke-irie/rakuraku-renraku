<script setup>
// S-06 設定（frontend.md §1・/settings/profile）
//
// 2カード構成。左が設定内のナビゲーション、右が選んだ項目の詳細。
// 画面全体の固定レイヤは AppShell が持つので、ここはセルを height:100% で埋めるだけ。
//
// ★このビューは**雛形**である。セクションを増やすときは SECTIONS に足す。
//   - プロフィール … B-5。編集フォーム自体は ProfileDialog を使い回す（二重実装しない）
//   - 定型文       … P2-1 拡張。追加・削除・編集は SnippetSettingsPanel に委譲
//   - 会社情報     … P2-10。編集は CompanySettingsPanel に委譲。**人事のみ**
//                    （学生は編集できず、/chat の CompanyPanel で閲覧するだけ）
//   - アカウント   … ログインIDの表示とログアウトのみ。パスワード変更は要件に無い
//
// セクションの切替はローカル state で持つ。URL に載せる必要が出たら
// /settings/:section のルートに昇格させる（今は S-06 = /settings/profile 単一）。
import { computed, ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth.js"
import { useUiStore } from "../stores/ui.js"
import CompanySettingsPanel from "../components/CompanySettingsPanel.vue"
import SnippetSettingsPanel from "../components/SnippetSettingsPanel.vue"
import UserAvatar from "../components/UserAvatar.vue"

// #region constants
/** 設定内のナビゲーション。key は下の v-if と対応する */
const BASE_SECTIONS = Object.freeze([
  { key: "profile", label: "プロフィール", note: "表示名・ステータス" },
  { key: "snippets", label: "定型文", note: "コマンドと本文" },
])

/** 人事だけに出すセクション（P2-10）。学生は会社情報を閲覧するだけで編集できない */
const HR_SECTIONS = Object.freeze([
  { key: "company", label: "会社情報", note: "学生に見せる自社紹介" },
])

const ACCOUNT_SECTION = Object.freeze({ key: "account", label: "アカウント", note: "ログイン情報" })

const NOT_SET_LABEL = "未設定"
// #endregion

// #region global state
const auth = useAuthStore()
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()

/** 表示中のセクション。既定は S-06 の本来の対象であるプロフィール */
const activeKey = ref("profile")
// #endregion

// #region computed
/** アカウントは常に最下段に置きたいので、人事限定のセクションはその手前に差し込む */
const sections = computed(() => [
  ...BASE_SECTIONS,
  ...(auth.isHr ? HR_SECTIONS : []),
  ACCOUNT_SECTION,
])

const activeSection = computed(
  () => sections.value.find((section) => section.key === activeKey.value) ?? sections.value[0]
)

const statusMessage = computed(() => auth.user?.statusMessage || NOT_SET_LABEL)
// #endregion

// #region browser event handler
const onLogout = async () => {
  await auth.logout()
  await router.push({ name: "login" })
}
// #endregion
</script>

<template>
  <div class="settings">
    <!-- 左：設定内のナビゲーション -->
    <nav
      class="card card--nav"
      aria-label="設定"
    >
      <h1 class="card__title card__title--nav">
        設定
      </h1>

      <ul class="menu">
        <li
          v-for="section in sections"
          :key="section.key"
        >
          <button
            type="button"
            class="menu__item"
            :class="{ 'menu__item--active': section.key === activeKey }"
            :aria-current="section.key === activeKey ? 'true' : undefined"
            @click="activeKey = section.key"
          >
            <span class="menu__label">{{ section.label }}</span>
            <span class="menu__note">{{ section.note }}</span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- 右：選んだ項目の詳細 -->
    <section class="card card--detail">
      <header class="card__head">
        <h2 class="card__title">
          {{ activeSection.label }}
        </h2>
      </header>

      <div class="card__body">
        <!-- プロフィール（B-5）。編集は ProfileDialog に寄せる -->
        <template v-if="activeKey === 'profile'">
          <div class="identity">
            <UserAvatar
              :display-name="auth.user?.displayName ?? ''"
              :color="auth.user?.avatarColor ?? ''"
              size="lg"
            />
            <div>
              <p class="identity__name">
                {{ auth.user?.displayName }}
              </p>
              <p class="identity__status">
                {{ statusMessage }}
              </p>
            </div>
          </div>

          <dl class="rows">
            <div class="row">
              <dt class="row__key">
                表示名
              </dt>
              <dd class="row__value">
                {{ auth.user?.displayName }}
              </dd>
            </div>
            <div class="row">
              <dt class="row__key">
                ステータスメッセージ
              </dt>
              <dd class="row__value">
                {{ statusMessage }}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            class="button-primary"
            @click="ui.openProfileDialog()"
          >
            プロフィールを編集
          </button>
        </template>

        <!-- 定型文（P2-1 拡張：コマンドの追加・削除・編集） -->
        <template v-else-if="activeKey === 'snippets'">
          <SnippetSettingsPanel />
        </template>

        <!-- 会社情報（P2-10）。学生の /chat の右パネルに出る内容 -->
        <template v-else-if="activeKey === 'company'">
          <CompanySettingsPanel />
        </template>

        <!-- アカウント -->
        <template v-else>
          <dl class="rows">
            <div class="row">
              <dt class="row__key">
                ログインID
              </dt>
              <dd class="row__value">
                {{ auth.user?.loginId }}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            class="button-normal"
            :disabled="auth.loading"
            @click="onLogout"
          >
            ログアウト
          </button>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めるだけ */
.settings {
  display: grid;
  height: 100%;
  max-width: 960px;
  margin: 0 auto;
  grid-template-columns: 240px minmax(0, 1fr);
  /* 暗黙の行は auto だと中身より縮まないため、明示的に minmax(0,1fr) にする */
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-md);
  min-height: 0;
  padding: var(--space-xs) 0 var(--space-sm);
}

/* 受信箱・トークのペインと同じ「白カード」の作りに揃える */
.card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.card--nav {
  padding-bottom: var(--space-sm);
}

.card__head {
  flex: none;
  padding: var(--space-lg) var(--space-xxl);
  border-bottom: 1px solid var(--color-hairline);
}

.card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.card__title--nav {
  flex: none;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--color-hairline);
}

.card__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-xxl);
}

/* --- 左カードのメニュー --- */
.menu {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: var(--space-sm) 0 0;
  padding: 0;
  list-style: none;
}

.menu__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: var(--space-sm) var(--space-lg);
  border: 0;
  background: none;
  color: var(--color-ink);
  text-align: left;
  transition: background-color 120ms ease;
}

.menu__item:hover {
  background-color: var(--color-orange-soft);
}

/* 選択中はブランド色で示す（DESIGN.md：オレンジは CTA とアクティブ状態のみ）。
   受信箱の選択行・ナビレールと同じ「左端のインセットバー＋薄い面」に揃える */
.menu__item--active {
  background-color: color-mix(in srgb, var(--color-primary) 7%, var(--color-canvas));
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.menu__label {
  font-size: 14px;
  font-weight: 700;
}

.menu__item--active .menu__label {
  color: var(--color-primary);
}

.menu__note {
  color: var(--color-ink-mute);
  font-size: 11px;
}

/* --- 右カードの中身 --- */
.identity {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-hairline);
}

.identity__name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.identity__status {
  margin: 2px 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.rows {
  margin: 0 0 var(--space-xxl);
}

.row {
  display: flex;
  gap: var(--space-lg);
  align-items: baseline;
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--color-hairline);
}

.row__key {
  flex: none;
  width: 160px;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.row__value {
  margin: 0;
  font-size: 14px;
}

</style>
