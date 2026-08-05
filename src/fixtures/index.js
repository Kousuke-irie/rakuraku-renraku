/**
 * デモ用フィクスチャ（database.md §6 のシード相当データ）。
 *
 * サーバ（server/db/seed.js）が未実装でも、フロント単体で画面の見た目を確認できるようにするための
 * 静的JSONデータ。形状は各ストアのJSDoc（stores/rooms.js・stores/messages.js 等）と
 * api.md のレスポンス例に合わせてある。
 *
 * 使い方の例（ストア実装後、開発時のみ）：
 *   import { rooms, messagesByRoomId, summary } from '../fixtures/index.js'
 *   const roomsStore = useRoomsStore()
 *   rooms.forEach((room) => roomsStore.upsertRoom(room))
 *   roomsStore.setSummary(summary)
 *
 * 内容の前提：
 * - 学生10名（selectionStatus は entry〜offer・declined まで分散）
 * - 経過時間 26h（赤） / 13h（黄） / 2h（通常）のルームを含む（room 101 / 102 / 103）
 * - 用件タグ absence_late(101) / scheduling(102) / result_waiting(106, 108) を含む
 * - 担当者未アサインのルームを1件含む（room 102）
 * - summary.json の件数は rooms.json の内容から手計算した値（business-logic.md §2 準拠）
 *
 * 実データではない。個人情報保護のため本番投入や公開リポジトリへの実名混入に注意。
 */
export { default as rooms } from "./rooms.json"
export { default as messagesByRoomId } from "./messages.json"
export { default as memosByRoomId } from "./memos.json"
export { default as snippets } from "./snippets.json"
export { default as summary } from "./summary.json"
export { default as assignableUsers } from "./assignable-users.json"
