<script setup>
// 申し送りメモ（P2-5 / P2-6・frontend.md §9）
//
// 課題 C-4「担当者不在だと引き継げない」への回答。
// 個人メモ／共有メモをタブで切り替え、共有メモは memo:updated で他の人事へ即座に届く。
//
// 状態はすべて roomsStore（memosByRoomId）が持つ。このコンポーネントは
// 入力中の下書きと「どの行を編集中か」だけをローカルに持つ。
// socket の購読は useSocket.js に集約されているので、ここでは socket.on() を書かない。
import { computed, ref, watch } from "vue"
import { MEMO_SCOPE, MEMO_SCOPE_META, MEMO_SCOPE_VALUES } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"

const props = defineProps({
  roomId: { type: Number, required: true },
})

// #region global state
const auth = useAuthStore()
const rooms = useRoomsStore()
const ui = useUiStore()
// #endregion

// #region local state
/** 新規メモの下書き */
const draft = ref("")
/** @type {import('vue').Ref<number|null>} 編集中のメモID */
const editingId = ref(null)
/** 編集中メモの下書き */
const editingBody = ref("")
/** 二重送信の防止 */
const saving = ref(false)
// #endregion

// #region computed
/** 現在のタブに属するメモだけを出す（並び順はストアの memosOf が担う） */
const visibleMemos = computed(() =>
  rooms.memosOf(props.roomId).filter((memo) => memo.scope === ui.memoScope)
)

const emptyText = computed(
  () => `${MEMO_SCOPE_META[ui.memoScope].label}はまだありません。`
)

const placeholder = computed(() =>
  ui.memoScope === MEMO_SCOPE.SHARED
    ? "引き継ぎに必要なことを書く（人事全員に見えます）"
    : "自分用のメモを書く（自分にだけ見えます）"
)

const canSubmit = computed(() => draft.value.trim().length > 0 && !saving.value)
// #endregion

// #region local methods
/** ISO8601(UTC) → ローカル表示。表示時のみ変換する（CLAUDE.md §6-2） */
const formatUpdatedAt = (isoString) =>
  new Date(isoString).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const isMine = (memo) => memo.author?.id === auth.currentUserId

const cancelEdit = () => {
  editingId.value = null
  editingBody.value = ""
}

const selectScope = (scope) => {
  cancelEdit()
  ui.setMemoScope(scope)
}

const submit = async () => {
  if (!canSubmit.value) return

  saving.value = true
  const created = await rooms.createMemo(props.roomId, {
    body: draft.value.trim(),
    scope: ui.memoScope,
  })
  saving.value = false

  // 失敗時は下書きを残す（書き直しを強要しない）。エラーはストアがトーストで出す
  if (created) draft.value = ""
}

const startEdit = (memo) => {
  editingId.value = memo.id
  editingBody.value = memo.body
}

const saveEdit = async () => {
  const body = editingBody.value.trim()
  if (!body || saving.value) return

  saving.value = true
  const updated = await rooms.updateMemo(editingId.value, { body })
  saving.value = false

  if (updated) cancelEdit()
}

/** 個人メモをチーム共有へ昇格する（P2-6）。1クリックで完了させる */
const promote = async (memo) => {
  if (saving.value) return

  saving.value = true
  await rooms.updateMemo(memo.id, { scope: MEMO_SCOPE.SHARED })
  saving.value = false
}

const remove = async (memo) => {
  if (saving.value) return

  saving.value = true
  await rooms.deleteMemo(props.roomId, memo.id)
  saving.value = false
  if (editingId.value === memo.id) cancelEdit()
}
// #endregion

// #region lifecycle
// ルーム切替のたびに取り直す。他の人事が書いた共有メモは socket でも届くが、
// パネルを開いていなかった間の更新はここで拾う（api.md §4-4 と同じ考え方）。
watch(
  () => props.roomId,
  (roomId) => {
    draft.value = ""
    cancelEdit()
    rooms.fetchMemos(roomId)
  },
  { immediate: true }
)
// #endregion
</script>

<template>
  <section class="memo">
    <h3 class="memo__title">
      申し送りメモ
    </h3>

    <!-- 個人／共有の切替（P2-5）。ラベルは MEMO_SCOPE_META から取る -->
    <div
      class="memo__tabs"
      role="tablist"
      aria-label="メモの公開範囲"
    >
      <button
        v-for="scope in MEMO_SCOPE_VALUES"
        :key="scope"
        type="button"
        class="memo__tab"
        :class="{ 'memo__tab--active': scope === ui.memoScope }"
        role="tab"
        :aria-selected="scope === ui.memoScope"
        @click="selectScope(scope)"
      >
        {{ MEMO_SCOPE_META[scope].label }}
      </button>
    </div>

    <div class="memo__compose">
      <textarea
        v-model="draft"
        class="memo__input"
        rows="3"
        :placeholder="placeholder"
        :aria-label="`${MEMO_SCOPE_META[ui.memoScope].label}を書く`"
      />
      <button
        type="button"
        class="memo__button memo__button--accent"
        :disabled="!canSubmit"
        @click="submit"
      >
        追加
      </button>
    </div>

    <p
      v-if="visibleMemos.length === 0"
      class="memo__empty"
    >
      {{ emptyText }}
    </p>

    <ul
      v-else
      class="memo__list"
    >
      <li
        v-for="memo in visibleMemos"
        :key="memo.id"
        class="memo__item"
      >
        <p class="memo__meta">
          <span class="memo__author">{{ memo.author?.displayName }}</span>
          <span>{{ formatUpdatedAt(memo.updatedAt) }}</span>
        </p>

        <!-- 編集中 -->
        <template v-if="editingId === memo.id">
          <textarea
            v-model="editingBody"
            class="memo__input"
            rows="3"
            aria-label="メモを編集する"
          />
          <div class="memo__actions">
            <button
              type="button"
              class="memo__button memo__button--accent"
              :disabled="editingBody.trim().length === 0 || saving"
              @click="saveEdit"
            >
              保存
            </button>
            <button
              type="button"
              class="memo__button"
              @click="cancelEdit"
            >
              キャンセル
            </button>
          </div>
        </template>

        <!-- 通常表示。本文は v-html を使わずテキスト補間で描画する（frontend.md §10-1） -->
        <template v-else>
          <p class="memo__body">
            {{ memo.body }}
          </p>
          <div
            v-if="isMine(memo)"
            class="memo__actions"
          >
            <!-- P2-6：個人メモを1クリックで共有へ昇格する -->
            <button
              v-if="memo.scope === MEMO_SCOPE.PRIVATE"
              type="button"
              class="memo__button memo__button--accent"
              :disabled="saving"
              @click="promote(memo)"
            >
              共有する
            </button>
            <button
              type="button"
              class="memo__button"
              :disabled="saving"
              @click="startEdit(memo)"
            >
              編集
            </button>
            <button
              type="button"
              class="memo__button memo__button--danger"
              :disabled="saving"
              @click="remove(memo)"
            >
              削除
            </button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.memo {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.memo__title {
  font-size: 12px;
  font-weight: 700;
}

.memo__tabs {
  display: flex;
  gap: var(--space-xs);
}

.memo__tab {
  padding: 3px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.memo__tab:hover {
  background-color: var(--color-orange-soft);
}

/* 選択中のタブは面と文字色の両方で示す（色だけに頼らない・CLAUDE.md §6-13） */
.memo__tab--active {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-hairline));
  background-color: var(--color-canvas-orange);
  color: var(--color-ink);
}

.memo__compose {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: flex-end;
}

.memo__input {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
}

.memo__input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.memo__button {
  padding: 3px 12px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.memo__button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-ink) 20%, var(--color-hairline));
  background-color: var(--color-orange-soft);
  color: var(--color-ink);
}

.memo__button:disabled {
  color: color-mix(in srgb, var(--color-ink-mute) 50%, var(--color-canvas));
  cursor: default;
}

.memo__button--accent:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-hairline));
  color: var(--color-ink);
}

.memo__button--danger:not(:disabled) {
  color: var(--color-error);
}

.memo__empty {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.memo__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  list-style: none;
}

.memo__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-orange-soft);
}

.memo__meta {
  display: flex;
  gap: var(--space-sm);
  justify-content: space-between;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.memo__author {
  font-weight: 700;
}

.memo__body {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.memo__actions {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}
</style>
