<script setup>
// 人事FBアンケートの回答カード（S-12・frontend.md §7-3「人事FBアンケート」）
//
// 選考が終わった学生（内定・辞退）に出す。評価するのは面接そのものではなく、
// 採用担当者との**やり取り**（連絡の速さ・説明の分かりやすさ・対応の丁寧さ）。
//
// ★面接アンケート（InterviewSurveyCard）と混ぜないこと。
//   あちらはステップの詳細の中に出るが、こちらはマイページの独立ブロック。
//   **辞退した学生にも出す**（あちらはフロー図ごと消える）。
//   辞退者の声こそ改善の材料であり、そこを取らないと
//   「満足した人だけが答えたアンケート」になる。
//
// 回答済みかどうかはサーバが持つ（GET /selection-flow/me の hrSurvey.answered）。
// ★ここでローカルに「送信した」を覚えないこと。リロードで未回答に戻る。
//
// ★回答は1回きりで、あとから直せない。だから送信ボタンは押した瞬間に
//   無効化し、二度押しでの取り違えを防ぐ。
import { computed, ref } from "vue"
import {
  HR_SURVEY_AXIS_META,
  HR_SURVEY_AXIS_VALUES,
  HR_SURVEY_COMMENT_MAX_LENGTH,
  HR_SURVEY_RATING_MAX,
  SELECTION_STATUS,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

const props = defineProps({
  /** 選考結果（SELECTION_STATUS.OFFER / DECLINED）。文面の切り替えに使う */
  outcome: { type: String, default: null },
  /** 既に回答済みか。true ならお礼メッセージに切り替える */
  answered: { type: Boolean, default: false },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
/** 軸ごとの5段階スター評価。0は未選択 */
const ratings = ref(Object.fromEntries(HR_SURVEY_AXIS_VALUES.map((axis) => [axis, 0])))
const comment = ref("")
const submitting = ref(false)
// #endregion

// #region computed
const axes = computed(() =>
  HR_SURVEY_AXIS_VALUES.map((axis) => ({
    key: axis,
    label: HR_SURVEY_AXIS_META[axis].label,
    question: HR_SURVEY_AXIS_META[axis].question,
  }))
)

/** 3軸すべてに答えてもらう。部分回答は集計の軸が欠けて比較できなくなる */
const canSubmit = computed(
  () => HR_SURVEY_AXIS_VALUES.every((axis) => ratings.value[axis] > 0) && !submitting.value
)

/**
 * 冒頭の一文。辞退した学生に「選考お疲れさまでした」は失礼にあたるので分ける。
 * ★どちらの文面でも「合否・今後の選考には影響しません」を必ず添える。
 *   辞退者にとっては再応募の可否が、内定者にとっては内定の扱いが気になるため。
 */
const lead = computed(() =>
  props.outcome === SELECTION_STATUS.DECLINED
    ? "このたびは選考にご参加いただきありがとうございました。今後の改善のため、選考中のご対応についてお聞かせください。"
    : "選考お疲れさまでした。今後の選考体験向上のため、採用担当の対応についてご意見をお聞かせください。"
)
// #endregion

// #region browser event handler
const onSubmit = async () => {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    // 成功すれば myFlow.hrSurvey.answered が立ち、props.answered 経由で
    // お礼メッセージに切り替わる。失敗時は入力を残して再送できるようにする
    await ui.submitHrSurvey(ratings.value, comment.value)
  } finally {
    submitting.value = false
  }
}
// #endregion
</script>

<template>
  <section
    v-if="!answered"
    id="hr-survey-card"
    class="survey"
    aria-labelledby="hr-survey-title"
  >
    <h2
      id="hr-survey-title"
      class="survey__title"
    >
      採用担当の対応についてのアンケート
    </h2>
    <p class="survey__lead">
      {{ lead }}（所要時間：約1〜2分）
    </p>
    <p class="survey__note">
      ※回答内容は合否・今後の選考には一切影響しません。回答者が特定されることはありません。
    </p>

    <form
      class="survey__form"
      @submit.prevent="onSubmit"
    >
      <div
        v-for="axis in axes"
        :key="axis.key"
        class="axis"
      >
        <p class="axis__label">
          {{ axis.label }}
        </p>
        <p class="axis__question">
          {{ axis.question }}
        </p>

        <div
          class="axis__stars"
          role="radiogroup"
          :aria-label="`${axis.label}（5段階）`"
        >
          <button
            v-for="n in HR_SURVEY_RATING_MAX"
            :key="n"
            type="button"
            class="axis__star"
            role="radio"
            :aria-checked="n === ratings[axis.key]"
            :aria-label="`${axis.label} ${n}点`"
            :class="{ 'axis__star--filled': n <= ratings[axis.key] }"
            @click="ratings[axis.key] = n"
          >
            ★
          </button>
          <!-- 色（塗りつぶし）だけで選択状態を伝えない -->
          <span class="axis__state">
            {{ ratings[axis.key] === 0 ? "未選択" : `${ratings[axis.key]}点` }}
          </span>
        </div>
      </div>

      <textarea
        v-model="comment"
        class="survey__textarea"
        rows="3"
        :maxlength="HR_SURVEY_COMMENT_MAX_LENGTH"
        aria-label="ご意見（任意）"
        placeholder="よかった点・改善してほしい点をご自由にお書きください（任意）"
      />

      <button
        type="submit"
        class="button-primary survey__submit"
        :disabled="!canSubmit"
      >
        {{ submitting ? "送信中…" : "送信する" }}
      </button>
    </form>
  </section>

  <p
    v-else
    id="hr-survey-card"
    class="survey__thanks"
  >
    アンケートへのご回答ありがとうございました
  </p>
</template>

<style scoped>
/* マイページの他のブロック（会社情報・選考フロー）と同じ「白カード」に揃える */
.survey {
  flex: none;
  padding: var(--space-xl) var(--space-xxl) var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.survey__title {
  margin: 0 0 var(--space-xs);
  font-size: 16px;
  font-weight: 700;
}

.survey__lead {
  margin: 0 0 var(--space-xs);
  color: var(--color-ink);
  font-size: 13px;
  line-height: 1.8;
}

.survey__note {
  margin: 0 0 var(--space-lg);
  color: var(--color-ink-mute);
  font-size: 11px;
}

.survey__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* 3軸を横に並べる。縦積みだと3つ目が折りたたみの下に隠れて回答率が落ちる */
.axis {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px var(--space-lg);
  align-items: center;
}

.axis__label {
  grid-column: 1;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.axis__question {
  grid-column: 1;
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.6;
}

.axis__stars {
  display: flex;
  grid-row: 1 / span 2;
  grid-column: 2;
  gap: 2px;
  align-items: center;
}

.axis__star {
  padding: 2px;
  border: none;
  background: none;
  color: var(--color-hairline);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.axis__star--filled {
  color: var(--color-primary);
}

.axis__star:hover,
.axis__star:focus-visible {
  color: var(--color-primary);
}

/* 「未選択」を残しておくと、3軸のうちどれが未回答かがひと目で分かる */
.axis__state {
  min-width: 3.5em;
  margin-left: var(--space-xs);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
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
  flex: none;
  margin: 0;
  padding: var(--space-lg) var(--space-xxl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  color: var(--color-ink-mute);
  font-size: 13px;
}

@media (max-width: 720px) {
  /* 幅が足りないと★5つと設問が重なるので、そのときだけ縦に折る */
  .axis {
    grid-template-columns: minmax(0, 1fr);
  }

  .axis__stars {
    grid-row: auto;
    grid-column: 1;
    margin-top: var(--space-xs);
  }
}
</style>
