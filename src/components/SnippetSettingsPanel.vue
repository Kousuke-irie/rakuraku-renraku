<script setup>
// 定型文の一覧・追加・削除（設定画面・P2-1拡張）
//
// 展開中の1件だけを SnippetEditor に描画させる。編集フォーム自体の状態
// （コマンド／タイトル／本文の下書き、変数挿入）は SnippetEditor 側に閉じ、
// ここでは「どれを開いているか」と一覧の並びだけを持つ。
import { computed, onMounted, ref } from "vue"
import { useUiStore } from "../stores/ui.js"
import SnippetEditor from "./SnippetEditor.vue"

const NEW_ID = "new"

const ui = useUiStore()

// #region local state
/** @type {import('vue').Ref<number|'new'|null>} 展開中の定型文ID。'new' は追加フォーム */
const expandedId = ref(null)
const saving = ref(false)
// #endregion

// #region computed
const isCreating = computed(() => expandedId.value === NEW_ID)
// #endregion

// #region browser event handler
const toggle = (id) => {
  expandedId.value = expandedId.value === id ? null : id
}

const startCreate = () => {
  expandedId.value = NEW_ID
}

const handleCreate = async (patch) => {
  saving.value = true
  const created = await ui.createSnippet(patch)
  saving.value = false
  if (created) expandedId.value = null
}

const handleUpdate = async (id, patch) => {
  saving.value = true
  const updated = await ui.updateSnippet(id, patch)
  saving.value = false
  if (updated) expandedId.value = null
}

const handleDelete = async (snippet) => {
  saving.value = true
  const ok = await ui.deleteSnippet(snippet.id)
  saving.value = false
  if (ok) expandedId.value = null
}
// #endregion

// #region lifecycle
onMounted(() => ui.fetchSnippets())
// #endregion
</script>

<template>
  <div class="snippet-settings">
    <div class="snippet-settings__toolbar">
      <p class="snippet-settings__hint">
        トークの入力欄で「/」に続けて呼び出せる定型文です。行をクリックすると詳細を編集できます。
      </p>
      <button
        type="button"
        class="button-normal"
        :disabled="isCreating"
        @click="startCreate"
      >
        + 追加
      </button>
    </div>

    <p
      v-if="ui.snippets.length === 0 && !isCreating"
      class="snippet-settings__empty"
    >
      定型文がまだありません
    </p>

    <ul
      v-else
      class="snippet-settings__list"
    >
      <li
        v-for="snippet in ui.snippets"
        :key="snippet.id"
        class="snippet-settings__item"
      >
        <button
          type="button"
          class="snippet-settings__row"
          :aria-expanded="expandedId === snippet.id"
          @click="toggle(snippet.id)"
        >
          <span class="snippet-settings__command">{{ snippet.command }}</span>
          <span class="snippet-settings__title">{{ snippet.title }}</span>
          <span
            class="snippet-settings__chevron"
            aria-hidden="true"
          >{{ expandedId === snippet.id ? "▾" : "▸" }}</span>
        </button>

        <SnippetEditor
          v-if="expandedId === snippet.id"
          :snippet="snippet"
          :saving="saving"
          @save="(patch) => handleUpdate(snippet.id, patch)"
          @cancel="expandedId = null"
          @delete="handleDelete(snippet)"
        />
      </li>

      <li
        v-if="isCreating"
        class="snippet-settings__item"
      >
        <p class="snippet-settings__row snippet-settings__row--static">
          新しい定型文
        </p>
        <SnippetEditor
          :snippet="null"
          :saving="saving"
          @save="handleCreate"
          @cancel="expandedId = null"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.snippet-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.snippet-settings__toolbar {
  display: flex;
  gap: var(--space-lg);
  align-items: flex-start;
  justify-content: space-between;
}

.snippet-settings__hint {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.6;
}

.snippet-settings__empty {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 13px;
}

.snippet-settings__list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.snippet-settings__item + .snippet-settings__item {
  border-top: 1px solid var(--color-hairline);
}

.snippet-settings__row {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  border: 0;
  background: none;
  text-align: left;
}

.snippet-settings__row:not(.snippet-settings__row--static) {
  cursor: pointer;
}

.snippet-settings__row:not(.snippet-settings__row--static):hover {
  background-color: var(--color-orange-soft);
}

.snippet-settings__command {
  flex: none;
  color: var(--color-primary);
  font-weight: 700;
  font-size: 13px;
}

.snippet-settings__title {
  overflow: hidden;
  color: var(--color-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
}

.snippet-settings__row--static .snippet-settings__title,
.snippet-settings__row--static {
  color: var(--color-ink-mute);
  font-weight: 700;
}

.snippet-settings__chevron {
  flex: none;
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 11px;
}
</style>
