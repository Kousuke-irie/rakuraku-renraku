<script setup>
// 選考フィードバックの入力（受信箱のプロフィールパネル・P2-11・人事のみ）
//
// 面接直後にその学生の文脈を見ながら書けるよう、ProfilePanel の中に置く。
//
// ★学生に見えるのは「通過済みステップ」のぶんだけ。
//   進行中のステップに書いた内容は、その学生が次の段階へ進むまで本人には出ない。
//   人事が誤解しないよう、ここで「いつ本人に見えるか」を明示する。
//
// ★★「本人に見えているか」を**この画面で計算しない。**
//   サーバが学生側と同じ判定（selectionFlow.js の isFeedbackVisibleToStudent）を通した
//   結果を返すので、それを描くだけにする。ここで独自に判定すると、現在地が無効ステップに
//   ある学生などで学生側とズレて、「本人には非公開」と出ているFBが実際は本人に見えている、
//   という事故になる（実際に起きていた）。
import { onMounted, ref, watch } from "vue"
import { SELECTION_FEEDBACK_MAX_LENGTH } from "../constants/index.js"
import { selectionFlowApi, toErrorMessage } from "../api/index.js"
import { useUiStore } from "../stores/ui.js"

const props = defineProps({
  /** 対象学生の user_id */
  studentUserId: { type: Number, required: true },
  /**
   * その学生の現在の選考ステータス。
   * ★これで可視範囲を判定しない。**取り直しのきっかけとしてだけ**使う。
   *   人事がステータスを進めると本人に見えるFBが増えるので、その瞬間に取り直す。
   */
  selectionStatus: { type: String, default: null },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/**
 * サーバから受け取った行。ラベル・状態・本人に見えているか・本文がすべて入っている。
 * @type {import('vue').Ref<{statusKey: string, label: string, isVisibleToStudent: boolean,
 *                           isEnabled: boolean, feedback: {body: string}|null}[]>}
 */
const rows = ref([])

/** @type {import('vue').Ref<string|null>} 編集中のステップ */
const editingKey = ref(null)
const draft = ref("")
const saving = ref(false)
const loading = ref(false)
// #endregion

// #region local methods
const load = async () => {
  loading.value = true
  try {
    const { data } = await selectionFlowApi.listFeedbacks(props.studentUserId)
    rows.value = data.steps
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
// ステップの並び・ラベルも load() のレスポンスに含まれるので、
// ここで選考フローの設定を別途取りに行く必要はない
onMounted(load)

// 対象の学生が変わったとき（ルーム切り替え）と、
// 選考ステータスが進んだとき（本人に見えるFBが増える）に取り直す
watch(
  () => [props.studentUserId, props.selectionStatus],
  () => {
    editingKey.value = null
    load()
  }
)
// #endregion

// #region browser event handler
const startEdit = (row) => {
  editingKey.value = row.statusKey
  draft.value = row.feedback?.body ?? ""
}

const cancelEdit = () => {
  editingKey.value = null
  draft.value = ""
}

const save = async (statusKey) => {
  saving.value = true
  try {
    const body = draft.value.trim()
    const { data } = await selectionFlowApi.saveFeedback(props.studentUserId, statusKey, body)

    // 空文字は取り消し。サーバ側で行が消えて feedback は null で返る。
    // 既存を書き換えず新しい配列に差し替える
    rows.value = rows.value.map((row) =>
      row.statusKey === statusKey ? { ...row, feedback: data.feedback } : row
    )
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
            {{ editingKey === row.statusKey ? "やめる" : (row.feedback ? "編集" : "書く") }}
          </button>
        </div>

        <!-- 会社の標準フローから外れているステップ。
             設定で無効なのに行が出ているのは、その学生の現在地かFBがあるため -->
        <p
          v-if="!row.isEnabled"
          class="feedback__off-flow"
        >
          このステップは選考フローで無効です（この学生にだけ表示しています）
        </p>

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
          v-else-if="row.feedback"
          class="feedback__body"
        >
          {{ row.feedback.body }}
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

/* 標準フローから外れている行の注記。警告色までは使わない
   （間違いではなく「例外的に出している」という説明なので） */
.feedback__off-flow {
  margin: var(--space-xs) 0 0;
  color: var(--color-ink-mute);
  font-size: 10px;
  line-height: 1.6;
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
