# P3-4 面接日程予約：保守・デモガイド

## 編集場所

- 列挙値・Socketイベント：`shared/constants.js`
- DB定義・既存DBへの列追加：`server/db/schema.sql` / `server/db/migrate.js`
- 空き枠生成：`server/services/calendarGateway.js`
- 依頼の作成・期限切れ：`server/services/scheduleRequests.js`
- 原子的な予約確定：`server/services/scheduleBookingService.js`
- REST：`server/routes/calendar.js` / `scheduleRequests.js` / `mockCalendar.js`
- Socket購読：`server/sockets/handlers/schedule.js` / `src/composables/useSocket.js`
- 人事の作成UI：`src/components/ScheduleRequestDialog.vue`
- チャットカード：`src/components/ScheduleRequestCard.vue`
- 学生画面：`src/views/Schedule*View.vue` / `src/components/ScheduleWeekGrid.vue`

実カレンダーへ差し替える場合も、予約ルートからDBへ直接アクセスさせず、
`calendarGateway.js` の公開関数を同じ入出力で置き換える。

## データの正

予約フローの状態は `schedule_requests.status` が正である。
`students.schedule_state` は既存プロフィールとの互換用で、依頼送信時に `proposed`、
予約確定時に `confirmed`、期限切れ時に `none` へ同期する。

二重予約は次の二段で防ぐ。

1. 確定トランザクション内で擬似カレンダーの最新状態を再生成して確認
2. `calendar_bookings.external_slot_id` の UNIQUE 制約

## デモデータ

`npm run db:migrate && npm run db:seed` で次を用意する。パスワードは全員 `password123`。

- `hr1`：人事。学生トークから新しい予約依頼を作成できる
- `student2` / `student9`：同じ佐藤面接官の選択待ち。共通枠のリアルタイム競合デモ用
- `student5`：予約確定済み
- `student4`：回答期限切れ
- 面接官3名と、○・×が混在する1週間分の既存予定

## 更新タイミング

- 選択画面を開いたとき：RESTで最新枠を取得
- タブ復帰・window focus：再取得
- 表示中：30秒ごとに再取得（非表示中と画面離脱後は停止）
- 他学生の予約：`schedule:slot_updated` で即時反映
- 予約カード・受信箱：`schedule:request_updated` / `schedule:booked` で更新

Socketを受け取れなくても30秒更新と確定時のサーバー再検証が残るため、
表示上の空き情報だけで予約成功を判断しない。
