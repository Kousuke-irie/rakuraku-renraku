import { defineStore } from 'pinia'
import { SOCKET_EMIT } from '../constants/index.js'
import { schedulesApi, toErrorMessage } from '../api/index.js'
import { emitSocket } from '../composables/useSocket.js'
import { useMessagesStore } from './messages.js'
import { useRoomsStore } from './rooms.js'
import { useUiStore } from './ui.js'

export const useSchedulesStore = defineStore('schedules', {
  state: () => ({
    interviewers: [],
    byId: {},
    slotsByRequestId: {},
    selectedSlotByRequestId: {},
    loadingRequestIds: {},
    loadingSlotIds: {},
    bookingRequestIds: {},
    lastFetchedAt: {},
    selectionNotice: {},
    watchedRequestIds: [],
  }),

  getters: {
    requestById: (state) => (requestId) => state.byId[Number(requestId)] ?? null,
    slotsOf: (state) => (requestId) => state.slotsByRequestId[Number(requestId)] ?? [],
    selectedSlotOf: (state) => (requestId) => state.selectedSlotByRequestId[Number(requestId)] ?? null,
    isLoadingSlots: (state) => (requestId) => state.loadingSlotIds[Number(requestId)] === true,
    isBooking: (state) => (requestId) => state.bookingRequestIds[Number(requestId)] === true,
  },

  actions: {
    upsertRequest(request) {
      if (!request?.id) return
      this.byId[Number(request.id)] = request
      useMessagesStore().updateScheduleRequest(request)

      const room = useRoomsStore().roomById(request.roomId)
      if (room) {
        useRoomsStore().upsertRoom({
          id: room.id,
          scheduleRequest: {
            id: request.id,
            status: request.status,
            selectionStage: request.selectionStage,
            responseDeadline: request.responseDeadline,
            bookedStartsAt: request.bookedStartsAt,
            bookedEndsAt: request.bookedEndsAt,
            interviewerName: request.interviewer?.displayName,
            needsAttention: request.needsAttention,
          },
        })
      }
    },

    async fetchInterviewers() {
      try {
        const { data } = await schedulesApi.listInterviewers()
        this.interviewers = data.interviewers ?? []
        return this.interviewers
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, '面接官の取得に失敗しました'),
        })
        return []
      }
    },

    async previewSlots(interviewerId, params) {
      try {
        const { data } = await schedulesApi.previewSlots(interviewerId, params)
        return data
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, '空き枠の確認に失敗しました'),
        })
        return null
      }
    },

    async createRequest(roomId, payload) {
      try {
        const { data } = await schedulesApi.create(roomId, payload)
        this.upsertRequest(data.request)
        useMessagesStore().appendMessage(data.message)
        useRoomsStore().fetchRooms()
        return data.request
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, '日程調整の送信に失敗しました'),
        })
        return null
      }
    },

    async fetchRequest(requestId) {
      const key = Number(requestId)
      if (this.loadingRequestIds[key]) return this.byId[key] ?? null
      this.loadingRequestIds[key] = true
      try {
        const { data } = await schedulesApi.get(key)
        this.upsertRequest(data.request)
        return data.request
      } catch (error) {
        useUiStore().pushToast({
          type: 'error',
          message: toErrorMessage(error, '日程調整の取得に失敗しました'),
        })
        return null
      } finally {
        this.loadingRequestIds[key] = false
      }
    },

    async fetchSlots(requestId, { quiet = false } = {}) {
      const key = Number(requestId)
      if (this.loadingSlotIds[key]) return this.slotsByRequestId[key] ?? []
      this.loadingSlotIds[key] = true
      try {
        const { data } = await schedulesApi.slots(key)
        this.slotsByRequestId[key] = data.slots ?? []
        this.lastFetchedAt[key] = data.generatedAt ?? new Date().toISOString()
        if (data.status && this.byId[key]) this.upsertRequest({ ...this.byId[key], status: data.status })
        this.ensureSelectionAvailable(key)
        return this.slotsByRequestId[key]
      } catch (error) {
        if (!quiet) {
          useUiStore().pushToast({
            type: 'error',
            message: toErrorMessage(error, '空き枠の取得に失敗しました'),
          })
        }
        return this.slotsByRequestId[key] ?? []
      } finally {
        this.loadingSlotIds[key] = false
      }
    },

    selectSlot(requestId, slotId) {
      const key = Number(requestId)
      const slot = (this.slotsByRequestId[key] ?? []).find((item) => item.slotId === slotId)
      if (!slot?.available) return
      this.selectedSlotByRequestId[key] = slotId
      this.selectionNotice[key] = null
    },

    ensureSelectionAvailable(requestId) {
      const key = Number(requestId)
      const selected = this.selectedSlotByRequestId[key]
      if (!selected) return
      const slot = (this.slotsByRequestId[key] ?? []).find((item) => item.slotId === selected)
      if (slot?.available) return
      this.selectedSlotByRequestId[key] = null
      this.selectionNotice[key] = '選択していた日時は受付終了しました。別の日時を選択してください。'
    },

    handleSlotUpdated(payload) {
      for (const [requestId, request] of Object.entries(this.byId)) {
        if (Number(request.interviewer?.id) !== Number(payload.interviewerId)) continue
        const slots = this.slotsByRequestId[requestId]
        if (!slots) continue
        const index = slots.findIndex((slot) => slot.slotId === payload.slotId)
        if (index === -1) continue
        this.slotsByRequestId[requestId] = slots.with(index, {
          ...slots[index],
          available: payload.available,
        })
        this.ensureSelectionAvailable(requestId)
      }
    },

    handleRequestUpdated(request) {
      this.upsertRequest(request)
    },

    handleBooked(request) {
      this.upsertRequest(request)
      this.selectedSlotByRequestId[request.id] = request.bookedSlotId
    },

    watchRequest(requestId) {
      const key = Number(requestId)
      if (!this.watchedRequestIds.includes(key)) this.watchedRequestIds.push(key)
      emitSocket(SOCKET_EMIT.SCHEDULE_WATCH, { requestId: key })
    },

    unwatchRequest(requestId) {
      const key = Number(requestId)
      this.watchedRequestIds = this.watchedRequestIds.filter((id) => id !== key)
      emitSocket(SOCKET_EMIT.SCHEDULE_UNWATCH, { requestId: key })
    },

    rewatchRequests() {
      for (const requestId of this.watchedRequestIds) {
        emitSocket(SOCKET_EMIT.SCHEDULE_WATCH, { requestId })
      }
    },

    async book(requestId, slotId) {
      const key = Number(requestId)
      if (this.bookingRequestIds[key]) return null
      this.bookingRequestIds[key] = true
      try {
        const { data } = await schedulesApi.book(key, slotId)
        this.upsertRequest(data.request)
        return data.request
      } catch (error) {
        const code = error?.response?.data?.error
        if (code === 'slot_already_booked') {
          this.selectionNotice[key] = error.response.data.message
          this.selectedSlotByRequestId[key] = null
          await this.fetchSlots(key, { quiet: true })
        } else if (code === 'schedule_expired' || code === 'schedule_not_bookable') {
          this.selectionNotice[key] = error.response.data.message
          this.selectedSlotByRequestId[key] = null
          await this.fetchRequest(key)
        } else {
          useUiStore().pushToast({
            type: 'error',
            message: toErrorMessage(error, '予約の確定に失敗しました'),
          })
        }
        return null
      } finally {
        this.bookingRequestIds[key] = false
      }
    },

    reset() {
      this.interviewers = []
      this.byId = {}
      this.slotsByRequestId = {}
      this.selectedSlotByRequestId = {}
      this.loadingRequestIds = {}
      this.loadingSlotIds = {}
      this.bookingRequestIds = {}
      this.lastFetchedAt = {}
      this.selectionNotice = {}
      this.watchedRequestIds = []
    },
  },
})
