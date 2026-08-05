<script setup>
// 受信箱の中央トークペイン（B-2 / B-3・frontend.md §5・§7）
//
// ヘッダ（相手の識別情報）＋ MessageList ＋ 入力欄をまとめる。
// InboxView 側の差分を小さく保つために切り出している（一覧 P1-1・プロフィール P2-4 は別コンポーネント）。
//
// - ヘッダのステータスチップは**表示のみ**。1クリック変更（P1-2）は RoomListItem の責務
// - 定型文パレット（P2-1）はこのコンポーネントの責務ではない
// - socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）
import { computed, watch } from "vue"
import { SELECTION_STATUS_META } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useMessagesStore } from "../stores/messages.js"
import { useUiStore } from "../stores/ui.js"
import MessageList from "./MessageList.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
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
      <!-- 最小化したペインの復帰。畳んだ側のカード端に矢印を出す -->
      <button
        v-if="!ui.roomListOpen"
        type="button"
        class="icon-button panel__restore panel__restore--left"
        title="一覧を表示する"
        aria-label="一覧を表示する"
        @click="ui.toggleRoomList()"
      >
        <span aria-hidden="true">»</span>
      </button>

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
          <span
            v-if="selectionStatusLabel"
            class="panel__dot"
            aria-hidden="true"
          >・</span>
          <span v-if="selectionStatusLabel">{{ selectionStatusLabel }}</span>
        </p>
      </div>

      <div class="panel__status">
        <StatusChip
          :kind="CHIP_KIND.HANDLING"
          :value="room.handlingStatus"
          size="md"
        />
        <!-- 接続状態は色だけでなくテキストで示す（CLAUDE.md §6-13） -->
        <p
          v-if="ui.isOffline"
          class="panel__offline"
          role="status"
        >
          未接続（再接続中）
        </p>
      </div>

      <button
        v-if="!ui.profilePanelOpen"
        type="button"
        class="icon-button panel__restore panel__restore--right"
        title="詳細を表示する"
        aria-label="詳細を表示する"
        @click="ui.toggleProfilePanel()"
      >
        <span aria-hidden="true">«</span>
      </button>
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
      <div class="composer__box">
        <textarea
          v-model="draft"
          class="composer__input"
          rows="3"
          placeholder="メッセージを入力"
          @keydown.enter.meta.exact.prevent="onSubmit"
          @keydown.enter.ctrl.exact.prevent="onSubmit"
        />
        <div class="composer__actions">
          <p class="composer__hint">
            ⌘ / Ctrl + Enter で送信
          </p>
          <button
            type="submit"
            class="button-primary"
            :disabled="!canSend"
          >
            送信
          </button>
        </div>
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
  background-color: var(--color-canvas);
}

.panel__header {
  display: flex;
  flex: none;
  gap: var(--space-md);
  align-items: center;
  /* 罫線はカード幅いっぱいに残したまま、内容だけメッセージ列と同じ幅に揃える */
  padding: var(--space-md) max(var(--space-xxl), calc((100% - var(--chat-column-max)) / 2));
  border-bottom: 1px solid var(--color-hairline);
}

/* 復帰ボタンは畳んだペインがあった側の端に置く。カードが狭いときに
   アバターやステータスチップと重ならないよう、絶対配置にはしない */
.panel__restore--right {
  margin-left: var(--space-xs);
}

.panel__identity {
  min-width: 0;
}

.panel__name {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.panel__sub {
  display: flex;
  gap: 2px;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.panel__dot {
  color: var(--color-hairline);
}

.panel__status {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  margin-left: auto;
}

.panel__offline {
  color: var(--color-sla-alert);
  font-size: 12px;
}

.panel__error {
  flex: none;
  padding: var(--space-sm) var(--space-xxl) 0;
  color: var(--color-error);
  font-size: 12px;
}

.composer {
  flex: none;
  padding: var(--space-md) var(--space-xxl) var(--space-lg);
}

/* 入力欄はカードとして扱い、枠の中にアクション行まで収める（添付レイアウト準拠）。
   幅はメッセージ列（MessageList の .list__items）と揃える */
.composer__box {
  max-width: var(--chat-column-max);
  margin: 0 auto;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  background-color: var(--color-canvas);
  transition: border-color 120ms ease;
}

.composer__box:focus-within {
  border-color: color-mix(in srgb, var(--color-ink) 24%, var(--color-hairline));
  box-shadow: var(--shadow-1);
}

.composer__input {
  display: block;
  width: 100%;
  padding: var(--space-md) var(--space-lg) 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-size: 15px;
  line-height: 1.6;
  resize: none;
}

.composer__input:focus-visible {
  outline: none;
}

.composer__actions {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md) var(--space-md) var(--space-lg);
}

.composer__hint {
  color: var(--color-ink-mute);
  font-size: 11px;
}
</style>
