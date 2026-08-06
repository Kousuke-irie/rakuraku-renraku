<script setup>
// S-05 学生用トーク画面（frontend.md §1）
//
// 吹き出し・日付セパレータ・無限スクロール・送信状態は人事側と同じ
// MessageList / MessageBubble（B-2/B-3）に載せる。
//
// アカウント・ログアウトは全画面共通の AppNavRail（AppShell）が持つ。
// 画面全体の固定レイヤも AppShell 側にあるので、このビューはセルを height:100% で埋めるだけ。
//
// socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）。
// このコンポーネントは Pinia ストアを読み書きするだけで socket.on() を書かない。
import { computed, onMounted, watch } from "vue"
import { useComposerHeight } from "../composables/useComposerHeight.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useMessagesStore } from "../stores/messages.js"
import { useUiStore } from "../stores/ui.js"
import ComposerResizeHandle from "../components/ComposerResizeHandle.vue"
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
// #endregion

// #region composer height
// 長文でも読めるように、入力欄の高さは本文に追従させる（つまみで固定もできる）
const {
  textareaRef,
  manualHeight: composerHeight,
  height: composerCurrentHeight,
  heightStyle: composerStyle,
  minHeight: composerMinHeight,
  maxHeight: composerMaxHeight,
} = useComposerHeight(draft)
// #endregion

// #region computed
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
// #endregion
</script>

<template>
  <div class="chat">
    <div class="chat__card">
      <header class="chat__header">
        <div>
          <h1 class="chat__title">
            採用担当とのチャット
          </h1>
          <p class="chat__meta">
            <span>{{ userName }} さん</span>
            <!-- 接続状態は色だけでなくテキストで示す -->
            <span
              v-if="ui.isOffline"
              class="chat__offline"
              role="status"
            >未接続（再接続中）</span>
          </p>
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
        class="composer"
        @submit.prevent="onPublish"
      >
        <div class="composer__box">
          <!-- 高さ変更のつまみ。ドラッグで固定、ダブルクリックで本文追従に戻す -->
          <ComposerResizeHandle
            v-model="composerHeight"
            :current-height="composerCurrentHeight"
            :min="composerMinHeight"
            :max="composerMaxHeight"
          />
          <textarea
            ref="textareaRef"
            v-model="draft"
            class="composer__input"
            rows="3"
            :style="composerStyle"
            placeholder="メッセージを入力"
            :disabled="!roomId"
            @keydown.enter.meta.exact.prevent="onPublish"
            @keydown.enter.ctrl.exact.prevent="onPublish"
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
  </div>
</template>

<style scoped>
/* 画面全体の固定レイヤは AppShell が持つ。ここはそのセルを埋めて中央寄せするだけ */
.chat {
  height: 100%;
  max-width: 860px;
  margin: 0 auto;
  overflow: hidden;
  padding: var(--space-xs) 0 var(--space-sm);
}

/* 人事側のトークペインと同じ「白カード」の作りに揃える */
.chat__card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.chat__header {
  display: flex;
  flex: none;
  gap: var(--space-md);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xxl);
  border-bottom: 1px solid var(--color-hairline);
}

.chat__title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.chat__meta {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.chat__offline {
  color: var(--color-sla-alert);
}

.chat__empty {
  padding: var(--space-xxl);
  color: var(--color-ink-mute);
  font-size: 13px;
  text-align: center;
}

.chat__error {
  flex: none;
  padding: var(--space-sm) var(--space-xxl) 0;
  color: var(--color-error);
  font-size: 12px;
}

.composer {
  flex: none;
  padding: var(--space-md) var(--space-xxl) var(--space-lg);
}

.composer__box {
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  background-color: var(--color-canvas);
  transition: border-color 120ms ease;
}

.composer__box:focus-within {
  border-color: color-mix(in srgb, var(--color-ink) 24%, var(--color-hairline));
  box-shadow: var(--shadow-1);
}

/* 高さは useComposerHeight が :style で与える（本文追従／つまみで固定）。
   scrollHeight と揃えるため box-sizing は border-box にしておく。
   上端の余白はつまみ（ComposerResizeHandle）が持つので padding-top は詰める */
.composer__input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-xs) var(--space-lg) 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-size: 15px;
  line-height: 1.6;
  /* 上限に達したら入力欄の中でスクロールさせる */
  overflow-y: auto;
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
