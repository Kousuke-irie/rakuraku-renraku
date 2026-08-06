<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { INTERVIEW_FORMAT_META, SCHEDULE_REQUEST_STATUS } from '../constants/index.js'
import { useSchedulesStore } from '../stores/schedules.js'

const route = useRoute()
const router = useRouter()
const schedules = useSchedulesStore()
const requestId = computed(() => Number(route.params.scheduleRequestId))
const slotId = computed(() => String(route.query.slotId ?? ''))
const request = computed(() => schedules.requestById(requestId.value))
const slot = computed(() => schedules.slotsOf(requestId.value).find((item) => item.slotId === slotId.value) ?? null)
const canBook = computed(() => request.value?.status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT && slot.value?.available)
const dateLabel = computed(() => {
  if (!slot.value) return ''
  const start = new Date(slot.value.startsAt)
  const end = new Date(slot.value.endsAt)
  const date = start.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
  const time = (value) => value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time(start)}〜${time(end)}`
})
const refresh = () => schedules.fetchSlots(requestId.value, { quiet: true })
const onFocus = () => refresh()

onMounted(async () => {
  const loaded = await schedules.fetchRequest(requestId.value)
  if (loaded?.status === SCHEDULE_REQUEST_STATUS.BOOKED) {
    router.replace({ name: 'schedule-complete', params: { scheduleRequestId: requestId.value } })
    return
  }
  await refresh()
  schedules.watchRequest(requestId.value)
  window.addEventListener('focus', onFocus)
})
onBeforeUnmount(() => {
  schedules.unwatchRequest(requestId.value)
  window.removeEventListener('focus', onFocus)
})

const book = async () => {
  if (!canBook.value) return
  const booked = await schedules.book(requestId.value, slotId.value)
  if (booked) {
    router.replace({ name: 'schedule-complete', params: { scheduleRequestId: requestId.value } })
  } else if (schedules.selectionNotice[requestId.value]) {
    router.replace({ name: 'schedule-select', params: { scheduleRequestId: requestId.value } })
  }
}
</script>

<template>
  <main class="confirm-page">
    <section
      v-if="request"
      class="confirm-card"
    >
      <p class="eyebrow">
        面接日程の確認
      </p>
      <h1>この日時で予約しますか？</h1>
      <dl>
        <div><dt>面接段階</dt><dd>{{ request.selectionStage }}</dd></div>
        <div><dt>日時</dt><dd>{{ dateLabel || '受付終了' }}</dd></div>
        <div><dt>面接官</dt><dd>{{ request.interviewer.displayName }}</dd></div>
        <div><dt>形式</dt><dd>{{ INTERVIEW_FORMAT_META[request.interviewFormat]?.label }}</dd></div>
        <div><dt>所要時間</dt><dd>{{ request.durationMinutes }}分</dd></div>
      </dl>
      <p
        v-if="!canBook"
        class="alert"
        role="alert"
      >
        この日時は受付終了しました
      </p>
      <footer>
        <RouterLink
          class="button-normal"
          :to="{ name: 'schedule-select', params: { scheduleRequestId: requestId } }"
        >
          日程選択に戻る
        </RouterLink>
        <button
          type="button"
          class="button-primary"
          :disabled="!canBook || schedules.isBooking(requestId)"
          @click="book"
        >
          {{ schedules.isBooking(requestId) ? '予約中…' : 'この日時で予約を確定する' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.confirm-page { display: grid; min-height: 100%; place-items: center; overflow: auto; padding: var(--space-xxl); }
.confirm-card { width: min(620px, 100%); padding: 32px; border: 1px solid var(--color-hairline); border-radius: var(--radius-xl); background: var(--color-canvas); box-shadow: var(--shadow-1); }
.eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 700; letter-spacing: .8px; } h1 { margin-top: var(--space-xs); font-size: 24px; }
dl { display: grid; gap: var(--space-sm); margin: var(--space-xl) 0; } dl div { display: grid; grid-template-columns: 110px 1fr; gap: var(--space-md); padding-bottom: var(--space-sm); border-bottom: 1px solid var(--color-hairline); } dt { color: var(--color-ink-mute); font-size: 12px; } dd { margin: 0; font-size: 14px; font-weight: 700; }
.alert { color: var(--color-error); font-weight: 700; } footer { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xl); } footer a { text-decoration: none; }
</style>
