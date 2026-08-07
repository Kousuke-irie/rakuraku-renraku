<script setup>
// 確定した面接（P3-4 → S-09 マイページ）
//
// 学生が日程を予約したあと、その予定はチャットの日程調整カードの中にしか無かった。
// 面接の前日に確認したい学生は、着地点であるマイページから一度チャットへ移動し、
// 過去のメッセージを遡らないと自分の面接日時にたどり着けない。
//
// このカードはその1件を着地点に出す。**予約や変更はここでは行わない**。
// 変更の相談はチャットの仕事で、ここに操作を置くと役割が二重になる。
import { computed } from "vue"
import { INTERVIEW_FORMAT, INTERVIEW_FORMAT_META } from "../constants/index.js"

// #region constants
const DAY_MS = 24 * 60 * 60 * 1000
// #endregion

// #region props
const props = defineProps({
  /** listUpcomingInterviewsForStudent が返す1件 */
  interview: { type: Object, required: true },
})
// #endregion

// #region computed
/** 保存・送受信は UTC、表示のみローカル変換（CLAUDE.md §6-2） */
const startsAt = computed(() => new Date(props.interview.startsAt))
const endsAt = computed(() => new Date(props.interview.endsAt))

const dateLabel = computed(() =>
  startsAt.value.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })
)

const timeLabel = computed(() => {
  const time = (date) => date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
  return `${time(startsAt.value)}〜${time(endsAt.value)}`
})

/**
 * 当日までの残り日数。時刻の差ではなく**暦の上の日**で数える。
 * 「明日の朝9時」は残り15時間だが、学生にとっては「明日」であって「あと0日」ではない。
 */
const daysUntil = computed(() => {
  const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((startOfDay(startsAt.value) - startOfDay(new Date())) / DAY_MS)
})

/**
 * 日付だけでは「近いのか」がひと目で分からないので、残り日数を言葉にして添える。
 * ★色では出さない。テキストで読めることが条件（CLAUDE.md §6-13）
 */
const countdownLabel = computed(() => {
  if (daysUntil.value <= 0) return "本日"
  if (daysUntil.value === 1) return "明日"
  return `あと${daysUntil.value}日`
})

/** 当日・翌日だけ強調する。毎回目立たせると、近づいたことが伝わらなくなる */
const isImminent = computed(() => daysUntil.value <= 1)

const formatLabel = computed(
  () => INTERVIEW_FORMAT_META[props.interview.interviewFormat]?.label ?? ""
)

/**
 * 場所。会議室・URLは人事があとから決めるので、未設定の状態が正常にありうる
 * （未設定のまま面接日が近づくと人事に通知が飛ぶ：P4-5）。
 * 空欄のまま出すと学生が「自分が見落とした」と受け取るので、待てばよいことを書く。
 */
const locationLabel = computed(() => {
  if (props.interview.locationText) return props.interview.locationText
  return props.interview.interviewFormat === INTERVIEW_FORMAT.ONLINE
    ? "接続URLは担当者からご連絡します"
    : "会場は担当者からご連絡します"
})

const isLocationPending = computed(() => !props.interview.locationText)
// #endregion
</script>

<template>
  <article
    class="interview"
    :class="{ 'interview--imminent': isImminent }"
  >
    <!-- チャットカード・メモと同じ骨格（ラベル＋状態 → 中身）に揃える -->
    <header class="interview__head">
      <h2 class="interview__label">
        面接日程が確定しています
      </h2>
      <span class="interview__countdown">{{ countdownLabel }}</span>
    </header>

    <p class="interview__stage">
      {{ interview.selectionStage }}
    </p>

    <!-- 日時はこのカードの主役。ここだけスケールを上げる -->
    <p class="interview__when">
      <span class="interview__date">{{ dateLabel }}</span>
      <span class="interview__time">{{ timeLabel }}</span>
    </p>

    <dl class="interview__details">
      <div>
        <dt>面接官</dt>
        <dd>{{ interview.interviewerName }}</dd>
      </div>
      <div>
        <dt>形式</dt>
        <dd>{{ formatLabel }}</dd>
      </div>
      <div>
        <dt>場所</dt>
        <dd :class="{ 'interview__pending': isLocationPending }">
          {{ locationLabel }}
        </dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
/* マイページに並ぶ他のカード（会社情報の帯・選考フロー・メモ）と同じ白カード。
   違いは、日が近いときだけ左のオレンジの帯で立ち上がること */
.interview {
  padding: var(--space-lg) var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

/* 当日・翌日：未読のチャットカードやFBカードと同じ言語（左の帯＋クリームの面）に揃える。
   学生が覚える約束事を「オレンジの帯＝自分に関わる新しいこと」の1つに保つ */
.interview--imminent {
  border-left: 3px solid var(--color-primary);
  background-color: var(--color-orange-soft);
}

.interview__head {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
  justify-content: space-between;
}

.interview__label {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

/* 残り日数は面ではなく枠で出す。オレンジのベタ面を置くと日時より先に視線を奪う */
.interview__countdown {
  flex: none;
  padding: 2px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.interview--imminent .interview__countdown {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.interview__stage {
  margin: var(--space-md) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

.interview__when {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-sm);
  align-items: baseline;
  margin: var(--space-xs) 0 0;
}

.interview__date {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.interview__time {
  font-size: 16px;
  font-weight: 700;
}

/* 面接官・形式・場所は補足。横に流して日時との差をはっきりさせる */
.interview__details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-lg);
  margin: var(--space-md) 0 0;
  font-size: 12px;
}

.interview__details div {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
}

.interview__details dt {
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.interview__details dd {
  margin: 0;
}

/* まだ決まっていない項目。空欄に見せず、待てばよいことを弱い濃さで伝える */
.interview__pending {
  color: var(--color-ink-mute);
}
</style>
