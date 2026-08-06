import { io } from 'socket.io-client'
import { SEND_ACK_TIMEOUT_MS, SOCKET_EMIT, SOCKET_ON } from '../constants/index.js'
import { useAuthStore } from '../stores/auth.js'
import { useRoomsStore } from '../stores/rooms.js'
import { useMessagesStore } from '../stores/messages.js'
import { useUiStore } from '../stores/ui.js'

/**
 * Socket.IO イベントの唯一の入口（frontend.md §4）。
 *
 * **コンポーネント内で直接 socket.on() を書かないこと。**
 * 受信したイベントは必ず下表のストア action に流し、コンポーネントはストアだけを見る。
 *
 * ===========================================================================
 * Server → Client：イベント → 呼ぶアクション
 * ===========================================================================
 *
 * | イベント          | ペイロード                                   | 呼ぶアクション                                       |
 * | ----------------- | -------------------------------------------- | ---------------------------------------------------- |
 * | `message:new`     | `{ message, room }`                          | 1. `messages.appendMessage(message)`                 |
 * |                   |                                              | 2. `rooms.upsertRoom(room)` … 一覧の並び順・未読・緊急度を更新 |
 * |                   |                                              | 3. 開いているルームなら `messages.sendRead()` → `rooms.markRead()` |
 * | `message:sent`    | `{ clientMsgId, message }`                   | `messages.markSent(clientMsgId, message)`            |
 * | `message:deleted` | `{ roomId, messageId }`                      | `messages.markDeleted(payload)`                      |
 * | `read:updated`    | `{ roomId, userId, lastReadMessageId }`      | `messages.updateReadState(payload)`                  |
 * | `room:updated`    | `{ room }`                                   | `rooms.upsertRoom(room)`                             |
 * | `memo:updated`    | `{ roomId, memo }`                           | `rooms.upsertMemo(roomId, memo)`                     |
 * | `summary:updated` | `{ needsReply, urgent, overdue24h }`         | `rooms.setSummary(payload)`                          |
 * | `ai:summary_updated` | `{ status, situation, todos, generatedAt }` | `rooms.setAiSummary(payload)`                     |
 * | `alert:new`       | `{ alert }`                                  | `ui.receiveAlert(alert)`（宛先本人にのみ届く）        |
 * | `alert:resolved`  | `{ alertIds, unreadCount }`                  | `ui.receiveAlertsResolved(payload)`                  |
 * | `error`           | `{ code, message }`                          | `ui.pushToast({ type:'error', message })`。`unauthorized` なら `auth.reset()` |
 * | `connect`         | -                                            | `ui.setConnectionState('connected')` → `rooms.fetchRooms()` + 開いているルームの `messages.resync()` + 人事なら `ui.fetchAlertCount()` |
 * | `disconnect`      | -                                            | `ui.setConnectionState('disconnected')`              |
 * | `connect_error`   | -                                            | `ui.setConnectionState('disconnected')`（指数バックオフで再接続） |
 *
 * ===========================================================================
 * Client → Server：どのアクションから emit するか
 * ===========================================================================
 *
 * | イベント              | ペイロード                            | 呼び出し元                              |
 * | --------------------- | ------------------------------------- | --------------------------------------- |
 * | `message:send`        | `{ roomId, body, clientMsgId }`       | `messages.sendMessage()` / `retryMessage()` |
 * | `message:read`        | `{ roomId, lastReadMessageId }`       | `messages.sendRead()`                   |
 * | `room:status_update`  | `{ roomId, handlingStatus }`          | `rooms.updateHandlingStatus()`          |
 * | `room:join`           | `{ roomId }`                          | 新規ルーム作成時のみ（接続時は自動 join されるため通常不要） |
 * | `room:leave`          | `{ roomId }`                          | 同上                                    |
 *
 * ===========================================================================
 * 補足
 * ===========================================================================
 * - 接続時にサーバが所属ルームへ自動 join するので、ルーム切替のたびに join し直さない（api.md §3）
 * - `message:new` は開いていないルームでも届く。だから受信箱がリアルタイムに並び替わる
 * - 再接続後は REST で差分を取り直す（api.md §4-4）。socket のバッファに依存しない
 * - 送信の ack は `message:sent`。SEND_ACK_TIMEOUT_MS 以内に来なければ `messages.markFailed()`
 */

/** @type {import('socket.io-client').Socket|null} 単一インスタンス。多重接続しないこと */
let socket = null

/**
 * 認証後に一度だけ呼び、socket を接続してハンドラを登録する。
 * `io(BASE_URL, { withCredentials: true })` で httpOnly Cookie の JWT を送る。
 * 既に接続済みなら何もしない（多重接続防止）。
 */
export function connectSocket() {
  if (socket) return

  useUiStore().setConnectionState('connecting')
  // 同一オリジンに接続する（本番は server が静的配信、devは /socket.io の proxy 経由。api.md §3）
  socket = io({ withCredentials: true })
  registerHandlers()
}

/** ログアウト時に切断してハンドラを解除する */
export function disconnectSocket() {
  if (!socket) return

  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}

/**
 * ハンドシェイクの認証失敗（セッション切れ・Cookie 破棄）の共通処理。
 * 再接続しても回復しないので指数バックオフを止め、ログイン画面へ退避する。
 * ルーターは動的 import で読み込み、router → views → useSocket の循環を避ける。
 */
async function handleUnauthorized() {
  disconnectSocket()
  useAuthStore().reset()

  const { default: router } = await import('../router/index.js')
  if (router.currentRoute.value.name !== 'login') {
    router.replace({
      name: 'login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
}

/**
 * Server → Client のハンドラを登録する。**追加するイベントはすべてここに書く。**
 * 各ハンドラの中身はストアの action を呼ぶだけにし、ロジックを書かない。
 */
function registerHandlers() {
  const auth = useAuthStore()
  const rooms = useRoomsStore()
  const messages = useMessagesStore()
  const ui = useUiStore()

  // socket.io-client 標準イベント。再接続は socket.io の既定の指数バックオフに任せる
  socket.on('connect', () => {
    ui.setConnectionState('connected')
    rooms.fetchRooms()
    if (ui.selectedRoomId) messages.resync(ui.selectedRoomId)
    // 切断中に作られた／解消された通知は alert:new / alert:resolved が届かない。
    // 再接続のたびに数え直す（P4-1b）。学生には通知が無いので取りに行かない
    if (auth.isHr) ui.fetchAlertCount()
  })
  socket.on('disconnect', () => ui.setConnectionState('disconnected'))
  socket.on('connect_error', (error) => {
    ui.setConnectionState('disconnected')
    // ハンドシェイクで JWT 検証に失敗した場合（server/sockets/index.js が code を渡す）。
    // ここで止めないと、セッション切れのまま無限に再接続を繰り返す。
    if (error?.data?.code === 'unauthorized' || error?.message === 'unauthorized') {
      handleUnauthorized()
    }
  })

  socket.on(SOCKET_ON.MESSAGE_NEW, ({ message, room }) => {
    messages.appendMessage(message)
    rooms.upsertRoom(room)
    if (ui.selectedRoomId === room.id) {
      messages.sendRead(room.id, message.id)
      rooms.markRead(room.id, message.id)
    }
  })
  socket.on(SOCKET_ON.MESSAGE_SENT, ({ clientMsgId, message }) => messages.markSent(clientMsgId, message))
  socket.on(SOCKET_ON.MESSAGE_DELETED, (payload) => messages.markDeleted(payload))
  socket.on(SOCKET_ON.READ_UPDATED, (payload) => messages.updateReadState(payload))
  socket.on(SOCKET_ON.ROOM_UPDATED, ({ room }) => rooms.upsertRoom(room))
  socket.on(SOCKET_ON.MEMO_UPDATED, ({ roomId, memo }) => rooms.upsertMemo(roomId, memo))
  socket.on(SOCKET_ON.SUMMARY_UPDATED, (payload) => rooms.setSummary(payload))
  socket.on(SOCKET_ON.AI_SUMMARY_UPDATED, (payload) => rooms.setAiSummary(payload))
  // P4-1：SLA通知。宛先本人にだけ届く（サーバが user:{id} ルームへ配信）
  socket.on(SOCKET_ON.ALERT_NEW, ({ alert }) => ui.receiveAlert(alert))
  // P4-1b：返信などで片付いた通知。一覧から消し、ベルの未読件数を差し替える
  socket.on(SOCKET_ON.ALERT_RESOLVED, (payload) => ui.receiveAlertsResolved(payload))
  socket.on(SOCKET_ON.ERROR, ({ code, message }) => {
    ui.pushToast({ type: 'error', message })
    if (code === 'unauthorized') handleUnauthorized()
  })
}

/**
 * Client → Server の送信口。ストアの action からのみ呼ぶ。
 * 未接続なら false を返し、呼び出し側は REST にフォールバックする。
 * @param {string} event SOCKET_EMIT のいずれか
 * @param {object} payload
 * @returns {boolean} 送信できたか
 */
export function emitSocket(event, payload) {
  if (!socket?.connected) return false

  socket.emit(event, payload)
  return true
}

/**
 * ack（サーバからの応答）を待つ送信口。楽観更新を**失敗時に戻す**必要がある操作で使う
 * （P1-2 の対応ステータス変更など）。サーバは `{ ok: true }` / `{ ok: false, code, message }` を返す。
 *
 * 未接続なら null を返す。呼び出し側は REST にフォールバックすること。
 * @param {string} event SOCKET_EMIT のいずれか
 * @param {object} payload
 * @returns {Promise<{ok: boolean, code?: string, message?: string}>|null}
 */
export function emitSocketAck(event, payload) {
  if (!socket?.connected) return null

  return new Promise((resolve) => {
    // 応答が返らないまま固まらないよう socket.io のタイムアウト機構に乗せる
    socket.timeout(SEND_ACK_TIMEOUT_MS).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) {
        resolve({ ok: false, code: 'timeout', message: 'サーバから応答がありませんでした' })
        return
      }
      resolve(response ?? { ok: true })
    })
  })
}

/**
 * コンポーネントから使う参照。接続状態は uiStore.connectionState を見ること。
 */
export function useSocket() {
  return { connectSocket, disconnectSocket, emitSocket, emitSocketAck, SOCKET_EMIT, SOCKET_ON }
}
