<script setup>
// 選考ステップの詳細（S-09 / P2-11）
//
// フロー図で選んだ1ステップの中身を、2カラムで並べる。
//   左  … 学生が「読む」もの（この選考について・ポイント）。会社から与えられた情報
//   右  … 学生が「受け取る／書く」もの（企業からのFB・自分のメモ）。自分に固有の情報
// 縦に積むと会社の説明と自分への評価が同じ流れに見えてしまうため、性質で列を割る。
//
// ★FB は完了済みのぶんしかサーバが返さない（server/services/selectionFlow.js）。
//   ここで state を見て隠す作りにはしない。クライアントの分岐は表示の都合であって、
//   見せてよいかの判断はサーバが持つ。
import { computed } from "vue"
import { FLOW_STEP_STATE, FLOW_STEP_STATE_META } from "../constants/index.js"
import InterviewSurveyCard from "./InterviewSurveyCard.vue"
import StudentNoteEditor from "./StudentNoteEditor.vue"

const props = defineProps({
  /** @type {{statusKey: string, label: string, description: string|null,
   *           points: string|null, state: string, feedback: object|null,
   *           note: object|null}|null} */
  step: { type: Object, default: null },
  /** 選択中ステップのアンケートに回答済みか（面接アンケート・frontend.md §7-3） */
  surveyAnswered: { type: Boolean, default: false },
})

const emit = defineEmits(["survey-answered"])

// #region computed
const stateLabel = computed(() => FLOW_STEP_STATE_META[props.step?.state]?.label ?? "")

const isCurrent = computed(() => props.step?.state === FLOW_STEP_STATE.CURRENT)
const isDone = computed(() => props.step?.state === FLOW_STEP_STATE.DONE)

/** 面接アンケートの対象ステップか（一次〜五次面接。SELECTION_STATUS の interview_* と一致） */
const isInterviewStep = computed(() => Boolean(props.step?.statusKey?.startsWith("interview_")))

/** 完了済みの面接ステップにだけアンケートカードを出す（未回答／回答済みの切替はカード内部） */
const showSurveyCard = computed(() => isDone.value && isInterviewStep.value)

/** 改行を段落に割る。v-html は使わない（frontend.md §10-1） */
const toParagraphs = (text) =>
  (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const descriptionParagraphs = computed(() => toParagraphs(props.step?.description))
const pointsParagraphs = computed(() => toParagraphs(props.step?.points))
const feedbackParagraphs = computed(() => toParagraphs(props.step?.feedback?.body))

const hasAnyContent = computed(
  () => descriptionParagraphs.value.length > 0 || pointsParagraphs.value.length > 0
)
// #endregion

// #region local methods
/** ISO8601(UTC) → ローカル表示。表示時のみ変換する（CLAUDE.md §6-2） */
const formatUpdatedAt = (isoString) =>
  new Date(isoString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
// #endregion
</script>

<template>
  <section
    v-if="step"
    :key="step.statusKey"
    class="detail"
    aria-live="polite"
  >
    <header class="detail__head">
      <h3 class="detail__title">
        {{ step.label }}
      </h3>
      <span
        class="detail__state"
        :class="{
          'detail__state--current': isCurrent,
          'detail__state--done': isDone,
        }"
      >{{ stateLabel }}</span>
    </header>

    <div class="detail__body">
      <!-- 左：会社が用意した「読むもの」 -->
      <div class="detail__main">
        <p
          v-if="!hasAnyContent"
          class="detail__empty"
        >
          この選考の詳細はまだ公開されていません。
        </p>

        <section
          v-if="descriptionParagraphs.length > 0"
          class="detail__block"
        >
          <h4 class="detail__label">
            この選考について
          </h4>
          <p
            v-for="(paragraph, index) in descriptionParagraphs"
            :key="index"
            class="detail__text"
          >
            {{ paragraph }}
          </p>
        </section>

        <!-- ポイントは面で囲まず、行頭マーカーの並びとして組む。
             1行1項目で書かれる性質なので、段落ではなくリストの方が構造に合う -->
        <section
          v-if="pointsParagraphs.length > 0"
          class="detail__block"
        >
          <h4 class="detail__label">
            ポイント
          </h4>
          <ul class="detail__points">
            <li
              v-for="(paragraph, index) in pointsParagraphs"
              :key="index"
              class="detail__point"
            >
              {{ paragraph }}
            </li>
          </ul>
        </section>
      </div>

      <!-- 右：この学生に固有のもの（会社から届いたもの／自分が書くもの） -->
      <aside class="detail__aside">
        <section
          v-if="feedbackParagraphs.length > 0"
          class="feedback"
        >
          <h4 class="feedback__label">
            企業からのフィードバック
          </h4>
          <p
            v-for="(paragraph, index) in feedbackParagraphs"
            :key="index"
            class="feedback__text"
          >
            {{ paragraph }}
          </p>
          <p
            v-if="step.feedback?.updatedAt"
            class="feedback__meta"
          >
            {{ formatUpdatedAt(step.feedback.updatedAt) }} 更新
          </p>
        </section>

        <p
          v-else-if="isDone"
          class="detail__pending"
        >
          フィードバックが届くとここに表示されます。
        </p>

        <!-- 面接アンケート（S-09・frontend.md §7-3）。フロントエンドのみのモック。
             会社から受け取ったもの（FB）と自分が書くもの（メモ）の間に置く -->
        <InterviewSurveyCard
          v-if="showSurveyCard"
          :status-key="step.statusKey"
          :answered="surveyAnswered"
          @answered="emit('survey-answered', $event)"
        />

        <!-- 自分用のメモ（S-10）。人事には見えない -->
        <StudentNoteEditor
          :note-key="step.statusKey"
          :note="step.note"
          label="このステップのメモ"
          placeholder="聞きたいこと・準備したこと・終わったあとの振り返りなど（自分にだけ見えます）"
        />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.detail {
  border-top: 1px solid var(--color-hairline);
  /* 切り替えたことが分かる程度の短い立ち上がり。待たせない */
  animation: detail-in 160ms ease;
}

@keyframes detail-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.detail__head {
  display: flex;
  gap: var(--space-md);
  align-items: baseline;
  padding: var(--space-lg) var(--space-xxl) 0;
}

.detail__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.detail__state {
  flex: none;
  padding: 2px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.detail__state--current {
  border-color: var(--color-primary);
  background-color: var(--color-orange-soft);
  color: var(--color-primary);
}

.detail__state--done {
  border-color: var(--color-ink);
  background-color: var(--color-ink);
  color: var(--color-canvas);
}

/* 読むもの（左）と受け取るもの（右）で列を割る。
   左をわずかに広く取り、本文の行長を読みやすい範囲に収める */
.detail__body {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: var(--space-xl) var(--space-xxl);
  padding: var(--space-lg) var(--space-xxl) var(--space-xxl);
}

/* 左カラムの中は、細い区切り線で「説明」と「ポイント」を分ける。
   面で囲むより軽く、それでいて読む単位が変わったことは伝わる */
.detail__block + .detail__block {
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-hairline);
  margin-top: var(--space-lg);
}

.detail__label {
  margin: 0 0 var(--space-sm);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.detail__text {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  line-height: 1.85;
}

.detail__text:last-child {
  margin-bottom: 0;
}

.detail__points {
  display: grid;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail__point {
  position: relative;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.85;
}

/* 行頭マーカー。オレンジの点を1つ置くだけで、面を敷かずに列挙だと分かる */
.detail__point::before {
  position: absolute;
  top: 0.72em;
  left: 2px;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background-color: var(--color-primary);
  content: "";
}

.detail__aside {
  display: grid;
  align-content: start;
  gap: var(--space-md);
}

/* 企業からのFB。左のオレンジの帯で「自分に宛てられたもの」だと分かるようにする。
   オレンジのベタ面にすると本文より先に視線を奪うので、面はクリームに留める */
.feedback {
  padding: var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas-cream);
}

.feedback__label {
  margin: 0 0 var(--space-sm);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.feedback__text {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  line-height: 1.85;
}

.feedback__meta {
  margin: var(--space-md) 0 0;
  color: var(--color-ink-mute);
  font-size: 11px;
  text-align: right;
}

.detail__empty,
.detail__pending {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.8;
}

/* FB 未着の枠。何も無いより「これから届く」と分かる方が学生の不安が減る。
   届いたときのFBカードと同じ位置・同じ形にして、面の濃さだけを落とす
   （点線はこのシステムの他のどこにも無いので、ここだけ浮く） */
.detail__pending {
  padding: var(--space-lg);
  border: 1px solid var(--color-hairline);
  border-left: 3px solid var(--color-hairline);
  border-radius: var(--radius-md);
}

/* 画面が狭いところでは2カラムを畳む。横に並べると1列あたりの行長が短くなりすぎる */
@media (max-width: 900px) {
  .detail__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail {
    animation: none;
  }
}
</style>
