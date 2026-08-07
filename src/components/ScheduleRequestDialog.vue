<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  DEFAULT_DAILY_END_TIME,
  DEFAULT_DAILY_START_TIME,
  DEFAULT_INTERVIEW_DURATION_MINUTES,
  DEFAULT_INTERVIEW_FORMAT,
  INTERVIEW_DURATION_OPTIONS,
  INTERVIEW_FORMAT_META,
  INTERVIEW_FORMAT_VALUES,
  INTERVIEW_SURVEY_STATUS_KEYS,
  SELECTION_STATUS_META,
} from '../constants/index.js'
import { useSchedulesStore } from '../stores/schedules.js'

const props = defineProps({ room: { type: Object, required: true } })
const emit = defineEmits(['close', 'created'])
const schedules = useSchedulesStore()
const preview = ref(null)
const previewSignature = ref('')
const submitting = ref(false)

const pad = (value) => String(value).padStart(2, '0')
const dateInput = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const dateTimeInput = (date) => `${dateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
const addDays = (days) => new Date(Date.now() + days * 86_400_000)
const toIso = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const form = reactive({
  selectionStage: SELECTION_STATUS_META[props.room.student?.selectionStatus]?.label ?? '一次面接',
  interviewerId: '',
  availableFromDate: dateInput(addDays(2)),
  availableUntilDate: dateInput(addDays(8)),
  durationMinutes: DEFAULT_INTERVIEW_DURATION_MINUTES,
  dailyStartTime: DEFAULT_DAILY_START_TIME,
  dailyEndTime: DEFAULT_DAILY_END_TIME,
  responseDeadline: dateTimeInput(addDays(1)),
  interviewFormat: DEFAULT_INTERVIEW_FORMAT,
  locationText: 'URLは確定後に案内します',
})

/**
 * 面接アンケート（S-11）が「この面接を担当した面接官」を引くためのステップキー。
 *
 * 学生の**現在の**選考ステータスから決める。上の表示名（selectionStage）は人事が
 * 言い回しを変えられるフィールドなので、キーの根拠にはできない
 * （「最終面接」と書き換えても指しているステップは変わらない）。
 * 面接以外の段階（書類など）で作られた依頼はアンケートの対象外なので null。
 */
const selectionStatusKey = computed(() => {
  const status = props.room.student?.selectionStatus
  return INTERVIEW_SURVEY_STATUS_KEYS.includes(status) ? status : null
})

const payload = computed(() => ({
  interviewerId: Number(form.interviewerId),
  selectionStage: form.selectionStage.trim(),
  selectionStatusKey: selectionStatusKey.value,
  durationMinutes: Number(form.durationMinutes),
  availableFrom: toIso(`${form.availableFromDate}T${form.dailyStartTime}:00`),
  availableUntil: toIso(`${form.availableUntilDate}T${form.dailyEndTime}:00`),
  dailyStartTime: form.dailyStartTime,
  dailyEndTime: form.dailyEndTime,
  responseDeadline: toIso(form.responseDeadline),
  interviewFormat: form.interviewFormat,
  locationText: form.locationText.trim() || null,
}))

const signature = computed(() => JSON.stringify(payload.value))
const availableSlots = computed(() => preview.value?.slots?.filter((slot) => slot.available) ?? [])
const canSubmit = computed(
  () => availableSlots.value.length > 0 && previewSignature.value === signature.value && !submitting.value,
)

const previewByDate = computed(() => {
  const counts = new Map()
  for (const slot of availableSlots.value) {
    const label = new Date(slot.startsAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].slice(0, 5).map(([date, count]) => ({ date, count }))
})

watch(signature, () => {
  if (previewSignature.value !== signature.value) preview.value = null
})

onMounted(async () => {
  const interviewers = await schedules.fetchInterviewers()
  if (interviewers[0]) form.interviewerId = String(interviewers[0].id)
})

const checkSlots = async () => {
  preview.value = await schedules.previewSlots(payload.value.interviewerId, {
    from: payload.value.availableFrom,
    to: payload.value.availableUntil,
    durationMinutes: payload.value.durationMinutes,
    dailyStartTime: payload.value.dailyStartTime,
    dailyEndTime: payload.value.dailyEndTime,
  })
  previewSignature.value = preview.value ? signature.value : ''
}

const submit = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  const request = await schedules.createRequest(props.room.id, payload.value)
  submitting.value = false
  if (!request) return
  emit('created', request)
  emit('close')
}
</script>

<template>
  <div
    class="overlay"
    role="presentation"
    @mousedown.self="emit('close')"
  >
    <section
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-dialog-title"
    >
      <header class="dialog__header">
        <div>
          <h2 id="schedule-dialog-title">
            面接日程予約を作成
          </h2>
          <p>{{ room.student.displayName }}さんへ、面接官の空き枠を公開します。</p>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="閉じる"
          title="閉じる"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <form
        class="form"
        @submit.prevent="submit"
      >
        <label>面接段階<input
          v-model="form.selectionStage"
          required
          maxlength="50"
        ></label>
        <label>面接官
          <select
            v-model="form.interviewerId"
            required
          >
            <option
              v-for="interviewer in schedules.interviewers"
              :key="interviewer.id"
              :value="String(interviewer.id)"
            >
              {{ interviewer.displayName }}（{{ interviewer.department }}）
            </option>
          </select>
        </label>

        <div class="form__pair">
          <label>候補期間（開始）<input
            v-model="form.availableFromDate"
            type="date"
            required
          ></label>
          <label>候補期間（終了）<input
            v-model="form.availableUntilDate"
            type="date"
            required
          ></label>
        </div>
        <div class="form__pair">
          <label>面接時間
            <select v-model.number="form.durationMinutes">
              <option
                v-for="minutes in INTERVIEW_DURATION_OPTIONS"
                :key="minutes"
                :value="minutes"
              >{{ minutes }}分</option>
            </select>
          </label>
          <label>回答期限<input
            v-model="form.responseDeadline"
            type="datetime-local"
            required
          ></label>
        </div>
        <div class="form__pair">
          <label>予約可能時間（開始）<input
            v-model="form.dailyStartTime"
            type="time"
            required
          ></label>
          <label>予約可能時間（終了）<input
            v-model="form.dailyEndTime"
            type="time"
            required
          ></label>
        </div>
        <label>面接形式
          <select v-model="form.interviewFormat">
            <option
              v-for="format in INTERVIEW_FORMAT_VALUES"
              :key="format"
              :value="format"
            >
              {{ INTERVIEW_FORMAT_META[format].label }}
            </option>
          </select>
        </label>
        <label>場所・補足<textarea
          v-model="form.locationText"
          rows="2"
          maxlength="500"
        /></label>

        <div class="preview">
          <button
            type="button"
            class="button-normal"
            @click="checkSlots"
          >
            空き枠を確認
          </button>
          <template v-if="preview">
            <p class="preview__count">
              対象期間内の予約可能枠：{{ availableSlots.length }}件
            </p>
            <ul v-if="previewByDate.length > 0">
              <li
                v-for="item in previewByDate"
                :key="item.date"
              >
                {{ item.date }}：{{ item.count }}件
              </li>
            </ul>
            <p
              v-else
              class="preview__empty"
            >
              予約可能枠がありません。条件または面接官を変更してください。
            </p>
          </template>
        </div>

        <footer class="dialog__actions">
          <button
            type="button"
            class="button-normal"
            @click="emit('close')"
          >
            キャンセル
          </button>
          <button
            type="submit"
            class="button-primary"
            :disabled="!canSubmit"
          >
            {{ submitting ? '送信中…' : 'この内容で学生へ送信' }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-xxl);
  background: rgb(29 29 29 / 36%);
}
.dialog { width: min(720px, 100%); max-height: 92vh; overflow: auto; border-radius: var(--radius-xl); background: var(--color-canvas); box-shadow: var(--shadow-3); }
.dialog__header { display: flex; justify-content: space-between; gap: var(--space-lg); padding: var(--space-xl); border-bottom: 1px solid var(--color-hairline); }
.dialog__header h2 { font-size: 20px; }
.dialog__header p { margin-top: var(--space-xs); color: var(--color-ink-mute); font-size: 12px; }
.form { display: grid; gap: var(--space-md); padding: var(--space-xl); }
.form label { display: grid; gap: var(--space-xs); color: var(--color-ink-mute); font-size: 12px; font-weight: 700; }
.form input, .form select, .form textarea { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid var(--color-hairline); border-radius: var(--radius-sm); background: var(--color-canvas); color: var(--color-ink); font-size: 14px; }
.form__pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.preview { padding: var(--space-md); border-radius: var(--radius-lg); background: var(--color-orange-soft); }
.preview__count { margin-top: var(--space-sm); font-size: 14px; font-weight: 700; }
.preview ul { display: flex; flex-wrap: wrap; gap: var(--space-sm) var(--space-lg); margin-top: var(--space-xs); padding: 0; list-style: none; color: var(--color-ink-mute); font-size: 12px; }
.preview__empty { margin-top: var(--space-sm); color: var(--color-error); font-size: 12px; font-weight: 700; }
.dialog__actions { display: flex; justify-content: flex-end; gap: var(--space-sm); padding-top: var(--space-sm); }
</style>
