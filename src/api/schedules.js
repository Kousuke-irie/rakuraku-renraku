import { http } from './client.js'

export const schedulesApi = {
  listInterviewers: () => http.get('/calendar/interviewers'),
  previewSlots: (interviewerId, params) =>
    http.get(`/calendar/interviewers/${interviewerId}/slots`, { params }),
  create: (roomId, payload) => http.post(`/rooms/${roomId}/schedule-requests`, payload),
  listForRoom: (roomId) => http.get(`/rooms/${roomId}/schedule-requests`),
  get: (requestId) => http.get(`/schedule-requests/${requestId}`),
  slots: (requestId) => http.get(`/schedule-requests/${requestId}/slots`),
  book: (requestId, slotId) => http.post(`/schedule-requests/${requestId}/book`, { slotId }),
}

export default schedulesApi
