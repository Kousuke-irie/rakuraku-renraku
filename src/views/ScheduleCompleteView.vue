<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { INTERVIEW_FORMAT_META, SCHEDULE_REQUEST_STATUS } from '../constants/index.js'
import { useSchedulesStore } from '../stores/schedules.js'

const route = useRoute()
const router = useRouter()
const schedules = useSchedulesStore()
const requestId = computed(() => Number(route.params.scheduleRequestId))
const request = computed(() => schedules.requestById(requestId.value))
const dateLabel = computed(() => {
  if (!request.value?.bookedStartsAt) return ''
  const start = new Date(request.value.bookedStartsAt)
  const end = new Date(request.value.bookedEndsAt)
  const date = start.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
  const time = (value) => value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time(start)}〜${time(end)}`
})

onMounted(async () => {
  const loaded = await schedules.fetchRequest(requestId.value)
  if (loaded && loaded.status !== SCHEDULE_REQUEST_STATUS.BOOKED) {
    router.replace({ name: 'schedule-select', params: { scheduleRequestId: requestId.value } })
  }
})
</script>

<template>
  <main class="complete-page">
    <section
      v-if="request?.status === SCHEDULE_REQUEST_STATUS.BOOKED"
      class="complete-card"
    >
      <div
        class="complete-card__mark"
        aria-hidden="true"
      >
        ✓
      </div>
      <p class="eyebrow">
        予約が完了しました
      </p>
      <h1>{{ request.selectionStage }}</h1>
      <p class="date">
        {{ dateLabel }}
      </p>
      <dl>
        <div><dt>面接官</dt><dd>{{ request.interviewer.displayName }}</dd></div>
        <div><dt>形式</dt><dd>{{ INTERVIEW_FORMAT_META[request.interviewFormat]?.label }}</dd></div>
        <div v-if="request.locationText">
          <dt>場所・補足</dt><dd>{{ request.locationText }}</dd>
        </div>
      </dl>
      <RouterLink
        class="button-primary"
        to="/chat"
      >
        チャットに戻る
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.complete-page { display: grid; min-height: 100%; place-items: center; overflow: auto; padding: var(--space-xxl); }
.complete-card { width: min(560px, 100%); padding: 40px; border: 1px solid var(--color-hairline); border-radius: var(--radius-xl); background: var(--color-canvas); box-shadow: var(--shadow-1); text-align: center; }
.complete-card__mark { display: grid; width: 54px; height: 54px; place-items: center; margin: 0 auto var(--space-md); border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font-size: 26px; font-weight: 700; }
.eyebrow { color: var(--color-primary); font-weight: 700; } h1 { margin-top: var(--space-sm); font-size: 24px; }.date { margin-top: var(--space-sm); font-size: 18px; font-weight: 700; }
dl { display: grid; gap: var(--space-sm); margin: var(--space-xl) 0; text-align: left; } dl div { display: grid; grid-template-columns: 100px 1fr; gap: var(--space-md); } dt { color: var(--color-ink-mute); font-size: 12px; } dd { margin: 0; font-size: 14px; }.complete-card a { text-decoration: none; }
</style>
