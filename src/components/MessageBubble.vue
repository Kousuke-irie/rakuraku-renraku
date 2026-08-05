<script setup>
// 吹き出し1件（B-2 / B-3・frontend.md §7・§9）
//
// - 自分＝右寄せ（緑）／相手＝左寄せ（白＋グレー枠）
// - 相手の吹き出し左横にアイコンと氏名。**連続発言では showAvatar=false でアイコンを省略**
// - 送信時刻・送信状態は吹き出しの外側に出す
// - 送信状態は色ではなくテキストラベルで示す（CLAUDE.md §6-13）
// - 本文はテキスト補間で描画する。v-html は使わない（CLAUDE.md §6-10）
import { computed } from "vue"
import {
  DELETED_MESSAGE_TEXT,
  MESSAGE_DELETE_WINDOW_HOURS,
  MESSAGE_TYPE,
  SEND_STATUS,
  SEND_STATUS_META,
} from "../constants/index.js"
import UserAvatar from "./UserAvatar.vue"

// #region constants
const HOUR_IN_MS = 3_600_000
// #endregion

const props = defineProps({
  /** messages ストアの message（stores/messages.js の JSDoc 参照） */
  message: { type: Object, required: true },
  /** 自分の発言か（右寄せ・緑になる） */
  mine: { type: Boolean, default: false },
  /** 相手のアイコンと氏名を出すか。連続発言では false（frontend.md §7） */
  showAvatar: { type: Boolean, default: true },
  /** 相手の表示名。users.display_name */
  senderName: { type: String, default: "" },
  /** 相手の users.avatar_color */
  senderColor: { type: String, default: "" },
  /** 相手が既読にしたか（messages.lastReadByOthers で判定した結果） */
  read: { type: Boolean, default: false },
})

const emit = defineEmits(["retry", "delete"])

// #region computed
// ステータス変更などの自動投稿（constants.md §7）。吹き出しにせず中央に薄く出す
const isSystem = computed(() => props.message.type === MESSAGE_TYPE.SYSTEM)

const isDeleted = computed(() => Boolean(props.message.deletedAt))

const isSending = computed(() => props.message.sendStatus === SEND_STATUS.SENDING)

const isFailed = computed(() => props.message.sendStatus === SEND_STATUS.FAILED)

// 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2）
const time = computed(() =>
  new Date(props.message.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })
)

/** 送信中 → 送信済 → 既読 の遷移（frontend.md §7）。相手の発言には出さない */
const sendStatusLabel = computed(() => {
  if (!props.mine || isDeleted.value) return ""
  if (isSending.value) return SEND_STATUS_META[SEND_STATUS.SENDING].label
  if (isFailed.value) return SEND_STATUS_META[SEND_STATUS.FAILED].label
  return SEND_STATUS_META[props.read ? SEND_STATUS.READ : SEND_STATUS.SENT].label
})

/** 送信取消は自分の発言のみ・送信から24時間以内（B-3） */
const deletable = computed(() => {
  if (!props.mine || isDeleted.value || props.message.id === null) return false

  const elapsedMs = Date.now() - new Date(props.message.createdAt).getTime()
  return elapsedMs < MESSAGE_DELETE_WINDOW_HOURS * HOUR_IN_MS
})
// #endregion
</script>

<template>
  <li
    v-if="isSystem"
    class="row row--system"
  >
    <p class="system">
      {{ message.body }}
    </p>
  </li>

  <li
    v-else
    class="row"
    :class="{ 'row--mine': mine }"
  >
    <!-- 連続発言でもアイコンの幅は空けて、吹き出しの左端を揃える -->
    <span
      v-if="!mine"
      class="row__avatar"
    >
      <UserAvatar
        v-if="showAvatar"
        :display-name="senderName"
        :color="senderColor"
        size="md"
      />
    </span>

    <div class="row__main">
      <p
        v-if="!mine && showAvatar"
        class="row__name"
      >
        {{ senderName }}
      </p>

      <div
        class="bubble"
        :class="{
          'bubble--mine': mine,
          'bubble--deleted': isDeleted,
          'bubble--sending': isSending,
          'bubble--failed': isFailed,
        }"
      >
        <p
          v-if="isDeleted"
          class="bubble__deleted"
        >
          {{ DELETED_MESSAGE_TEXT }}
        </p>
        <p
          v-else
          class="bubble__body"
        >
          {{ message.body }}
        </p>
      </div>

      <p class="meta">
        <span
          v-if="isSending"
          aria-hidden="true"
        >🕐</span>
        <span>{{ time }}</span>
        <span v-if="sendStatusLabel">{{ sendStatusLabel }}</span>
        <button
          v-if="isFailed"
          type="button"
          class="meta__action"
          @click="emit('retry', message.clientMsgId)"
        >
          再送する
        </button>
        <button
          v-if="deletable"
          type="button"
          class="meta__action meta__action--cancel"
          @click="emit('delete', message.id)"
        >
          送信を取り消す
        </button>
      </p>
    </div>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.row--mine {
  flex-direction: row-reverse;
}

.row--system {
  justify-content: center;
}

.system {
  max-width: 70%;
  color: #8b8d98;
  font-size: 12px;
  text-align: center;
}

.row__avatar {
  flex: 0 0 32px;
  width: 32px;
}

.row__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 70%;
}

.row--mine .row__main {
  align-items: flex-end;
}

.row__name {
  margin-bottom: 2px;
  color: #696969;
  font-size: 12px;
}

.bubble {
  padding: 8px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  border-top-left-radius: 2px;
  background-color: #fff;
}

.bubble--mine {
  border-color: #3ea76b;
  border-radius: 12px;
  border-top-right-radius: 2px;
  background-color: #3ea76b;
  color: #fff;
}

/* 送信中は薄字にする（frontend.md §7）。確定したら通常表示に戻る */
.bubble--sending {
  opacity: 0.6;
}

.bubble--failed {
  border-color: #e5484d;
}

.bubble--deleted {
  border-color: #e6e6e6;
  background-color: #f5f5f5;
  color: #8b8d98;
}

.bubble__body {
  /* 改行と長い URL を崩さずに折り返す */
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.55;
}

.bubble__deleted {
  font-size: 13px;
  font-style: italic;
}

.meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 2px;
  color: #8b8d98;
  font-size: 11px;
  line-height: 1;
}

.meta__action {
  color: #1264a3;
  font-size: 11px;
  text-decoration: underline;
}

/* 取消はめったに使わないので、行にカーソル／フォーカスが来たときだけ出す */
.meta__action--cancel {
  visibility: hidden;
}

.row:hover .meta__action--cancel,
.row:focus-within .meta__action--cancel {
  visibility: visible;
}
</style>
