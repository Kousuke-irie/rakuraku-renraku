<script setup>
// 受信箱の中央トークペイン（B-2 / B-3・frontend.md §5・§7）
//
// ヘッダ（相手の識別情報）＋ MessageList ＋ 入力欄をまとめる。
// InboxView 側の差分を小さく保つために切り出している（一覧 P1-1・プロフィール P2-4 は別コンポーネント）。
//
// - 対応ステータスの変更（P1-2）・定型文パレット（P2-1）はこのコンポーネントの責務ではない
// - socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）
import { computed, watch } from "vue"
import { SELECTION_STATUS_META } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useMessagesStore } from "../stores/messages.js"
import { useUiStore } from "../stores/ui.js"
import MessageList from "./MessageList.vue"
import UserAvatar from "./UserAvatar.vue"

const props = defineProps({
  /** rooms ストアの room（stores/rooms.js の JSDoc 参照） */
  room: { type: Object, required: true },
})

// #region global state
const auth = useAuthStore()
const messages = useMessagesStore()
const ui = useUiStore()
// #endregion

// #region computed
const roomId = computed(() => props.room.id)

const student = computed(() => props.room.student ?? {})

const selectionStatusLabel = computed(
  () => SELECTION_STATUS_META[student.value.selectionStatus]?.label ?? ""
)

/** MessageList に渡す送信者の表示情報。学生・自分・担当者を解決できるようにする */
const senders = computed(() => {
  const map = {}

  if (student.value.userId) {
    map[student.value.userId] = {
      displayName: student.value.displayName,
      avatarColor: student.value.avatarColor,
    }
  }
  if (props.room.assignee?.id) {
    map[props.room.assignee.id] = { displayName: props.room.assignee.displayName }
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
  get: () => messages.draftByRoomId[roomId.value] ?? "",
  set: (value) => messages.setDraft(roomId.value, value),
})

const canSend = computed(() => draft.value.trim().length > 0)

/** 既読を送る基準になる最新メッセージID（楽観描画中のものは id が無いので除く） */
const lastMessageId = computed(() => {
  const list = messages.messagesOf(roomId.value)
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].id !== null) return list[index].id
  }
  return null
})
// #endregion

// #region lifecycle
// 開いているルームの新着はその場で既読にする（P2-7）。
// socket の message:read はサーバ側が未実装のため、届かなくても表示は壊れない。
watch(
  lastMessageId,
  (messageId) => {
    if (messageId) messages.sendRead(roomId.value, messageId)
  },
  { immediate: true }
)
// #endregion

// #region browser event handler
const onSubmit = async () => {
  if (!canSend.value) return
  await messages.sendMessage(roomId.value, draft.value)
}
// #endregion
</script>

<template>
  <div class="panel">
    <header class="panel__header">
      <UserAvatar
        :display-name="student.displayName"
        :color="student.avatarColor"
        size="lg"
      />
      <div class="panel__identity">
        <p class="panel__name">
          {{ student.displayName }}
        </p>
        <p class="panel__sub">
          <span v-if="student.university">{{ student.university }}</span>
          <span v-if="selectionStatusLabel">{{ selectionStatusLabel }}</span>
        </p>
      </div>
      <!-- 接続状態は色だけでなくテキストで示す（CLAUDE.md §6-13） -->
      <p
        v-if="ui.isOffline"
        class="panel__offline"
        role="status"
      >
        未接続（再接続中）
      </p>
    </header>

    <MessageList
      :room-id="roomId"
      :senders="senders"
    />

    <p
      v-if="messages.error"
      class="panel__error"
      role="alert"
    >
      {{ messages.error }}
    </p>

    <form
      class="composer"
      @submit.prevent="onSubmit"
    >
      <textarea
        v-model="draft"
        class="composer__input"
        rows="3"
        placeholder="メッセージを入力（⌘／Ctrl + Enter で送信）"
        @keydown.enter.meta.exact.prevent="onSubmit"
        @keydown.enter.ctrl.exact.prevent="onSubmit"
      />
      <div class="composer__actions">
        <button
          type="submit"
          class="composer__send"
          :disabled="!canSend"
        >
          送信
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.panel__header {
  display: flex;
  flex: none;
  gap: 12px;
  align-items: center;
  padding: 12px 24px;
  border-bottom: 1px solid #e6e6e6;
}

.panel__identity {
  min-width: 0;
}

.panel__name {
  font-size: 18px;
  font-weight: 600;
}

.panel__sub {
  display: flex;
  gap: 8px;
  color: #696969;
  font-size: 12px;
}

.panel__offline {
  margin-left: auto;
  color: #e5484d;
  font-size: 12px;
}

.panel__error {
  flex: none;
  padding: 6px 24px;
  color: #e5484d;
  font-size: 12px;
}

.composer {
  flex: none;
  padding: 12px 24px 16px;
  border-top: 1px solid #e6e6e6;
}

.composer__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.55;
  resize: vertical;
}

.composer__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.composer__send {
  padding: 6px 20px;
  border: 1px solid #3ea76b;
  border-radius: 999px;
  background-color: #3ea76b;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.composer__send:disabled {
  border-color: #e6e6e6;
  background-color: #f5f5f5;
  color: #8b8d98;
}
</style>
