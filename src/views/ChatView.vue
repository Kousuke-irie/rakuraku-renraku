<script setup>
// S-05 学生用トーク画面（frontend.md §1）
//
// 吹き出し・日付セパレータ・無限スクロール・送信状態は人事側と同じ
// MessageList / MessageBubble（B-2/B-3）に載せる。
//
// socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）。
// このコンポーネントは Pinia ストアを読み書きするだけで socket.on() を書かない。
import { computed, onMounted, watch } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useMessagesStore } from "../stores/messages.js"
import { useUiStore } from "../stores/ui.js"
import MessageList from "../components/MessageList.vue"

// #region constants
/** 担当者が未割当のときに相手側の吹き出しへ出す表示名 */
const DEFAULT_PARTNER_NAME = "採用担当"
// #endregion

// #region global state
const auth = useAuthStore()
const rooms = useRoomsStore()
const messages = useMessagesStore()
const ui = useUiStore()
// #endregion

// #region local variable
const router = useRouter()
// #endregion

// #region computed
const userName = computed(() => auth.user?.displayName ?? "")

// 学生は自分のルーム1つだけに所属する（用語：ルーム＝人事と学生1名の1:1）
const roomId = computed(() => rooms.rooms[0]?.id ?? null)

const room = computed(() => rooms.rooms[0] ?? null)

/** 自分と担当者の表示情報。担当者が未割当の人事は defaultSenderName で補う */
const senders = computed(() => {
  const map = {}

  if (room.value?.assignee?.id) {
    map[room.value.assignee.id] = { displayName: room.value.assignee.displayName }
  }
  if (auth.user?.id) {
    map[auth.user.id] = {
      displayName: auth.user.displayName,
      avatarColor: auth.user.avatarColor,
    }
  }

  return map
})

const draft = computed({
  get: () => (roomId.value ? (messages.draftByRoomId[roomId.value] ?? "") : ""),
  set: (value) => roomId.value && messages.setDraft(roomId.value, value),
})

const canSend = computed(() => Boolean(roomId.value) && draft.value.trim().length > 0)

/** 既読を送る基準になる最新メッセージID（楽観描画中のものは id が無いので除く） */
const lastMessageId = computed(() => {
  if (!roomId.value) return null

  const list = messages.messagesOf(roomId.value)
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].id !== null) return list[index].id
  }
  return null
})
// #endregion

// #region local methods
const openMyRoom = async () => {
  if (rooms.rooms.length === 0) await rooms.fetchRooms()
  if (!roomId.value) return

  ui.selectRoom(roomId.value)
  await messages.ensureLoaded(roomId.value)
}
// #endregion

// #region lifecycle
onMounted(openMyRoom)

// socket 再接続で fetchRooms が走った後にルームが判明する場合に備える
watch(roomId, (value) => {
  if (!value) return
  ui.selectRoom(value)
  messages.ensureLoaded(value)
})

// 開いているルームの新着はその場で既読にする（P2-7）
watch(
  lastMessageId,
  (messageId) => {
    if (messageId) messages.sendRead(roomId.value, messageId)
  },
  { immediate: true }
)
// #endregion

// #region browser event handler
const onPublish = async () => {
  if (!canSend.value) return
  await messages.sendMessage(roomId.value, draft.value)
}

const onExit = async () => {
  await auth.logout()
  router.push({ name: "login" })
}
// #endregion
</script>

<template>
  <div class="chat">
    <header class="chat__header">
      <h1 class="chat__title">
        採用担当とのチャット
      </h1>
      <div class="chat__meta">
        <span>ログインユーザ：{{ userName }} さん</span>
        <!-- 接続状態は色だけでなくテキストで示す -->
        <span
          v-if="ui.isOffline"
          class="chat__offline"
          role="status"
        >未接続（再接続中）</span>
        <button
          type="button"
          class="button-normal chat__logout"
          @click="onExit"
        >
          ログアウト
        </button>
      </div>
    </header>

    <p
      v-if="!roomId"
      class="chat__empty"
    >
      担当者とのルームがまだありません。採用担当からの連絡をお待ちください。
    </p>

    <MessageList
      v-else
      :room-id="roomId"
      :senders="senders"
      :default-sender-name="DEFAULT_PARTNER_NAME"
    />

    <p
      v-if="messages.error"
      class="chat__error"
      role="alert"
    >
      {{ messages.error }}
    </p>

    <form
      class="chat__form"
      @submit.prevent="onPublish"
    >
      <textarea
        v-model="draft"
        class="chat__input"
        rows="3"
        placeholder="メッセージを入力（⌘／Ctrl + Enter で送信）"
        :disabled="!roomId"
        @keydown.enter.meta.exact.prevent="onPublish"
        @keydown.enter.ctrl.exact.prevent="onPublish"
      />
      <div class="chat__actions">
        <button
          type="submit"
          class="button-normal"
          :disabled="!canSend"
        >
          送信
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  max-width: 720px;
  height: 100vh;
  min-height: 0;
  margin: 0 auto;
  padding: 24px 16px;
}

.chat__header {
  flex: none;
}

.chat__title {
  font-size: 22px;
  font-weight: 600;
}

.chat__meta {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  font-size: 14px;
}

.chat__logout {
  margin-left: auto;
}

.chat__offline {
  color: #e5484d;
}

.chat__empty {
  margin-top: 24px;
  font-size: 14px;
}

.chat__error {
  flex: none;
  color: #e5484d;
  font-size: 12px;
}

.chat__form {
  flex: none;
  margin-top: 8px;
}

.chat__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
}

.chat__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
