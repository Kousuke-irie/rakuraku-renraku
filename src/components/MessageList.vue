<script setup>
// メッセージ一覧（B-2・frontend.md §7・§9）
//
// 責務：日付セパレータの挿入 / 無限スクロール / 自動スクロール
//
// - 並び順は古い→新しい（ストアが昇順で保持している）。初期表示は最下部へ自動スクロール
// - 上端に到達したら `before` カーソルで過去50件を追い足し、**スクロール位置を補正**して
//   表示位置がジャンプしないようにする
// - socket の購読は composables/useSocket.js に集約されている（CLAUDE.md §6-12）
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { MESSAGE_TYPE } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useMessagesStore } from "../stores/messages.js"
import MessageBubble from "./MessageBubble.vue"

// #region constants
/** 日付セパレータの曜日表記（frontend.md §7：2026年8月5日（水）） */
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"]
/** この距離まで上端に近づいたら過去ログを追い読みする */
const LOAD_MORE_THRESHOLD_PX = 48
/** この距離まで下端に近づいていれば「最下部を見ている」とみなし、新着で追従する */
const AT_BOTTOM_THRESHOLD_PX = 80

const ITEM_KIND = Object.freeze({
  DATE: "date",
  MESSAGE: "message",
})
// #endregion

const props = defineProps({
  /** 表示するルームID。null なら何も表示しない */
  roomId: { type: Number, default: null },
  /**
   * 送信者の表示情報。userId → { displayName, avatarColor }
   * 相手のアイコン・氏名の解決に使う（ルームは1:1だが人事が複数いることがある）
   */
  senders: { type: Object, default: () => ({}) },
  /** senders に無い送信者に使う表示名（学生側から見た人事など、事前に列挙できない相手） */
  defaultSenderName: { type: String, default: "" },
})

// #region global state
const auth = useAuthStore()
const messages = useMessagesStore()
// #endregion

// #region local variable
/** スクロールコンテナ。位置補正のため DOM を直接操作する */
const scroller = ref(null)
/** 最下部を見ているか。新着で自動追従するかの判定に使う */
const atBottom = ref(true)
// #endregion

// #region local methods
/** ローカル日付ごとにグループ化するためのキー */
const dateKeyOf = (isoString) => {
  const date = new Date(isoString)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// 表示のみローカル変換する（CLAUDE.md §6-2）
const dateLabelOf = (isoString) => {
  const date = new Date(isoString)
  const weekday = WEEKDAY_LABELS[date.getDay()]
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`
}

/**
 * メッセージ配列に日付セパレータを挿入し、連続発言のアイコン省略を判定した表示用リストを作る。
 * @param {object[]} list 昇順のメッセージ配列
 */
const buildItems = (list, readUpTo) => {
  const items = []
  let previousDateKey = null
  let previousSenderId = null

  for (const message of list) {
    const dateKey = dateKeyOf(message.createdAt)
    if (dateKey !== previousDateKey) {
      items.push({
        kind: ITEM_KIND.DATE,
        key: `date-${dateKey}`,
        label: dateLabelOf(message.createdAt),
      })
      previousDateKey = dateKey
      // 日付が変わったら連続発言とみなさず、アイコンを出し直す
      previousSenderId = null
    }

    const sender = props.senders[message.senderId] ?? {}
    items.push({
      kind: ITEM_KIND.MESSAGE,
      // 楽観描画中は id が未確定なので clientMsgId を使う
      key: message.id ?? message.clientMsgId,
      message,
      mine: message.senderId === auth.currentUserId,
      showAvatar: message.senderId !== previousSenderId,
      senderName: sender.displayName ?? props.defaultSenderName,
      senderColor: sender.avatarColor ?? "",
      read: message.id !== null && message.id <= readUpTo,
    })

    // システムメッセージを挟んだら連続発言を切る
    previousSenderId = message.type === MESSAGE_TYPE.SYSTEM ? null : message.senderId
  }

  return items
}

const isAtBottom = (element) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= AT_BOTTOM_THRESHOLD_PX

const scrollToBottom = async () => {
  await nextTick()
  if (!scroller.value) return
  scroller.value.scrollTop = scroller.value.scrollHeight
}

/** 上端で過去50件を追い足す。読み込み後にスクロール位置を補正する（frontend.md §7） */
const loadOlder = async () => {
  const { roomId } = props
  const element = scroller.value
  if (!roomId || !element) return
  if (messages.hasMore[roomId] === false || messages.isLoading(roomId)) return

  const before = messages.oldestOf(roomId)?.id
  if (!before) return

  const previousHeight = element.scrollHeight
  const previousTop = element.scrollTop

  await messages.loadHistory(roomId, { before })
  await nextTick()

  // 追い足した分だけ下げると、見えていたメッセージがその場に留まる
  element.scrollTop = element.scrollHeight - previousHeight + previousTop
}
// #endregion

// #region computed
const readUpTo = computed(() =>
  props.roomId ? messages.lastReadByOthers(props.roomId, auth.currentUserId) : 0
)

const items = computed(() =>
  props.roomId ? buildItems(messages.messagesOf(props.roomId), readUpTo.value) : []
)

const isLoadingHistory = computed(() => Boolean(props.roomId) && messages.isLoading(props.roomId))

const isEmpty = computed(() => items.value.length === 0 && !isLoadingHistory.value)
// #endregion

// #region lifecycle
onMounted(scrollToBottom)

// ルームを切り替えたら最下部から見せる
watch(
  () => props.roomId,
  () => {
    atBottom.value = true
    scrollToBottom()
  }
)

// 新着（末尾への追加）のときだけ追従する。過去ログの追い足しでは loadOlder が位置を補正する
watch(
  () => items.value.length,
  (next, previous) => {
    if (next > previous && atBottom.value) scrollToBottom()
  }
)
// #endregion

// #region browser event handler
const onScroll = () => {
  const element = scroller.value
  if (!element) return

  atBottom.value = isAtBottom(element)
  if (element.scrollTop <= LOAD_MORE_THRESHOLD_PX) loadOlder()
}

const onRetry = (clientMsgId) => messages.retryMessage(clientMsgId)

const onDelete = (messageId) => messages.deleteMessage(messageId)
// #endregion
</script>

<template>
  <div
    ref="scroller"
    class="list"
    @scroll.passive="onScroll"
  >
    <!-- 読み込み中は色ではなくテキストで示す（CLAUDE.md §6-13） -->
    <p
      v-if="isLoadingHistory"
      class="list__loading"
      role="status"
    >
      過去のメッセージを読み込み中…
    </p>

    <p
      v-if="isEmpty"
      class="list__empty"
    >
      まだメッセージはありません。
    </p>

    <ol class="list__items">
      <template
        v-for="item in items"
        :key="item.key"
      >
        <li
          v-if="item.kind === ITEM_KIND.DATE"
          class="separator"
        >
          <span class="separator__label">{{ item.label }}</span>
        </li>
        <MessageBubble
          v-else
          :message="item.message"
          :mine="item.mine"
          :show-avatar="item.showAvatar"
          :sender-name="item.senderName"
          :sender-color="item.senderColor"
          :read="item.read"
          @retry="onRetry"
          @delete="onDelete"
        />
      </template>
    </ol>
  </div>
</template>

<style scoped>
.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-lg) var(--space-xxl);
}

.list__loading,
.list__empty {
  padding: var(--space-sm) 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  text-align: center;
}

.list__items {
  list-style: none;
}

.separator {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin: var(--space-xl) 0 var(--space-lg);
}

.separator::before,
.separator::after {
  content: "";
  flex: 1 1 auto;
  border-top: 1px solid var(--color-hairline);
}

/* pill-cap-shade：薄いオレンジ面のピルに micro-cap のトラッキングを効かせる */
.separator__label {
  flex: none;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-pill);
  background-color: var(--color-orange-soft);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  line-height: 1;
  white-space: nowrap;
}
</style>
