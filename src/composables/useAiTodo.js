// AI 現況サマリー／今日の ToDo（P3-1a）の開閉ロジック。
//
// 入口が2つ（らくす君 ＝ 既定／AiLauncherButton ＝ らくす君を隠している間の代替）あり、
// どちらも「開くときに未生成なら取りに行く」を必ず通す必要があるのでここへ集約する。
//
// ★GET /api/ai/summary は未生成なら生成も始めて loading を返し、完成は socket
//   `ai:summary_updated` で届く（server/routes/aiSummary.js）。なので開くたびに
//   POST（強制再生成）を投げる必要はない。明示的な作り直しはカードの「更新」だけ。
import { computed } from "vue"
import { AI_SUMMARY_STATUS } from "../constants/index.js"
import { useAuthStore } from "../stores/auth.js"
import { useRoomsStore } from "../stores/rooms.js"
import { useUiStore } from "../stores/ui.js"

export function useAiTodo() {
  const auth = useAuthStore()
  const rooms = useRoomsStore()
  const ui = useUiStore()

  /** 学生には ToDo が無い（/api/ai/summary は人事のみ。403 になる） */
  const available = computed(() => auth.isHr)

  const isOpen = computed(() => ui.aiPanelOpen)

  const isLoading = computed(() => rooms.aiSummary.status === AI_SUMMARY_STATUS.LOADING)

  /** 未読バッジと同じ役割。開かなくても「何件あるか」だけは分かるようにする */
  const todoCount = computed(() =>
    rooms.aiSummary.status === AI_SUMMARY_STATUS.READY ? rooms.aiSummary.todos.length : 0
  )

  const open = () => {
    if (!available.value) return
    ui.openAiPanel()
    if (rooms.aiSummary.status === AI_SUMMARY_STATUS.IDLE) rooms.fetchAiSummary()
  }

  const close = () => ui.closeAiPanel()

  const toggle = () => (ui.aiPanelOpen ? close() : open())

  return { available, isOpen, isLoading, todoCount, open, close, toggle }
}

export default useAiTodo
