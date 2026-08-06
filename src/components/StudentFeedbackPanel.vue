<script setup>
// 選考フィードバックの入力（受信箱のプロフィールパネル・P2-11・人事のみ）
//
// 面接直後にその学生の文脈を見ながら書けるよう、ProfilePanel の中に置く。
//
// ★学生に見えるのは「完了済みステップ」のぶんだけ（サーバが絞る）。
//   進行中のステップに書いた内容は、その学生が次の段階へ進むまで本人には出ない。
//   人事が誤解しないよう、ここで「いつ本人に見えるか」を明示する。
import { computed, onMounted, ref, watch } from "vue"
import { SELECTION_FEEDBACK_MAX_LENGTH, SELECTION_STATUS_META } from "../constants/index.js"
import { selectionFlowApi, toErrorMessage } from "../api/index.js"
import { useUiStore } from "../stores/ui.js"

const props = defineProps({
  /** 対象学生の user_id */
  studentUserId: { type: Number, required: true },
  /** その学生の現在の選考ステータス。どこまでが本人に見えるかの判定に使う */
  selectionStatus: { type: String, default: null },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** @type {import('vue').Ref<Record<string, string>>} statusKey → 本文 */
const bodies = ref({})
/** @type {import('vue').Ref<string|null>} 編集中のステップ */
const editingKey = ref(null)
const draft = ref("")
const saving = ref(false)
const loading = ref(false)
// #endregion

// #region computed
/** 有効なステップだけを対象にする（使わない選考にFBを書かせない） */
const steps = computed(() => ui.selectionSteps.filter((step) => step.isEnabled))

/** 学生の現在位置。ここより前のステップに書いたFBは本人に見えている */
const currentIndex = computed(() =>
  steps.value.findIndex((step) => step.statusKey === props.selectionStatus)
)

const rows = computed(() =>
  steps.value.map((step, index) => {
    const isVisibleToStudent = currentIndex.value !== -1 && index < currentIndex.value

    return {
      statusKey: step.statusKey,
      label: step.label || SELECTION_STATUS_META[step.statusKey]?.label || step.statusKey,
      body: bodies.value[step.statusKey] ?? "",
      isVisibleToStudent,
    }
  })
)
// #endregion

// #region local methods
const load = async () => {
  loading.value = true
  try {
    const { data } = await selectionFlowApi.listFeedbacks(props.studentUserId)
    bodies.value = Object.fromEntries(data.feedbacks.map((item) => [item.statusKey, item.body]))
  } catch (error) {
    ui.pushToast({
      type: "error",
      message: toErrorMessage(error, "フィードバックの取得に失敗しました"),
    })
  } finally {
    loading.value = false
  }
}
// #endregion

// #region lifecycle
onMounted(() => {
  ui.fetchSelectionSteps()
  load()
})

// ルームを切り替えたら対象の学生が変わる
watch(
  () => props.studentUserId,
  () => {
    editingKey.value = null
    load()
  }
)
// #endregion

// #region browser event handler
const startEdit = (row) => {
  editingKey.value = row.statusKey
  draft.value = row.body
}

const cancelEdit = () => {
  editingKey.value = null
  draft.value = ""
}

const save = async (statusKey) => {
  saving.value = true
  try {
    const body = draft.value.trim()
    await selectionFlowApi.saveFeedback(props.studentUserId, statusKey, body)
    // 空文字は取り消し。サーバ側で行が消えるのでこちらも空にする
    bodies.value = { ...bodies.value, [statusKey]: body }
    editingKey.value = null
  } catch (error) {
    ui.pushToast({
      type: "error",
      message: toErrorMessage(error, "フィードバックの保存に失敗しました"),
    })
  } finally {
    saving.value = false
  }
}
// #endregion
</script>

<template>
  <section class="feedback">
    <h3 class="feedback__heading">
      選考フィードバック
    </h3>

    <p class="feedback__hint">
      学生には、その学生が通過した選考のぶんだけ表示されます。
    </p>

    <p
      v-if="loading && rows.length === 0"
      class="feedback__empty"
    >
      読み込み中です
    </p>

    <ul
      v-else
      class="feedback__list"
    >
      <li
        v-for="row in rows"
        :key="row.statusKey"
        class="feedback__item"
      >
        <div class="feedback__row">
          <span class="feedback__step">{{ row.label }}</span>
          <span
            v-if="row.isVisibleToStudent"
            class="feedback__visible"
          >本人に公開中</span>
          <span
            v-else
            class="feedback__hidden"
          >本人には非公開</span>
          <button
            type="button"
            class="feedback__edit"
            :disabled="saving"
            @click="editingKey === row.statusKey ? cancelEdit() : startEdit(row)"
          >
            {{ editingKey === row.statusKey ? "やめる" : (row.body ? "編集" : "書く") }}
          </button>
        </div>

        <div v-if="editingKey === row.statusKey">
          <textarea
            v-model="draft"
            class="feedback__input"
            rows="4"
            :maxlength="SELECTION_FEEDBACK_MAX_LENGTH"
            placeholder="学生に伝えるフィードバックを書いてください"
          />
          <div class="feedback__actions">
            <span class="feedback__count">{{ draft.length }} / {{ SELECTION_FEEDBACK_MAX_LENGTH }}</span>
            <button
              type="button"
              class="button-primary feedback__save"
              :disabled="saving"
              @click="save(row.statusKey)"
            >
              保存
            </button>
          </div>
        </div>

        <p
          v-else-if="row.body"
          class="feedback__body"
        >
          {{ row.body }}
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.feedback {
  padding: var(--space-lg) 0 0;
  border-top: 1px solid var(--color-hairline);
}

.feedback__heading {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
}

.feedback__hint {
  margin: 4px 0 var(--space-md);
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.5;
}

.feedback__empty {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.feedback__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.feedback__row {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
}

.feedback__step {
  font-size: 12px;
  font-weight: 700;
}

/* 本人に見えているかは、色ではなく文言で伝える */
.feedback__visible {
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
}

.feedback__hidden {
  color: var(--color-ink-mute);
  font-size: 10px;
}

.feedback__edit {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-link);
  font-size: 11px;
  cursor: pointer;
}

.feedback__edit:hover:not(:disabled) {
  color: var(--color-link-hover);
  text-decoration: underline;
}

.feedback__body {
  margin: 4px 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.feedback__input {
  box-sizing: border-box;
  width: 100%;
  margin-top: var(--space-xs);
  padding: 8px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 12px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
}

.feedback__input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.feedback__actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-xs);
}

.feedback__count {
  color: var(--color-ink-mute);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.feedback__save {
  padding: 4px 12px;
  font-size: 11px;
}
</style>
