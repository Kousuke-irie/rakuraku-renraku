<script setup>
// login 中の全画面で共通のサイドナビゲーション（S-03〜S-06 の外枠）。
//
// 既定はアイコンだけの細いレール（--nav-rail-width）で、hover / focus すると
// --nav-rail-width-open まで開いてワードマークとラベルが出る。
//
// ★開くときは**絶対配置で上に重ねる**。グリッド列（AppShell）の幅は固定のまま。
//   列幅を動かすと受信箱の3ペインが hover ごとに再レイアウトされ、
//   トーク幅が揺れてメッセージが読めなくなるため。
//
// ★アイコンだけの状態でもラベルは DOM に残す（opacity で消すだけ）。
//   display:none / visibility:hidden にするとスクリーンリーダーから消える。
import { computed } from "vue"
import { useRouter } from "vue-router"
import { HANDLING_STATUS, HANDLING_STATUS_META } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import logoUrl from "../images/logo-rakuraku.png"
import NavIcon from "./NavIcon.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
/** ワードマークの表記は「楽楽連ラク」に統一する（CLAUDE.md §1） */
const BRAND_NAME = "楽楽連ラク"
const NOTIFICATIONS_PATH = "/notifications"
const SETTINGS_PATH = "/settings/profile"
// #endregion

// #region global state
const auth = useAuthStore()
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
// #endregion

// #region computed
/** ホームはロールで変わる（人事＝受信箱／学生＝自分のトーク） */
const home = computed(() =>
  auth.isStudent
    ? { to: auth.homePath, icon: "chat", label: "チャット" }
    : { to: auth.homePath, icon: "inbox", label: "受信箱" }
)

/**
 * 通知バッジの件数。
 * ★P1-8 で GET /api/summary が入ったら `rooms.summary.needsReply` に差し替える。
 *   それまでは InboxSidebar と同じ暫定集計（ルーム一覧からの数え上げ）で出す。
 */
const alertCount = computed(
  () => rooms.rooms.filter((room) => room.handlingStatus === HANDLING_STATUS.NEEDS_REPLY).length
)

/** 件数は色でなくテキストでも伝える（CLAUDE.md §6-13） */
const alertLabel = computed(
  () => `通知：${HANDLING_STATUS_META[HANDLING_STATUS.NEEDS_REPLY].label} ${alertCount.value}件`
)

const accountLabel = computed(
  () => `${auth.user?.displayName ?? ""}のプロフィールを編集する`
)
// #endregion

// #region browser event handler
const onLogout = async () => {
  await auth.logout()
  await router.push({ name: "login" })
}
// #endregion
</script>

<template>
  <nav
    class="rail"
    aria-label="メインナビゲーション"
  >
    <RouterLink
      class="rail__brand"
      :to="home.to"
      :title="BRAND_NAME"
    >
      <!-- 円マークは画像左端の 227x227px ちょうど。枠幅を高さと同じにすると
           円だけ、800/227 倍にするとワードマーク全体が現れる -->
      <span
        class="rail__logo-box"
        aria-hidden="true"
      >
        <img
          :src="logoUrl"
          alt=""
          class="rail__logo"
          width="800"
          height="227"
        >
      </span>
      <span class="sr-only">{{ BRAND_NAME }}</span>
    </RouterLink>

    <ul class="rail__list">
      <li>
        <RouterLink
          class="rail__item"
          :to="home.to"
          :title="home.label"
        >
          <NavIcon :name="home.icon" />
          <span class="rail__label">{{ home.label }}</span>
        </RouterLink>
      </li>

      <!-- 通知は人事の受信箱に対する機能なので学生には出さない -->
      <li v-if="auth.isHr">
        <RouterLink
          class="rail__item"
          :to="NOTIFICATIONS_PATH"
          :title="alertLabel"
          :aria-label="alertLabel"
        >
          <span class="rail__icon-slot">
            <NavIcon name="bell" />
            <span
              v-if="alertCount > 0"
              class="rail__badge"
              aria-hidden="true"
            >{{ alertCount }}</span>
          </span>
          <span class="rail__label">通知</span>
        </RouterLink>
      </li>

      <li>
        <RouterLink
          class="rail__item"
          :to="SETTINGS_PATH"
          title="設定"
        >
          <NavIcon name="settings" />
          <span class="rail__label">設定</span>
        </RouterLink>
      </li>
    </ul>

    <div class="rail__account">
      <!-- アイコンからプロフィール編集ダイアログを開く。ダイアログ本体は
           レールの overflow に閉じ込めないよう AppShell 側に置いてある -->
      <button
        type="button"
        class="rail__item rail__user"
        :title="accountLabel"
        :aria-label="accountLabel"
        @click="ui.openProfileDialog()"
      >
        <UserAvatar
          :display-name="auth.user?.displayName ?? ''"
          :color="auth.user?.avatarColor ?? ''"
          size="md"
        />
        <span class="rail__label">{{ auth.user?.displayName }}</span>
      </button>

      <button
        type="button"
        class="rail__item"
        title="ログアウト"
        :disabled="auth.loading"
        @click="onLogout"
      >
        <NavIcon name="logout" />
        <span class="rail__label">ログアウト</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* AppShell のレール列（--nav-rail-width 固定）を絶対配置で埋め、
   開いたぶんだけ右のコンテンツに覆いかぶさる */
.rail {
  position: absolute;
  z-index: 20;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  width: var(--nav-rail-width);
  overflow: hidden;
  padding: var(--space-md) 0;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
  transition:
    width 180ms ease,
    box-shadow 180ms ease;
}

/* hover で開く。キーボード操作でも開かないと Tab で辿れないので focus も見るが、
   :focus-within ではなく :has(:focus-visible) にする。
   前者だとクリック後もフォーカスが残るためポインタを外しても開いたままになる。 */
.rail:hover,
.rail:has(:focus-visible) {
  width: var(--nav-rail-width-open);
  box-shadow: var(--shadow-2);
}

/* --- ワードマーク ---
   細い状態のロゴ高さ。枠幅をこの値にすると円マークだけが見える */
.rail__brand {
  --brand-height: 30px;

  display: block;
  flex: none;
  /* 円マーク（30px）が細いレールの中央（32px）に来る位置に固定する。
     開閉で横位置が動かないよう padding は変えない */
  padding: 0 0 var(--space-md) calc((var(--nav-rail-width) - var(--brand-height)) / 2);
}

.rail__logo-box {
  display: block;
  width: var(--brand-height);
  overflow: hidden;
  transition: width 180ms ease;
}

/* 画像のアスペクト比 800:227。全体を出すときの枠幅 */
.rail:hover .rail__logo-box,
.rail:has(:focus-visible) .rail__logo-box {
  width: calc(var(--brand-height) * 800 / 227);
}

.rail__logo {
  display: block;
  width: auto;
  height: var(--brand-height);
}

/* --- ナビ項目 --- */
.rail__list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* アイコンが細いレールの中央（32px）に来る左余白で固定する。
   ここを開閉で変えるとアイコンが横滑りして落ち着かない */
.rail__item {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 var(--space-md) 0 22px;
  border: 0;
  background: none;
  color: var(--color-ink-mute);
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  text-decoration: none;
  transition: background-color 120ms ease;
}

.rail__item:hover:not(:disabled) {
  background-color: var(--color-orange-soft);
  color: var(--color-ink);
}

/* アクティブ状態はブランド色で示す（DESIGN.md：オレンジは CTA とアクティブのみ）。
   InboxSidebar の選択行と同じ「左端のインセットバー＋薄い面」に揃える */
.rail__item.router-link-active {
  background-color: color-mix(in srgb, var(--color-primary) 7%, var(--color-canvas));
  box-shadow: inset 3px 0 0 var(--color-primary);
  color: var(--color-primary);
}

.rail__item:disabled {
  color: var(--color-hairline);
}

/* ラベルは細い状態では消すが DOM から外さない（スクリーンリーダー用）。
   幅のアニメーションに少し遅れて出ると、文字が潰れて見えない */
.rail__label {
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  transition: opacity 120ms ease;
}

.rail:hover .rail__label,
.rail:has(:focus-visible) .rail__label {
  opacity: 1;
  transition-delay: 60ms;
}

/* バッジはアイコンの右上に載せる。細い状態でも件数が見えるようにするため */
.rail__icon-slot {
  position: relative;
  display: inline-flex;
  flex: none;
}

.rail__badge {
  position: absolute;
  top: -6px;
  left: 11px;
  min-width: 16px;
  padding: 0 4px;
  border: 1px solid var(--color-canvas);
  border-radius: var(--radius-pill);
  background-color: var(--color-sla-alert);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
}

/* --- アカウント --- */
.rail__account {
  flex: none;
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-hairline);
  margin-top: var(--space-md);
}

/* アバター（32px）を細いレールの中央に置く */
.rail__user {
  height: 44px;
  padding-left: 16px;
}

@media (prefers-reduced-motion: reduce) {
  .rail,
  .rail__logo-box,
  .rail__label {
    transition: none;
  }
}
</style>
