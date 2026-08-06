<script setup>
// マイページからチャットへの導線（S-09）
//
// 学生のルームは1つだけなので、受信箱のような一覧は作らない。
// 「誰と話しているか」「最後に何が来たか」「未読が何件か」の3つだけを出して、
// あとはチャットに渡す。
//
// ★このカードで返信はしない。マイページの主役は選考フローで、
//   ここに入力欄を置くとチャット画面と役割が二重になる（frontend.md §7-3）。
import { computed } from "vue"
import { LAST_MESSAGE_PREVIEW_LENGTH } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"

// #region constants
const CHAT_PATH = "/chat"
// #endregion

// #region global state
const auth = useAuthStore()
const rooms = useRoomsStore()
// #endregion

// #region computed
/** 学生のルームは1つ。無ければカードは「相談できます」だけの静かな状態に落とす */
const room = computed(() => rooms.rooms[0] ?? null)

const unreadCount = computed(() => room.value?.unreadCount ?? 0)
const hasUnread = computed(() => unreadCount.value > 0)

/** 担当人事。未アサインでも学生に不足を感じさせない中立な文言にする */
const partnerName = computed(() => room.value?.assignee?.displayName ?? "採用担当")

const lastMessage = computed(() => room.value?.lastMessage ?? null)

/** 自分の発言か。誰の発言かが分からないと抜粋が読めない */
const isMine = computed(() => lastMessage.value?.senderId === auth.currentUserId)

const preview = computed(() => {
  const body = lastMessage.value?.body ?? ""
  const trimmed =
    body.length > LAST_MESSAGE_PREVIEW_LENGTH
      ? `${body.slice(0, LAST_MESSAGE_PREVIEW_LENGTH)}…`
      : body

  return isMine.value ? `あなた：${trimmed}` : trimmed
})

/** 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2） */
const time = computed(() => {
  const createdAt = lastMessage.value?.createdAt
  if (!createdAt) return ""

  const date = new Date(createdAt)
  const isToday = date.toDateString() === new Date().toDateString()
  return isToday
    ? date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
})

/** 件数は色でなくテキストでも伝える（CLAUDE.md §6-13） */
const unreadLabel = computed(() => `未読${unreadCount.value}件`)
// #endregion
</script>

<template>
  <RouterLink
    class="chat"
    :class="{ 'chat--unread': hasUnread }"
    :to="CHAT_PATH"
  >
    <header class="chat__head">
      <h2 class="chat__heading">
        {{ partnerName }}
      </h2>

      <span
        v-if="hasUnread"
        class="chat__badge"
      >{{ unreadLabel }}</span>
      <span
        v-else-if="time"
        class="chat__time"
      >{{ time }}</span>
    </header>

    <!-- ★本文はテキスト補間で描画する。v-html は使わない（frontend.md §10-1） -->
    <p
      v-if="preview"
      class="chat__preview"
    >
      {{ preview }}
    </p>
    <p
      v-else
      class="chat__preview chat__preview--empty"
    >
      選考について気になることは、いつでもご相談いただけます。
    </p>

    <p class="chat__action">
      チャットを開く
      <span aria-hidden="true">→</span>
    </p>
  </RouterLink>
</template>

<style scoped>
/* 全体メモ（自分が書くもの）と横に並ぶので、同じ白カードの作りに揃える。
   違いは、未読があるときだけこちらが立ち上がること */
.chat {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.chat:hover,
.chat:focus-visible {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-1);
  outline: none;
}

/* 未読あり：左のオレンジの帯で「自分に届いている」ことを示す。
   FBのカードと同じ言語にして、学生が覚える約束事を1つに保つ */
.chat--unread {
  border-left: 3px solid var(--color-primary);
  background-color: var(--color-orange-soft);
}

.chat__head {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
  justify-content: space-between;
}

.chat__heading {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.chat__badge {
  flex: none;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 700;
}

.chat__time {
  flex: none;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.chat__preview {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.chat__preview--empty {
  color: var(--color-ink-mute);
}

.chat__action {
  margin: 0;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .chat {
    transition: none;
  }
}
</style>
