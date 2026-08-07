<script setup>
// 面接アンケートの回答カード（S-09 / S-11・frontend.md §7-3「面接アンケート」）
//
// 回答済みかどうかはサーバが持つ（GET /selection-flow/me の surveyAnswered）。
// ★ここでローカルに「送信した」を覚えないこと。リロードで未回答に戻り、
//   同じ学生に何度も答えさせることになる。
//
// ★回答は1回きりで、あとから直せない。だから送信ボタンは押した瞬間に
//   無効化し、二度押しでの取り違えを防ぐ。
import { computed, ref } from "vue"
import {
  INTERVIEW_SURVEY_COMMENT_MAX_LENGTH,
  INTERVIEW_SURVEY_RATING_MAX,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

const props = defineProps({
  /** アンケート対象の選考ステップ（SELECTION_STATUS の interview_* のいずれか） */
  statusKey: { type: String, required: true },
  /** 既に回答済みか。true ならお礼メッセージに切り替える */
  answered: { type: Boolean, default: false },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** 5段階のスター評価。0は未選択 */
const rating = ref(0)
const comment = ref("")
const submitting = ref(false)
// #endregion

// #region computed
const canSubmit = computed(() => rating.value > 0 && !submitting.value)
// #endregion

// #region browser event handler
const onSubmit = async () => {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    // 成功すれば myFlow の surveyAnswered が立ち、props.answered 経由で
    // お礼メッセージに切り替わる。失敗時は入力を残して再送できるようにする
    await ui.submitInterviewSurvey(props.statusKey, rating.value, comment.value)
  } finally {
    submitting.value = false
  }
}
// #endregion
</script>

<template>
  <div
    v-if="!answered"
    id="survey-card"
    class="survey"
  >
    <h4 class="survey__title">
      面接アンケートにご協力ください
    </h4>
    <p class="survey__lead">
      今後の選考体験向上のため、率直なご意見をお聞かせください。（所要時間：約1〜2分）
    </p>
    <p class="survey__note">
      ※回答内容は選考の合否には一切影響しません。
    </p>

    <form
      class="survey__form"
      @submit.prevent="onSubmit"
    >
      <div
        class="survey__stars"
        role="radiogroup"
        aria-label="満足度（5段階）"
      >
        <button
          v-for="n in INTERVIEW_SURVEY_RATING_MAX"
          :key="n"
          type="button"
          class="survey__star"
          role="radio"
          :aria-checked="n === rating"
          :aria-label="`${n}点`"
          :class="{ 'survey__star--filled': n <= rating }"
          @click="rating = n"
        >
          ★
        </button>
        <span class="sr-only">{{ rating === 0 ? "未選択" : `${rating}点を選択中` }}</span>
      </div>

      <textarea
        v-model="comment"
        class="survey__textarea"
        rows="3"
        :maxlength="INTERVIEW_SURVEY_COMMENT_MAX_LENGTH"
        placeholder="ご自由にお書きください（任意）"
      />

      <button
        type="submit"
        class="button-primary survey__submit"
        :disabled="!canSubmit"
      >
        {{ submitting ? "送信中…" : "送信する" }}
      </button>
    </form>
  </div>

  <p
    v-else
    id="survey-card"
    class="survey__thanks"
  >
    アンケートへのご回答ありがとうございました
  </p>
</template>

<style scoped>
.survey {
  margin-top: var(--space-lg);
  padding: var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas-cream);
}

.survey__title {
  margin: 0 0 var(--space-xs);
  font-size: 13px;
  font-weight: 700;
}

.survey__lead {
  margin: 0 0 var(--space-xs);
  color: var(--color-ink);
  font-size: 12px;
  line-height: 1.7;
}

.survey__note {
  margin: 0 0 var(--space-md);
  color: var(--color-ink-mute);
  font-size: 11px;
}

.survey__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.survey__stars {
  display: flex;
  gap: 2px;
}

.survey__star {
  padding: 2px;
  border: none;
  background: none;
  color: var(--color-hairline);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.survey__star--filled {
  color: var(--color-primary);
}

.survey__star:hover,
.survey__star:focus-visible {
  color: var(--color-primary);
}

.survey__textarea {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font: inherit;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
}

.survey__submit {
  align-self: flex-start;
  padding: 6px 20px;
  font-size: 12px;
}

.survey__thanks {
  margin: var(--space-lg) 0 0;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas-cream);
  color: var(--color-ink-mute);
  font-size: 12px;
}
</style>
