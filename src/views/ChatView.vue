<script setup>
// S-05 学生用トーク画面（frontend.md §1）
//
// socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）。
// このコンポーネントは Pinia ストアを読み書きするだけで socket.on() を書かない。
import { computed, onMounted, watch } from "vue"
import { useRouter } from "vue-router"
import { SEND_STATUS, SEND_STATUS_META } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useMessagesStore } from "../stores/messages.js"
import { useUiStore } from "../stores/ui.js"

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

const messageList = computed(() => (roomId.value ? messages.messagesOf(roomId.value) : []))

const draft = computed({
  get: () => (roomId.value ? (messages.draftByRoomId[roomId.value] ?? "") : ""),
  set: (value) => roomId.value && messages.setDraft(roomId.value, value),
})

const isMine = (message) => message.senderId === auth.currentUserId

// 送信状態は色ではなくテキストで示す（CLAUDE.md §6-13）
const sendStatusLabel = (message) =>
  isMine(message) && message.sendStatus ? (SEND_STATUS_META[message.sendStatus]?.label ?? "") : ""

const formatTime = (isoString) =>
  // 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2）
  new Date(isoString).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
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
// #endregion

// #region browser event handler
const onPublish = async () => {
  if (!roomId.value || !draft.value.trim()) return
  await messages.sendMessage(roomId.value, draft.value)
}

const onRetry = (clientMsgId) => messages.retryMessage(clientMsgId)

const onExit = async () => {
  await auth.logout()
  router.push({ name: "login" })
}
// #endregion
</script>

<template>
  <div class="chat">
    <header class="chat__header">
      <h1 class="text-h5 font-weight-medium">
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
      </div>
    </header>

    <p
      v-if="!roomId"
      class="chat__empty"
    >
      担当者とのルームがまだありません。採用担当からの連絡をお待ちください。
    </p>

    <ul
      v-else
      class="chat__messages"
    >
      <li
        v-for="message in messageList"
        :key="message.id ?? message.clientMsgId"
        class="message"
        :class="{ 'message--mine': isMine(message) }"
      >
        <!-- 本文はテキスト補間で描画する。v-html は使わない（CLAUDE.md §6-10） -->
        <p class="message__body">
          {{ message.body }}
        </p>
        <p class="message__meta">
          {{ formatTime(message.createdAt) }}
          <span v-if="sendStatusLabel(message)"> ・{{ sendStatusLabel(message) }}</span>
          <button
            v-if="message.sendStatus === SEND_STATUS.FAILED"
            type="button"
            class="message__retry"
            @click="onRetry(message.clientMsgId)"
          >
            再送する
          </button>
        </p>
      </li>
    </ul>

    <form
      class="chat__form"
      @submit.prevent="onPublish"
    >
      <textarea
        v-model="draft"
        class="chat__input"
        rows="3"
        placeholder="メッセージを入力してください"
        :disabled="!roomId"
      />
      <div class="chat__actions">
        <button
          type="submit"
          class="button-normal"
          :disabled="!roomId || !draft.trim()"
        >
          送信
        </button>
        <button
          type="button"
          class="button-normal util-ml-8px"
          @click="onExit"
        >
          ログアウト
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
  margin: 0 auto;
  padding: 24px 16px;
}

.chat__meta {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  font-size: 14px;
}

.chat__offline {
  color: #e5484d;
}

.chat__empty {
  margin-top: 24px;
  font-size: 14px;
}

.chat__messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  margin: 16px 0;
  padding: 0;
  list-style: none;
}

.message {
  max-width: 70%;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
}

.message--mine {
  margin-left: auto;
  background-color: #f5f8fb;
}

.message__body {
  white-space: pre-wrap;
  word-break: break-word;
}

.message__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.message__retry {
  margin-left: 8px;
  text-decoration: underline;
}

.chat__input {
  width: 100%;
  border: 1px solid #888;
  border-radius: 4px;
  padding: 6px 8px;
}

.chat__actions {
  margin-top: 8px;
}

.util-ml-8px {
  margin-left: 8px;
}
</style>
