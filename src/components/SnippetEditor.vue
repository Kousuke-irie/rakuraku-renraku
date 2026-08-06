<script setup>
// 定型文1件の詳細編集フォーム（設定画面・P2-1拡張）
//
// SnippetSettingsPanel から `v-if` で開閉されるため、開くたびに新しいインスタンスとして
// マウントされる。そのため下書き状態はこのコンポーネント内に閉じてよい
// （親の一覧が複数件同時に開かないことが前提。1件だけを展開する設計は親の責務）。
//
// 変数の挿入は本文欄のカーソル位置に差し込む。実データへの置換は P2-2 の責務で、
// ここではプレースホルダ文字列（{学生名} 等）をそのまま本文に埋め込むだけ。
import { computed, nextTick, ref } from "vue"
import { SNIPPET_VARIABLES } from "../constants/index.js"

const props = defineProps({
  /** null は新規作成。既存編集なら { id, command, title, body } */
  snippet: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(["save", "cancel", "delete"])

// #region local state
const command = ref(props.snippet?.command ?? "")
const title = ref(props.snippet?.title ?? "")
const body = ref(props.snippet?.body ?? "")
/** @type {import('vue').Ref<HTMLTextAreaElement|null>} 変数挿入のカーソル位置を読むため */
const bodyRef = ref(null)
// #endregion

// #region computed
const canSave = computed(
  () => !props.saving && command.value.trim() && title.value.trim() && body.value.trim()
)
// #endregion

// #region browser event handler
/** 本文欄のカーソル位置（未フォーカス時は末尾）に変数トークンを挿し込む */
const insertVariable = async (token) => {
  const el = bodyRef.value
  if (!el) {
    body.value += token
    return
  }

  const start = el.selectionStart ?? body.value.length
  const end = el.selectionEnd ?? body.value.length
  body.value = body.value.slice(0, start) + token + body.value.slice(end)

  await nextTick()
  const caret = start + token.length
  el.focus()
  el.setSelectionRange(caret, caret)
}

const save = () => {
  if (!canSave.value) return
  emit("save", { command: command.value.trim(), title: title.value.trim(), body: body.value.trim() })
}
// #endregion
</script>

<template>
  <div class="snippet-editor">
    <div class="snippet-editor__grid">
      <label class="snippet-editor__field">
        <span class="snippet-editor__label">コマンド</span>
        <input
          v-model="command"
          type="text"
          class="snippet-editor__input"
          placeholder="/コマンド名"
        >
      </label>
      <label class="snippet-editor__field">
        <span class="snippet-editor__label">タイトル（一覧表示名）</span>
        <input
          v-model="title"
          type="text"
          class="snippet-editor__input"
          placeholder="例：選考通過連絡"
        >
      </label>
    </div>

    <div class="snippet-editor__field">
      <span class="snippet-editor__label">変数を挿入</span>
      <div class="snippet-editor__variables">
        <button
          v-for="variable in SNIPPET_VARIABLES"
          :key="variable.token"
          type="button"
          class="snippet-editor__variable"
          @click="insertVariable(variable.token)"
        >
          {{ variable.label }}
        </button>
      </div>
    </div>

    <label class="snippet-editor__field">
      <span class="snippet-editor__label">本文</span>
      <textarea
        ref="bodyRef"
        v-model="body"
        class="snippet-editor__body"
        rows="6"
        placeholder="本文を入力してください。変数は上のボタンから挿入できます"
      />
    </label>

    <div class="snippet-editor__actions">
      <button
        v-if="snippet"
        type="button"
        class="button-normal snippet-editor__danger"
        :disabled="saving"
        @click="emit('delete')"
      >
        削除
      </button>
      <div class="snippet-editor__actions-right">
        <button
          type="button"
          class="button-normal"
          :disabled="saving"
          @click="emit('cancel')"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="!canSave"
          @click="save"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snippet-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
  border-top: 1px solid var(--color-hairline);
  background-color: var(--color-canvas-lavender);
}

.snippet-editor__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: var(--space-md);
}

.snippet-editor__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snippet-editor__label {
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

.snippet-editor__input,
.snippet-editor__body {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 14px;
  font-family: inherit;
}

.snippet-editor__body {
  line-height: 1.6;
  resize: vertical;
}

.snippet-editor__input:focus-visible,
.snippet-editor__body:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.snippet-editor__variables {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.snippet-editor__variable {
  padding: 4px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 12px;
  font-weight: 700;
}

.snippet-editor__variable:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.snippet-editor__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.snippet-editor__actions-right {
  display: flex;
  gap: var(--space-sm);
  margin-left: auto;
}

.snippet-editor__danger {
  border-color: color-mix(in srgb, var(--color-error) 40%, var(--color-hairline));
  color: var(--color-error);
}

.snippet-editor__danger:hover:not(:disabled) {
  border-color: var(--color-error);
  background-color: color-mix(in srgb, var(--color-error) 8%, var(--color-canvas-lavender));
}
</style>
