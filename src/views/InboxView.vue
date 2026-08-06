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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useMessagesStore } from "../stores/messages.js"
import { useRoomsStore } from "../stores/rooms.js"
import { PANE_WIDTH, useUiStore } from "../stores/ui.js"
import ChatPanel from "../components/ChatPanel.vue"
import InboxDetailPane from "../components/InboxDetailPane.vue"
import InboxSidebar from "../components/InboxSidebar.vue"
import PaneResizer from "../components/PaneResizer.vue"
import PanelIcon from "../components/PanelIcon.vue"

const props = defineProps({
  roomId: { type: String, default: null },
})

// #region global state
const messages = useMessagesStore()
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local state
/** @type {import('vue').Ref<HTMLElement|null>} 3ペインを収めているグリッド */
const panesRef = ref(null)
/** グリッドの実際の横幅。ドラッグの上限をここから出す */
const panesWidth = ref(0)
/** @type {ResizeObserver|null} */
let panesObserver = null
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

/** 最小化中の側はレール幅で固定する */
const roomsColumn = computed(() => (ui.roomListOpen ? ui.roomListWidth : PANE_WIDTH.RAIL))
const detailColumn = computed(() => (ui.profilePanelOpen ? ui.detailWidth : PANE_WIDTH.RAIL))

/**
 * 列の定義。つまみ（PaneResizer）は従来のペイン間の隙間と同じ幅の列として置くので、
 * 幅を変えられるようにしても見た目の余白は変わらない。
 */
const gridTemplateColumns = computed(
  () =>
    `${roomsColumn.value}px ${PANE_WIDTH.RESIZER}px minmax(0, 1fr) ${PANE_WIDTH.RESIZER}px ${detailColumn.value}px`
)

/**
 * 片方を広げすぎてトークペインが潰れないようにする上限。
 * グリッドの実測幅から、反対側のペイン・つまみ・トークの最低幅を引いた残り。
 */
const maxWidthFor = (otherColumn, min) =>
  Math.max(min, panesWidth.value - otherColumn - PANE_WIDTH.RESIZER * 2 - PANE_WIDTH.CHAT_MIN)

const roomListMax = computed(() => maxWidthFor(detailColumn.value, PANE_WIDTH.ROOM_LIST_MIN))
const detailMax = computed(() => maxWidthFor(roomsColumn.value, PANE_WIDTH.DETAIL_MIN))
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
  // ウィンドウ幅やナビレールの開閉でグリッドの幅は変わる。ドラッグの上限に使うので追従させる
  panesObserver = new ResizeObserver(([entry]) => {
    panesWidth.value = entry.contentRect.width
  })
  if (panesRef.value) panesObserver.observe(panesRef.value)

  // リロード直後は一覧が空なので、ヘッダに出す相手の情報を先に取る
  if (rooms.rooms.length === 0) await rooms.fetchRooms()
  // 人事の名簿。担当者の選択肢（P2-9）と、吹き出しの送信者名の解決に使う
  if (rooms.assignableUsers.length === 0) rooms.fetchAssignableUsers()
  await syncSelectedRoom()
})

watch(() => props.roomId, syncSelectedRoom)

onBeforeUnmount(() => panesObserver?.disconnect())
// #endregion
</script>

<template>
  <div
    ref="panesRef"
    class="panes"
    :style="{ gridTemplateColumns }"
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

    <!-- 最小化中はドラッグできないので、隙間だけを空ける -->
    <PaneResizer
      v-if="ui.roomListOpen"
      :model-value="ui.roomListWidth"
      :min="PANE_WIDTH.ROOM_LIST_MIN"
      :max="roomListMax"
      :default-value="PANE_WIDTH.ROOM_LIST"
      label="一覧の幅"
      @update:model-value="ui.setPaneWidth('roomList', $event)"
    />
    <div v-else />

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

    <PaneResizer
      v-if="ui.profilePanelOpen"
      :model-value="ui.detailWidth"
      :min="PANE_WIDTH.DETAIL_MIN"
      :max="detailMax"
      :default-value="PANE_WIDTH.DETAIL"
      :direction="-1"
      label="詳細の幅"
      @update:model-value="ui.setPaneWidth('detail', $event)"
    />
    <div v-else />

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
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めるだけ。
   列の幅は uiStore（ドラッグで可変）から算出して :style で与える。
   ペイン間の隙間は gap ではなく PaneResizer の列が受け持つ（隙間そのものをつまみにするため）。 */
.panes {
  display: grid;
  height: 100%;
  /* 暗黙の行は auto だと中身（一覧の全行）より縮まないため、明示的に minmax(0,1fr) にする。
     これが無いと一覧が長いときにカードごと画面下へはみ出す。 */
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
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
