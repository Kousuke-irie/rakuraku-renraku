<script setup>
// 受信箱の右ペイン（frontend.md §5 のレイアウト枠）
//
// ★このコンポーネントは**表示専用のガワ**である。
//   トーク画面（B-2）の見た目を確認できるようにするために置いてある。
//   インライン編集・担当者変更・メモの読み書き・日程調整の進捗更新は**未実装**。
//   P2-4（ProfilePanel）／P2-5（MemoPanel）／P3-4 で置き換えること。
//
// 面接日時・会議室・面接官・日程調整進捗は GET /api/rooms がまだ返していないため
// 「未設定」と表示される（サーバ側の対応は P2-4 のスコープ）。
import { computed } from "vue"
import {
  DEFAULT_SCHEDULE_STATE,
  SCHEDULE_STATE_META,
  SELECTION_STATUS_META,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
const UNSET_LABEL = "未設定"
const UNASSIGNED_LABEL = "未割当"
// #endregion

const props = defineProps({
  /** rooms ストアの room。null なら空状態を出す */
  room: { type: Object, default: null },
})

// #region global state
const ui = useUiStore()
// #endregion

// #region computed
const student = computed(() => props.room?.student ?? {})

const scheduleStateLabel = computed(
  () =>
    SCHEDULE_STATE_META[student.value.scheduleState ?? DEFAULT_SCHEDULE_STATE]?.label ?? UNSET_LABEL
)

/** 定義リストの行。値が無いものは「未設定」で埋める（引き継ぎ時に欠落が見えるように） */
const detailRows = computed(() => [
  { label: "担当人事", value: props.room?.assignee?.displayName ?? UNASSIGNED_LABEL },
  {
    label: "選考ステータス",
    value: SELECTION_STATUS_META[student.value.selectionStatus]?.label ?? UNSET_LABEL,
  },
  { label: "次回面接", value: student.value.nextInterviewAt ?? UNSET_LABEL },
  { label: "会議室", value: student.value.nextInterviewRoom ?? UNSET_LABEL },
  { label: "担当面接官", value: student.value.interviewer ?? UNSET_LABEL },
])
// #endregion
</script>

<template>
  <aside class="detail">
    <div class="detail__head">
      <h2 class="detail__title">
        詳細
      </h2>
      <!-- 最小化。復帰用のボタンはトークカードのヘッダ側に出る -->
      <button
        type="button"
        class="icon-button"
        title="詳細を最小化する"
        aria-label="詳細を最小化する"
        @click="ui.toggleProfilePanel()"
      >
        <span aria-hidden="true">»</span>
      </button>
    </div>

    <p
      v-if="!room"
      class="detail__empty"
    >
      学生を選ぶと、ここに状況がまとまって表示されます。
    </p>

    <div
      v-else
      class="detail__body"
    >
      <div class="detail__student">
        <UserAvatar
          :display-name="student.displayName ?? ''"
          :color="student.avatarColor ?? ''"
          size="lg"
        />
        <p class="detail__name">
          {{ student.displayName }}
        </p>
        <p class="detail__university">
          {{ student.university }}
        </p>
        <StatusChip
          :kind="CHIP_KIND.SELECTION"
          :value="student.selectionStatus"
          size="sm"
        />
      </div>

      <dl class="detail__list">
        <template
          v-for="row in detailRows"
          :key="row.label"
        >
          <dt class="detail__label">
            {{ row.label }}
          </dt>
          <dd
            class="detail__value"
            :class="{ 'detail__value--unset': row.value === UNSET_LABEL }"
          >
            {{ row.value }}
          </dd>
        </template>
      </dl>

      <!-- 申し送りメモ（P2-5）：見出しのみ -->
      <section class="section">
        <h3 class="section__title">
          申し送りメモ
        </h3>
        <p class="section__empty">
          共有メモはまだありません。
        </p>
      </section>

      <!-- 日程調整トラッカー（P3-4）：現在の進捗の表示のみ -->
      <section class="section">
        <h3 class="section__title">
          日程調整
        </h3>
        <p class="section__value">
          {{ scheduleStateLabel }}
        </p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background-color: var(--color-canvas);
}

.detail__head {
  display: flex;
  flex: none;
  gap: var(--space-sm);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-hairline);
}

.detail__title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.detail__empty,
.section__empty {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.detail__empty {
  padding: var(--space-xxl) var(--space-lg);
  text-align: center;
}

.detail__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-lg);
}

.detail__student {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: flex-start;
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-hairline);
}

.detail__name {
  font-size: 16px;
  font-weight: 700;
}

.detail__university {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.detail__list {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: var(--space-sm) var(--space-md);
  padding: var(--space-lg) 0;
  border-bottom: 1px solid var(--color-hairline);
}

.detail__label {
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.5;
}

.detail__value {
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.detail__value--unset {
  color: var(--color-ink-mute);
}

.section {
  padding: var(--space-lg) 0;
}

.section + .section {
  border-top: 1px solid var(--color-hairline);
}

.section__title {
  margin-bottom: var(--space-sm);
  font-size: 12px;
  font-weight: 700;
}

.section__value {
  display: inline-flex;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-pill);
  background-color: var(--color-orange-soft);
  font-size: 12px;
}
</style>
