<script setup>
import { computed } from 'vue'
import {
  INTERVIEW_FORMAT_META,
  ROLE,
  SCHEDULE_REQUEST_STATUS,
  SCHEDULE_REQUEST_STATUS_META,
} from '../constants/index.js'
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  request: { type: Object, required: true },
})

const auth = useAuthStore()
const isStudent = computed(() => auth.user?.role === ROLE.STUDENT)
const canSelect = computed(
  () => isStudent.value && props.request.status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT,
)

const dateRange = computed(() => {
  const format = (value) => new Date(value).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
  return `${format(props.request.availableFrom)}〜${format(props.request.availableUntil)}`
})

const deadline = computed(() =>
  new Date(props.request.responseDeadline).toLocaleString('ja-JP', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
)

const bookedTime = computed(() => {
  if (!props.request.bookedStartsAt || !props.request.bookedEndsAt) return ''
  const start = new Date(props.request.bookedStartsAt)
  const end = new Date(props.request.bookedEndsAt)
  const date = start.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const time = (value) => value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time(start)}〜${time(end)}`
})
</script>

<template>
  <article class="schedule-card">
    <p class="schedule-card__status">
      {{ SCHEDULE_REQUEST_STATUS_META[request.status]?.label }}
    </p>

    <template v-if="request.status === SCHEDULE_REQUEST_STATUS.BOOKED">
      <h3 class="schedule-card__title">
        日程が確定しました
      </h3>
      <p class="schedule-card__booked">
        {{ bookedTime }}
      </p>
      <dl class="schedule-card__details">
        <div><dt>面接官</dt><dd>{{ request.interviewer.displayName }}</dd></div>
        <div><dt>形式</dt><dd>{{ INTERVIEW_FORMAT_META[request.interviewFormat]?.label }}</dd></div>
      </dl>
    </template>

    <template v-else>
      <h3 class="schedule-card__title">
        {{ request.selectionStage }}の日程を選択してください
      </h3>
      <dl class="schedule-card__details">
        <div><dt>面接官</dt><dd>{{ request.interviewer.displayName }}</dd></div>
        <div><dt>所要時間</dt><dd>{{ request.durationMinutes }}分</dd></div>
        <div><dt>候補期間</dt><dd>{{ dateRange }}</dd></div>
        <div><dt>回答期限</dt><dd>{{ deadline }}</dd></div>
      </dl>

      <p
        v-if="request.needsAttention"
        class="schedule-card__alert"
      >
        現在予約できる枠がありません。採用担当が確認しています。
      </p>
      <p
        v-if="request.status === SCHEDULE_REQUEST_STATUS.EXPIRED"
        class="schedule-card__alert"
      >
        回答期限を過ぎています
      </p>
      <RouterLink
        v-if="canSelect"
        class="button-primary schedule-card__button"
        :to="{ name: 'schedule-select', params: { scheduleRequestId: request.id } }"
      >
        日程を選択する
      </RouterLink>
    </template>
  </article>
</template>

<style scoped>
.schedule-card {
  width: min(520px, 92%);
  padding: var(--space-xl);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background: var(--color-canvas);
  box-shadow: var(--shadow-1);
}

.schedule-card__status {
  display: inline-flex;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-pill);
  background: var(--color-orange-soft);
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
}

.schedule-card__title {
  margin-top: var(--space-md);
  font-size: 17px;
  font-weight: 700;
}

.schedule-card__booked {
  margin-top: var(--space-sm);
  font-size: 16px;
  font-weight: 700;
}

.schedule-card__details {
  display: grid;
  gap: var(--space-xs);
  margin-top: var(--space-md);
}

.schedule-card__details div {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: var(--space-sm);
}

.schedule-card__details dt {
  color: var(--color-ink-mute);
  font-size: 12px;
}

.schedule-card__details dd {
  margin: 0;
  font-size: 13px;
}

.schedule-card__alert {
  margin-top: var(--space-md);
  color: var(--color-error);
  font-size: 13px;
  font-weight: 700;
}

.schedule-card__button {
  margin-top: var(--space-lg);
  text-decoration: none;
}
</style>
