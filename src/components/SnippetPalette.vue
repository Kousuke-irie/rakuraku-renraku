<script setup>
// 定型文の絞り込みと展開（P2-1・frontend.md §8）
//
// 一覧・絞り込み・↑↓・Enter/クリックの選択状態は useUiStore が単一で持つ
// （CLAUDE.md §6-11）。このコンポーネントは表示と選択イベントの発火のみを担う。
// 変数プレースホルダ（{学生名} 等）の実データ置換は P2-2 の責務。ここではそのまま表示する。
import { useUiStore } from "../stores/ui.js"

const emit = defineEmits(["select"])

const ui = useUiStore()

const select = (snippet) => {
  emit("select", snippet)
}
</script>

<template>
  <ul
    class="snippet-palette"
    role="listbox"
    aria-label="定型文候補"
  >
    <li
      v-if="ui.filteredSnippets.length === 0"
      class="snippet-palette__empty"
    >
      該当する定型文がありません
    </li>
    <li
      v-for="(snippet, index) in ui.filteredSnippets"
      :key="snippet.id"
    >
      <button
        type="button"
        class="snippet-palette__option"
        :class="{ 'snippet-palette__option--active': index === ui.snippetHighlightIndex }"
        role="option"
        :aria-selected="index === ui.snippetHighlightIndex"
        @mouseenter="ui.snippetHighlightIndex = index"
        @click="select(snippet)"
      >
        <span class="snippet-palette__command">{{ snippet.command }}</span>
        <span class="snippet-palette__title">{{ snippet.title }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.snippet-palette {
  position: absolute;
  z-index: 10;
  bottom: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  max-height: 220px;
  padding: 4px;
  overflow-y: auto;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
  list-style: none;
}

.snippet-palette__empty {
  padding: var(--space-sm) var(--space-md);
  color: var(--color-ink-mute);
  font-size: 13px;
}

.snippet-palette__option {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
  width: 100%;
  padding: 6px var(--space-md);
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: none;
  text-align: left;
  cursor: pointer;
}

.snippet-palette__option:hover {
  background-color: color-mix(in srgb, var(--color-primary) 6%, var(--color-canvas));
}

.snippet-palette__option--active {
  background-color: color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas));
}

.snippet-palette__command {
  flex: none;
  color: var(--color-primary);
  font-weight: 600;
  font-size: 13px;
}

.snippet-palette__title {
  overflow: hidden;
  color: var(--color-ink-mute);
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
}
</style>
