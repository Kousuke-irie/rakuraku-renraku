<script setup>
// 面接アンケートの回答カード（S-09・frontend.md §7-3「面接アンケート」）
//
// ★現時点ではフロントエンドのみのモック。実際の送信・永続化は行わない。
//   回答済みかどうかの状態は親（StudentHomeView）が持ち、ここでは answered を emit するだけ。
import { ref } from "vue"

const props = defineProps({
  /** アンケート対象の選考ステップ（SELECTION_STATUS の interview_* のいずれか） */
  statusKey: { type: String, required: true },
  /** 既に回答済みか。true ならお礼メッセージに切り替える */
  answered: { type: Boolean, default: false },
})

const emit = defineEmits(["answered"])

// #region local state
/** 5段階のスター評価。0は未選択 */
const rating = ref(0)
const comment = ref("")
// #endregion

// #region browser event handler
const onSubmit = () => {
  if (rating.value === 0) return

  // バックエンド未実装。送信内容はコンソールに残すだけの見た目・入力動作のモック
  console.info("[InterviewSurveyCard] submit (mock)", {
    statusKey: props.statusKey,
    rating: rating.value,
    comment: comment.value,
  })
  emit("answered", props.statusKey)
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
          v-for="n in 5"
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
        placeholder="ご自由にお書きください（任意）"
      />

      <button
        type="submit"
        class="button-primary survey__submit"
        :disabled="rating === 0"
      >
        送信する
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
