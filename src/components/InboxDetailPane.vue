<script setup>
// 受信箱の右ペイン（frontend.md §5 のレイアウト枠）
//
// ★プロフィールの編集（P2-4/P2-9）は ProfilePanel、申し送りメモ（P2-5/P2-6）は MemoPanel に委譲済み。
//   日程調整の進捗更新（P3-4）は**未実装**で、現在の値の表示だけを行う。
import { computed } from "vue"
import {
  SCHEDULE_REQUEST_STATUS,
  SCHEDULE_REQUEST_STATUS_META,
} from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"
import MemoPanel from "./MemoPanel.vue"
import PanelIcon from "./PanelIcon.vue"
import ProfilePanel from "./ProfilePanel.vue"
import StatusChip, { CHIP_KIND } from "./StatusChip.vue"
import UserAvatar from "./UserAvatar.vue"

// #region constants
const UNSET_LABEL = "未設定"
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

const scheduleRequest = computed(() => props.room?.scheduleRequest ?? null)
const scheduleStateLabel = computed(() =>
  scheduleRequest.value
    ? SCHEDULE_REQUEST_STATUS_META[scheduleRequest.value.status]?.label ?? UNSET_LABEL
    : UNSET_LABEL
)
const scheduleBookedLabel = computed(() => {
  if (!scheduleRequest.value?.bookedStartsAt) return ""
  return new Date(scheduleRequest.value.bookedStartsAt).toLocaleString("ja-JP", {
    month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
  })
})

// #endregion
</script>

<template>
  <aside class="detail">
    <div class="detail__head">
      <h2 class="detail__title">
        詳細
      </h2>
      <!-- 最小化。復帰用のボタンは畳んだ跡に残る細いカードに出る -->
      <button
        type="button"
        class="icon-button"
        title="詳細を最小化する"
        aria-label="詳細を最小化する"
        @click="ui.toggleProfilePanel()"
      >
        <PanelIcon
          side="right"
          direction="right"
        />
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

      <!-- 担当人事・選考ステータス・次回面接・会議室・面接官のインライン編集（P2-4/P2-9） -->
      <ProfilePanel :room="room" />

      <!-- 申し送りメモ（P2-5/P2-6） -->
      <div class="section">
        <MemoPanel :room-id="room.id" />
      </div>

      <!-- 面接日程予約（P3-4 改訂）：schedule_requests.status を正として表示 -->
      <section class="section">
        <h3 class="section__title">
          日程調整
        </h3>
        <p class="section__value">
          {{ scheduleStateLabel }}
        </p>
        <p
          v-if="scheduleBookedLabel"
          class="section__schedule-time"
        >
          {{ scheduleBookedLabel }}
        </p>
        <p
          v-if="scheduleRequest?.status === SCHEDULE_REQUEST_STATUS.EXPIRED"
          class="section__alert"
        >
          人事の対応が必要です
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

.detail__empty {
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

.section__schedule-time {
  margin-top: var(--space-sm);
  font-size: 12px;
  font-weight: 700;
}

.section__alert {
  margin-top: var(--space-xs);
  color: var(--color-error);
  font-size: 11px;
  font-weight: 700;
}
</style>
