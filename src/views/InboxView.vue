<script setup>
// S-03/S-04 受信箱（P1-1・frontend.md §5）
//
// 3ペイン（一覧 360px／トーク 可変／詳細 320px）を薄いオレンジの面に白カードとして並べる。
// 左右ペインは**表示専用のガワ**（InboxSidebar / InboxDetailPane）で、
// P1-1・P1-7・P1-8・P2-4 で各コンポーネントに置き換える。
//
// このビューの責務は URL の :roomId と選択状態の同期のみ。
// トークペインの中身は ChatPanel（B-2/B-3）が持つ。
import { computed, onMounted, watch } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth.js"
import { useMessagesStore } from "../stores/messages.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import ChatPanel from "../components/ChatPanel.vue"
import InboxDetailPane from "../components/InboxDetailPane.vue"
import InboxSidebar from "../components/InboxSidebar.vue"
import UserAvatar from "../components/UserAvatar.vue"

const props = defineProps({
  roomId: { type: String, default: null },
})

// #region global state
const auth = useAuthStore()
const messages = useMessagesStore()
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
// #endregion

// #region computed
const selectedRoom = computed(() =>
  ui.selectedRoomId === null ? null : (rooms.roomById(ui.selectedRoomId) ?? null)
)

/** ルーム未選択時の案内。一覧を閉じているときは開き方を案内する */
const placeholderText = computed(() =>
  ui.roomListOpen
    ? "左の一覧から学生を選んでください。"
    : "一覧を表示して学生を選んでください。"
)
// #endregion

// #region local methods
/** URL の :roomId を選択状態へ反映し、履歴を読み込む（キャッシュ済みなら再取得しない） */
const syncSelectedRoom = async () => {
  ui.selectRoom(props.roomId)
  if (ui.selectedRoomId === null) return

  await messages.ensureLoaded(ui.selectedRoomId)
}
// #endregion

// #region lifecycle
onMounted(async () => {
  // リロード直後は一覧が空なので、ヘッダに出す相手の情報を先に取る
  if (rooms.rooms.length === 0) await rooms.fetchRooms()
  await syncSelectedRoom()
})

watch(() => props.roomId, syncSelectedRoom)
// #endregion

// #region browser event handler
const onLogout = async () => {
  await auth.logout()
  router.push({ name: "login" })
}
// #endregion
</script>

<template>
  <div class="inbox">
    <header class="topbar">
      <p class="topbar__brand">
        楽楽連ラク
      </p>
      <p class="topbar__tagline">
        採用コミュニケーション管理
      </p>

      <div class="topbar__user">
        <UserAvatar
          :display-name="auth.user?.displayName ?? ''"
          :color="auth.user?.avatarColor ?? ''"
          size="sm"
        />
        <span class="topbar__name">{{ auth.user?.displayName }}</span>
        <button
          type="button"
          class="button-normal topbar__logout"
          @click="onLogout"
        >
          ログアウト
        </button>
      </div>
    </header>

    <div
      class="panes"
      :class="{
        'panes--no-rooms': !ui.roomListOpen,
        'panes--no-detail': !ui.profilePanelOpen,
      }"
    >
      <div
        v-if="ui.roomListOpen"
        class="pane pane--rooms"
      >
        <InboxSidebar />
      </div>

      <div class="pane pane--chat">
        <ChatPanel
          v-if="selectedRoom"
          :key="selectedRoom.id"
          :room="selectedRoom"
        />
        <!-- ルーム未選択のときは ChatPanel が出ないので、復帰ボタンをここにも置く -->
        <div
          v-else
          class="pane__placeholder"
        >
          <p>{{ placeholderText }}</p>
          <div class="pane__restore">
            <button
              v-if="!ui.roomListOpen"
              type="button"
              class="button-normal"
              @click="ui.toggleRoomList()"
            >
              <span aria-hidden="true">»</span> 一覧を表示する
            </button>
            <button
              v-if="!ui.profilePanelOpen"
              type="button"
              class="button-normal"
              @click="ui.toggleProfilePanel()"
            >
              詳細を表示する <span aria-hidden="true">«</span>
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="ui.profilePanelOpen"
        class="pane pane--detail"
      >
        <InboxDetailPane :room="selectedRoom" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 画面全体を固定レイヤにして、ページ自体がスクロールしないようにする。
   （内側の一覧・メッセージ列のスクロール量がドキュメント高さに伝播して
   カードごと上へスクロールしてしまうのを防ぐ） */
.inbox {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-md);
  overflow: hidden;
  padding: var(--space-md);
}

.topbar {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  padding: var(--space-md) var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
}

/* ワードマークだけはブランド色を使う（DESIGN.md：orange は面・CTA・ロゴ） */
.topbar__brand {
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.topbar__tagline {
  padding-left: var(--space-md);
  border-left: 1px solid var(--color-hairline);
  color: var(--color-ink-mute);
  font-size: 12px;
}

.topbar__user {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-left: auto;
}

.topbar__name {
  font-size: 13px;
}

.topbar__logout {
  padding: 6px 16px;
  font-size: 12px;
}

.panes {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr) 320px;
  /* 暗黙の行は auto だと中身（一覧の全行）より縮まないため、明示的に minmax(0,1fr) にする。
     これが無いと一覧が長いときにカードごと画面下へはみ出す。 */
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-md);
  min-height: 0;
}

/* 最小化したペインは列そのものを畳み、トークカードが余った幅を受け取る */
.panes--no-rooms {
  grid-template-columns: minmax(0, 1fr) 320px;
}

.panes--no-detail {
  grid-template-columns: 360px minmax(0, 1fr);
}

.panes--no-rooms.panes--no-detail {
  grid-template-columns: minmax(0, 1fr);
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

.pane--chat {
  justify-content: center;
}

.pane__placeholder {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  align-items: center;
  color: var(--color-ink-mute);
  font-size: 14px;
  text-align: center;
}

.pane__restore {
  display: flex;
  gap: var(--space-sm);
}
</style>
