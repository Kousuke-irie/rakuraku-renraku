<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  INTERVIEW_FORMAT_META,
  SCHEDULE_REFRESH_INTERVAL_MS,
  SCHEDULE_REQUEST_STATUS,
} from '../constants/index.js'
import ScheduleWeekGrid from '../components/ScheduleWeekGrid.vue'
import { useSchedulesStore } from '../stores/schedules.js'

const route = useRoute()
const router = useRouter()
const schedules = useSchedulesStore()
const requestId = computed(() => Number(route.params.scheduleRequestId))
const request = computed(() => schedules.requestById(requestId.value))
const slots = computed(() => schedules.slotsOf(requestId.value))
const selectedSlotId = computed(() => schedules.selectedSlotOf(requestId.value))
const weekStart = ref(new Date())
let refreshTimer = null

const startOfWeek = (value) => {
  const date = new Date(value)
  const offset = (date.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset)
}
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const availableCount = computed(() => slots.value.filter((slot) => slot.available).length)
const canConfirm = computed(
  () => request.value?.status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT && Boolean(selectedSlotId.value),
)
const canPrevious = computed(() => request.value && dateKey(weekStart.value) > dateKey(startOfWeek(request.value.availableFrom)))
const canNext = computed(() => request.value && dateKey(addDays(weekStart.value, 7)) <= dateKey(new Date(request.value.availableUntil)))
const weekLabel = computed(() => {
  const end = addDays(weekStart.value, 6)
  const format = (date) => date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  return `${format(weekStart.value)}〜${format(end)}`
})
const deadlineLabel = computed(() => request.value
  ? new Date(request.value.responseDeadline).toLocaleString('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '')
const rangeLabel = computed(() => request.value
  ? `${new Date(request.value.availableFrom).toLocaleDateString('ja-JP')}〜${new Date(request.value.availableUntil).toLocaleDateString('ja-JP')}`
  : '')
const lastFetchedLabel = computed(() => {
  const value = schedules.lastFetchedAt[requestId.value]
  return value ? new Date(value).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
})

const refresh = () => schedules.fetchSlots(requestId.value, { quiet: true })
const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
const onFocus = () => refresh()

onMounted(async () => {
  const loaded = await schedules.fetchRequest(requestId.value)
  if (!loaded) return
  if (loaded.status === SCHEDULE_REQUEST_STATUS.BOOKED) {
    router.replace({ name: 'schedule-complete', params: { scheduleRequestId: requestId.value } })
    return
  }
  weekStart.value = startOfWeek(loaded.availableFrom)
  await refresh()
  schedules.watchRequest(requestId.value)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, SCHEDULE_REFRESH_INTERVAL_MS)
})

onBeforeUnmount(() => {
  schedules.unwatchRequest(requestId.value)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('focus', onFocus)
  if (refreshTimer) window.clearInterval(refreshTimer)
})

const confirm = () => {
  if (!canConfirm.value) return
  router.push({
    name: 'schedule-confirm',
    params: { scheduleRequestId: requestId.value },
    query: { slotId: selectedSlotId.value },
  })
}
</script>

<template>
  <main class="schedule-page">
    <RouterLink
      class="back-link"
      to="/chat"
    >
      ← チャットに戻る
    </RouterLink>
    <section
      v-if="request"
      class="schedule-panel"
    >
      <header>
        <p class="eyebrow">
          面接日程予約
        </p>
        <h1>{{ request.selectionStage }}の日程選択</h1>
      </header>

      <dl class="info-grid">
        <div><dt>面接官</dt><dd>{{ request.interviewer.displayName }}</dd></div>
        <div><dt>所要時間</dt><dd>{{ request.durationMinutes }}分</dd></div>
        <div><dt>形式</dt><dd>{{ INTERVIEW_FORMAT_META[request.interviewFormat]?.label }}</dd></div>
        <div><dt>候補期間</dt><dd>{{ rangeLabel }}</dd></div>
        <div><dt>回答期限</dt><dd>{{ deadlineLabel }}</dd></div>
      </dl>

      <p
        v-if="request.status === SCHEDULE_REQUEST_STATUS.EXPIRED"
        class="alert"
        role="alert"
      >
        回答期限を過ぎています
      </p>
      <p
        v-if="schedules.selectionNotice[requestId]"
        class="alert"
        role="alert"
      >
        {{ schedules.selectionNotice[requestId] }}
      </p>

      <template v-if="request.status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT">
        <div class="week-nav">
          <button
            type="button"
            class="button-normal"
            :disabled="!canPrevious"
            @click="weekStart = addDays(weekStart, -7)"
          >
            前の週
          </button>
          <strong>{{ weekLabel }}</strong>
          <button
            type="button"
            class="button-normal"
            :disabled="!canNext"
            @click="weekStart = addDays(weekStart, 7)"
          >
            次の週
          </button>
        </div>

        <ScheduleWeekGrid
          :slots="slots"
          :week-start="weekStart"
          :available-from="request.availableFrom"
          :available-until="request.availableUntil"
          :selected-slot-id="selectedSlotId"
          :disabled="schedules.isLoadingSlots(requestId)"
          @select="schedules.selectSlot(requestId, $event)"
        />
        <div class="legend">
          <span>○ 予約可能</span><span>× 受付終了</span><span>✓ 選択中</span>
          <small v-if="lastFetchedLabel">最終更新 {{ lastFetchedLabel }}</small>
        </div>
        <p
          v-if="availableCount === 0 && !schedules.isLoadingSlots(requestId)"
          class="empty"
        >
          現在予約できる枠がありません。採用担当が確認します。
        </p>
        <footer class="actions">
          <button
            type="button"
            class="button-primary"
            :disabled="!canConfirm"
            @click="confirm"
          >
            選択した日時を確認する
          </button>
        </footer>
      </template>
    </section>
  </main>
</template>

<style scoped>
.schedule-page { height: 100%; overflow: auto; padding: var(--space-xl); }
.back-link { display: inline-block; margin-bottom: var(--space-md); font-size: 13px; }
.schedule-panel { max-width: 1100px; margin: 0 auto; padding: var(--space-xxl); border: 1px solid var(--color-hairline); border-radius: var(--radius-xl); background: var(--color-canvas); box-shadow: var(--shadow-1); }
.eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 700; letter-spacing: .8px; }
h1 { margin-top: var(--space-xs); font-size: 24px; }
.info-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-md); margin: var(--space-xl) 0; padding: var(--space-lg); border-radius: var(--radius-lg); background: var(--color-orange-soft); }
.info-grid dt { color: var(--color-ink-mute); font-size: 11px; }.info-grid dd { margin: var(--space-xs) 0 0; font-size: 13px; font-weight: 700; }
.week-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md); }
.legend { display: flex; gap: var(--space-lg); align-items: center; margin-top: var(--space-sm); color: var(--color-ink-mute); font-size: 12px; }.legend small { margin-left: auto; }
.alert { margin: var(--space-md) 0; padding: var(--space-md); border-radius: var(--radius-md); background: color-mix(in srgb, var(--color-error) 8%, var(--color-canvas)); color: var(--color-error); font-size: 13px; font-weight: 700; }
.empty { padding: var(--space-xl); color: var(--color-ink-mute); text-align: center; }
.actions { display: flex; justify-content: flex-end; margin-top: var(--space-xl); }
</style>
