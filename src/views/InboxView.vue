<script setup>
// S-03/S-04 受信箱（P1-1・frontend.md §5）
//
// 3ペイン（一覧 360px／トーク 可変／詳細 320px）を薄いオレンジの面に白カードとして並べる。
// 左右ペインは**表示専用のガワ**（InboxSidebar / InboxDetailPane）で、
// P1-1・P1-7・P1-8・P2-4 で各コンポーネントに置き換える。
//
// ワードマーク・アカウント・ログアウトは全画面共通の AppNavRail（AppShell）が持つ。
// 画面全体の固定レイヤも AppShell 側にあるので、このビューはセルを height:100% で埋めるだけ。
//
// このビューの責務は URL の :roomId と選択状態の同期のみ。
// トークペインの中身は ChatPanel（B-2/B-3）が持つ。
import { computed, onMounted, watch } from "vue"
import { useMessagesStore } from "../stores/messages.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import ChatPanel from "../components/ChatPanel.vue"
import InboxDetailPane from "../components/InboxDetailPane.vue"
import InboxSidebar from "../components/InboxSidebar.vue"
import PanelIcon from "../components/PanelIcon.vue"

const props = defineProps({
  roomId: { type: String, default: null },
})

// #region global state
const messages = useMessagesStore()
const rooms = useRoomsStore()
const ui = useUiStore()
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
</script>

<template>
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
    <!-- 最小化中はアイコン幅の細いカードだけ残し、そこから復帰させる -->
    <div
      v-else
      class="pane pane--rail"
    >
      <button
        type="button"
        class="icon-button"
        title="一覧を表示する"
        aria-label="一覧を表示する"
        @click="ui.toggleRoomList()"
      >
        <PanelIcon
          side="left"
          direction="right"
        />
      </button>
    </div>

    <div class="pane pane--chat">
      <ChatPanel
        v-if="selectedRoom"
        :key="selectedRoom.id"
        :room="selectedRoom"
      />
      <p
        v-else
        class="pane__placeholder"
      >
        {{ placeholderText }}
      </p>
    </div>

    <div
      v-if="ui.profilePanelOpen"
      class="pane pane--detail"
    >
      <InboxDetailPane :room="selectedRoom" />
    </div>
    <div
      v-else
      class="pane pane--rail"
    >
      <button
        type="button"
        class="icon-button"
        title="詳細を表示する"
        aria-label="詳細を表示する"
        @click="ui.toggleProfilePanel()"
      >
        <PanelIcon
          side="right"
          direction="left"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めるだけ */
.panes {
  /* 最小化した側に残すレールの幅（アイコンボタン 28px ＋ 左右 8px）。
     全画面共通のナビレール（--nav-rail-width）とは別物 */
  --pane-rail-width: 44px;

  display: grid;
  height: 100%;
  grid-template-columns: 360px minmax(0, 1fr) 320px;
  /* 暗黙の行は auto だと中身（一覧の全行）より縮まないため、明示的に minmax(0,1fr) にする。
     これが無いと一覧が長いときにカードごと画面下へはみ出す。 */
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-md);
  min-height: 0;
}

/* 最小化した側はアイコン幅のレールだけ残し、余った幅はトークカードが受け取る */
.panes--no-rooms {
  grid-template-columns: var(--pane-rail-width) minmax(0, 1fr) 320px;
}

.panes--no-detail {
  grid-template-columns: 360px minmax(0, 1fr) var(--pane-rail-width);
}

.panes--no-rooms.panes--no-detail {
  grid-template-columns: var(--pane-rail-width) minmax(0, 1fr) var(--pane-rail-width);
}

/* レールはアイコンボタン（28px）＋左右の余白ぶんの幅しか持たない */
.pane--rail {
  align-items: center;
  padding-top: var(--space-md);
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
  color: var(--color-ink-mute);
  font-size: 14px;
  text-align: center;
}
</style>
