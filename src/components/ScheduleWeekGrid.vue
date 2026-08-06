<script setup>
import { computed } from 'vue'

const props = defineProps({
  slots: { type: Array, default: () => [] },
  weekStart: { type: Date, required: true },
  availableFrom: { type: String, required: true },
  availableUntil: { type: String, required: true },
  selectedSlotId: { type: String, default: null },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const pad = (value) => String(value).padStart(2, '0')
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const timeKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

const rangeStart = computed(() => dateKey(new Date(props.availableFrom)))
const rangeEnd = computed(() => dateKey(new Date(props.availableUntil)))
const dates = computed(() =>
  Array.from({ length: 7 }, (_, index) => addDays(props.weekStart, index)).filter((date) => {
    const key = dateKey(date)
    return key >= rangeStart.value && key <= rangeEnd.value
  }),
)
const slotMap = computed(() =>
  new Map(props.slots.map((slot) => {
    const start = new Date(slot.startsAt)
    return [`${dateKey(start)}-${timeKey(start)}`, slot]
  })),
)
const times = computed(() =>
  [...new Set(props.slots
    .filter((slot) => dates.value.some((date) => dateKey(date) === dateKey(new Date(slot.startsAt))))
    .map((slot) => timeKey(new Date(slot.startsAt))))].sort(),
)
const cell = (date, time) => slotMap.value.get(`${dateKey(date)}-${time}`) ?? null
const dayLabel = (date) => date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
</script>

<template>
  <div class="week-grid">
    <table>
      <thead>
        <tr>
          <th scope="col">
            時刻
          </th>
          <th
            v-for="date in dates"
            :key="dateKey(date)"
            scope="col"
          >
            {{ dayLabel(date) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="time in times"
          :key="time"
        >
          <th scope="row">
            {{ time }}
          </th>
          <td
            v-for="date in dates"
            :key="dateKey(date)"
          >
            <button
              v-if="cell(date, time)?.available"
              type="button"
              class="slot slot--available"
              :class="{ 'slot--selected': cell(date, time).slotId === selectedSlotId }"
              :disabled="disabled"
              :aria-pressed="cell(date, time).slotId === selectedSlotId"
              @click="emit('select', cell(date, time).slotId)"
            >
              <span v-if="cell(date, time).slotId === selectedSlotId">✓ 選択中</span>
              <span v-else>○<span class="sr-only">予約可能</span></span>
            </button>
            <span
              v-else
              class="slot slot--closed"
            >×<span class="sr-only">受付終了</span></span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.week-grid { overflow: auto; border: 1px solid var(--color-hairline); border-radius: var(--radius-lg); }
table { width: 100%; border-collapse: collapse; background: var(--color-canvas); }
th, td { min-width: 96px; padding: var(--space-sm); border-right: 1px solid var(--color-hairline); border-bottom: 1px solid var(--color-hairline); text-align: center; }
th { background: var(--color-orange-soft); color: var(--color-ink-mute); font-size: 12px; font-weight: 700; }
tr:last-child td, tr:last-child th { border-bottom: 0; }
th:last-child, td:last-child { border-right: 0; }
.slot { display: inline-flex; min-width: 64px; min-height: 36px; align-items: center; justify-content: center; border-radius: var(--radius-pill); font-size: 12px; font-weight: 700; }
.slot--available { border: 1px solid var(--color-primary); background: var(--color-canvas); color: var(--color-primary); }
.slot--available:hover:not(:disabled) { background: var(--color-orange-soft); }
.slot--selected { background: var(--color-primary); color: var(--color-on-primary); }
.slot--closed { color: var(--color-ink-mute); }
</style>
