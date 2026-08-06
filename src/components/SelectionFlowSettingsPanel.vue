<script setup>
// 選考フローの設定（設定画面・P2-11・人事のみ）
//
// ここで決めた「使うステップ」「表示名」「説明・ポイント」が、
// 学生のマイページ（S-09）のフロー図としてそのまま組み立てられる。
//
// ステップの識別子そのものは shared/constants.js の SELECTION_STATUS が正で、
// ここで増やしたり消したりはできない（受信箱・ボード・フィルタが同じ値を使っているため）。
// 会社が決めるのは「どれを使うか」と「学生にどう見せるか」。
import { computed, onMounted, ref, watch } from "vue"
import {
  SELECTION_STEP_LABEL_MAX_LENGTH,
  SELECTION_STEP_TEXT_MAX_LENGTH,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** @type {import('vue').Ref<object[]>} 編集中の下書き（保存するまでストアに戻さない） */
const draft = ref([])
/** @type {import('vue').Ref<string|null>} 詳細を開いているステップ */
const expandedKey = ref(null)
const saving = ref(false)
// #endregion

// #region local methods
/** ストアの値を下書きに写す。label は上書き値だけを持たせたいので既定ラベルと同じなら空にする */
const resetDraft = (steps) => {
  draft.value = steps.map((step) => ({
    statusKey: step.statusKey,
    defaultLabel: step.defaultLabel,
    isEnabled: step.isEnabled,
    label: step.label === step.defaultLabel ? "" : step.label,
    description: step.description ?? "",
    points: step.points ?? "",
  }))
}
// #endregion

// #region computed
const enabledCount = computed(() => draft.value.filter((step) => step.isEnabled).length)

const isDirty = computed(() => {
  if (draft.value.length !== ui.selectionSteps.length) return false

  return draft.value.some((step, index) => {
    const saved = ui.selectionSteps[index]
    const savedLabel = saved.label === saved.defaultLabel ? "" : saved.label
    return (
      step.isEnabled !== saved.isEnabled ||
      step.label !== savedLabel ||
      step.description !== (saved.description ?? "") ||
      step.points !== (saved.points ?? "")
    )
  })
})

/** 有効が0個だとサーバに弾かれるので、押す前に止める */
const canSave = computed(() => !saving.value && isDirty.value && enabledCount.value > 0)
// #endregion

// #region lifecycle
onMounted(async () => {
  await ui.fetchSelectionSteps()
  resetDraft(ui.selectionSteps)
})

watch(
  () => ui.selectionSteps,
  (steps) => {
    if (!isDirty.value) resetDraft(steps)
  }
)
// #endregion

// #region browser event handler
const toggleExpanded = (statusKey) => {
  expandedKey.value = expandedKey.value === statusKey ? null : statusKey
}

const onSubmit = async () => {
  if (!canSave.value) return

  saving.value = true
  const saved = await ui.saveSelectionSteps(
    draft.value.map((step, index) => ({
      statusKey: step.statusKey,
      isEnabled: step.isEnabled,
      sortOrder: index,
      label: step.label.trim() || null,
      description: step.description.trim() || null,
      points: step.points.trim() || null,
    }))
  )
  saving.value = false

  if (saved) resetDraft(saved)
}
// #endregion
</script>

<template>
  <form
    class="flow-settings"
    @submit.prevent="onSubmit"
  >
    <p class="flow-settings__hint">
      使うステップと、学生に見せる説明を設定します。学生のマイページに、ここで有効にしたステップだけが順番に並びます。
    </p>

    <ul class="flow-settings__list">
      <li
        v-for="step in draft"
        :key="step.statusKey"
        class="flow-settings__item"
        :class="{ 'flow-settings__item--off': !step.isEnabled }"
      >
        <div class="flow-settings__row">
          <label class="flow-settings__toggle">
            <input
              v-model="step.isEnabled"
              type="checkbox"
            >
            <span class="sr-only">{{ step.defaultLabel }}を使う</span>
          </label>

          <button
            type="button"
            class="flow-settings__summary"
            :aria-expanded="expandedKey === step.statusKey"
            @click="toggleExpanded(step.statusKey)"
          >
            <span class="flow-settings__name">{{ step.label || step.defaultLabel }}</span>
            <span
              v-if="step.label"
              class="flow-settings__renamed"
            >{{ step.defaultLabel }} を改名</span>
            <span
              v-else-if="!step.isEnabled"
              class="flow-settings__off-note"
            >使わない</span>
            <span
              class="flow-settings__chevron"
              aria-hidden="true"
            >{{ expandedKey === step.statusKey ? "▾" : "▸" }}</span>
          </button>
        </div>

        <div
          v-if="expandedKey === step.statusKey"
          class="flow-settings__editor"
        >
          <label class="flow-settings__field">
            <span class="flow-settings__label">表示名（学生の画面のみ）</span>
            <input
              v-model="step.label"
              type="text"
              class="flow-settings__input"
              :maxlength="SELECTION_STEP_LABEL_MAX_LENGTH"
              :placeholder="step.defaultLabel"
            >
            <span class="flow-settings__note">
              空欄なら「{{ step.defaultLabel }}」と表示されます。受信箱やボードの表記は変わりません。
            </span>
          </label>

          <label class="flow-settings__field">
            <span class="flow-settings__label">この選考について</span>
            <textarea
              v-model="step.description"
              class="flow-settings__body"
              rows="3"
              :maxlength="SELECTION_STEP_TEXT_MAX_LENGTH"
              placeholder="何をする選考か、所要時間や形式を書いてください"
            />
          </label>

          <label class="flow-settings__field">
            <span class="flow-settings__label">ポイント</span>
            <textarea
              v-model="step.points"
              class="flow-settings__body"
              rows="3"
              :maxlength="SELECTION_STEP_TEXT_MAX_LENGTH"
              placeholder="学生に準備してほしいこと、見ている観点など"
            />
          </label>
        </div>
      </li>
    </ul>

    <div class="flow-settings__actions">
      <p
        v-if="enabledCount === 0"
        class="flow-settings__warn"
        role="alert"
      >
        少なくとも1つのステップを有効にしてください。
      </p>
      <p
        v-else
        class="flow-settings__count"
      >
        {{ enabledCount }} ステップを学生に表示します
      </p>

      <div class="flow-settings__buttons">
        <button
          type="button"
          class="button-normal"
          :disabled="!isDirty || saving"
          @click="resetDraft(ui.selectionSteps)"
        >
          変更を破棄
        </button>
        <button
          type="submit"
          class="button-primary"
          :disabled="!canSave"
        >
          保存
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.flow-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.flow-settings__hint {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.6;
}

.flow-settings__list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow-settings__item + .flow-settings__item {
  border-top: 1px solid var(--color-hairline);
}

/* 使わないステップは沈める。並びは変えないので、どれを外したかが分かる */
.flow-settings__item--off .flow-settings__name {
  color: var(--color-ink-mute);
  text-decoration: line-through;
}

.flow-settings__row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  padding-left: var(--space-lg);
}

.flow-settings__toggle {
  display: flex;
  flex: none;
  align-items: center;
  cursor: pointer;
}

.flow-settings__summary {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  width: 100%;
  padding: var(--space-md) var(--space-lg) var(--space-md) var(--space-sm);
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}

.flow-settings__summary:hover {
  background-color: var(--color-orange-soft);
}

.flow-settings__name {
  font-size: 13px;
  font-weight: 700;
}

.flow-settings__renamed,
.flow-settings__off-note {
  color: var(--color-ink-mute);
  font-size: 11px;
}

.flow-settings__chevron {
  margin-left: auto;
  color: var(--color-ink-mute);
  font-size: 11px;
}

/* --- 展開したときの編集フォーム。定型文の編集と同じ体裁に揃える --- */
.flow-settings__editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-top: 1px solid var(--color-hairline);
  background-color: var(--color-canvas-lavender);
}

.flow-settings__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flow-settings__label {
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

.flow-settings__note {
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.6;
}

.flow-settings__input,
.flow-settings__body {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 14px;
  font-family: inherit;
}

.flow-settings__body {
  line-height: 1.6;
  resize: vertical;
}

.flow-settings__input:focus-visible,
.flow-settings__body:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.flow-settings__actions {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
  justify-content: space-between;
}

.flow-settings__count {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.flow-settings__warn {
  margin: 0;
  color: var(--color-error);
  font-size: 12px;
}

.flow-settings__buttons {
  display: flex;
  flex: none;
  gap: var(--space-sm);
}
</style>
