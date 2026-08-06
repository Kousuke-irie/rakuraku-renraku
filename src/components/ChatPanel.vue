<script setup>
// 受信箱の中央トークペイン（B-2 / B-3・frontend.md §5・§7）
//
// ヘッダ（相手の識別情報）＋ MessageList ＋ 入力欄をまとめる。
// InboxView 側の差分を小さく保つために切り出している（一覧 P1-1・プロフィール P2-4 は別コンポーネント）。
//
// - ヘッダのステータスチップは**表示のみ**。1クリック変更（P1-2）は RoomListItem の責務
// - 定型文パレット（P2-1）の開閉・絞り込み状態は useUiStore が持つ。ここでは
//   入力欄のキー操作をストアの action に取り次ぐだけ
// - socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）
import { computed, ref, watch } from "vue"
import { SELECTION_STATUS_META } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useMessagesStore } from "../stores/messages.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"
import MessageList from "./MessageList.vue"
import SnippetPalette from "./SnippetPalette.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UserAvatar from "./UserAvatar.vue"

const props = defineProps({
  /** rooms ストアの room（stores/rooms.js の JSDoc 参照） */
  room: { type: Object, required: true },
})

// #region global state
const auth = useAuthStore()
const messages = useMessagesStore()
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region computed
const roomId = computed(() => props.room.id)

const student = computed(() => props.room.student ?? {})

const selectionStatusLabel = computed(
  () => SELECTION_STATUS_META[student.value.selectionStatus]?.label ?? ""
)

/**
 * MessageList に渡す送信者の表示情報。学生・人事全員・自分を解決できるようにする。
 * 担当者だけでは足りない（担当を外した相手や、代理で返信した別の人事の発言が
 * 名無しになってしまう）ため、人事の名簿（P2-9 のアサイン候補）も混ぜる。
 */
const senders = computed(() => {
  const map = {}

  for (const user of rooms.assignableUsers) {
    map[user.id] = { displayName: user.displayName, avatarColor: user.avatarColor }
  }
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

/** 先頭が "/" で、改行・空白を含まない間だけ定型文コマンドとして扱う（frontend.md §8） */
const snippetCommandQuery = computed(() => {
  const match = /^\/(\S*)$/.exec(draft.value)
  return match ? match[1] : null
})

/** 既読を送る基準になる最新メッセージID（楽観描画中のものは id が無いので除く） */
const lastMessageId = computed(() => {
  const list = messages.messagesOf(roomId.value)
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (list[index].id !== null) return list[index].id
  }
  return null
})
// #endregion

// #region snippet palette（P2-1）
const textareaRef = ref(null)

watch(snippetCommandQuery, (query) => {
  if (query === null) {
    if (ui.snippetPaletteOpen) ui.closeSnippetPalette()
    return
  }

  if (!ui.snippetPaletteOpen) ui.openSnippetPalette()
  ui.setSnippetQuery(query)
})

watch(roomId, () => ui.closeSnippetPalette())

const expandSnippet = (snippet) => {
  messages.setDraft(roomId.value, snippet.body)
  ui.closeSnippetPalette()
  textareaRef.value?.focus()
}

const onComposerKeydown = (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    onSubmit()
    return
  }

  if (!ui.snippetPaletteOpen) return

  if (event.key === "ArrowDown") {
    event.preventDefault()
    ui.moveSnippetHighlight(1)
  } else if (event.key === "ArrowUp") {
    event.preventDefault()
    ui.moveSnippetHighlight(-1)
  } else if (event.key === "Enter") {
    event.preventDefault()
    if (ui.highlightedSnippet) expandSnippet(ui.highlightedSnippet)
  } else if (event.key === "Escape") {
    event.preventDefault()
    ui.closeSnippetPalette()
  }
}
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
        <SnippetPalette
          v-if="ui.snippetPaletteOpen"
          @select="expandSnippet"
        />
        <textarea
          ref="textareaRef"
          v-model="draft"
          class="composer__input"
          rows="3"
          placeholder="メッセージを入力（「/」で定型文を呼び出せます）"
          @keydown="onComposerKeydown"
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
  position: relative;
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
