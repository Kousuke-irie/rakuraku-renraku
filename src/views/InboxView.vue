<script setup>
// S-03/S-04 受信箱の3ペインレイアウト枠（P1-1・frontend.md §5）
// 左ペイン（ルーム一覧・P1-1）と右ペイン（ProfilePanel・P2-4）は別タスクで実装する。
//
// このビューの責務は URL の :roomId と選択状態の同期のみ。
// トークペインの中身は ChatPanel（B-2/B-3）が持つ。
import { computed, onMounted, watch } from "vue"
import { useMessagesStore } from "../stores/messages.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import ChatPanel from "../components/ChatPanel.vue"

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
  <div class="inbox">
    <aside class="inbox__rooms">
      <!-- ルーム一覧（P1-1）: RoomListItem を並べる -->
    </aside>

    <section class="inbox__chat">
      <ChatPanel
        v-if="selectedRoom"
        :key="selectedRoom.id"
        :room="selectedRoom"
      />
      <p
        v-else
        class="inbox__placeholder"
      >
        左の一覧から学生を選んでください。
      </p>
    </section>

    <aside class="inbox__profile">
      <!-- 学生プロフィールパネル（P2-4） -->
    </aside>
  </div>
</template>

<style scoped>
.inbox {
  display: flex;
  height: 100vh;
  min-height: 0;
}

.inbox__rooms {
  flex: 0 0 360px;
  width: 360px;
  overflow-y: auto;
  border-right: 1px solid #e6e6e6;
}

.inbox__chat {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.inbox__placeholder {
  margin: auto;
  color: #8b8d98;
  font-size: 14px;
}

.inbox__profile {
  flex: 0 0 280px;
  width: 280px;
  overflow-y: auto;
  border-left: 1px solid #e6e6e6;
}
</style>
