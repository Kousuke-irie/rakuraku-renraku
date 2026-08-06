# データベース設計

SQLite（better-sqlite3、WAL モード）。スキーマは `server/db/schema.sql` に定義し、`npm run db:migrate` で適用する。

---

## 1. 設計方針

- **対応ステータス・緊急度・担当者は `rooms` に持たせる。** これらは「学生との対話全体」の属性であり、メッセージ単位ではないため。
- **用件タグは `messages` に持たせる。** ルームの緊急度は「最新の学生メッセージのタグ」から導出する。
- 一覧表示の高速化のため、`rooms` に `last_message_id` / `last_message_at` / `last_student_message_at` を**非正規化して保持**する。メッセージ保存時に必ず同一トランザクションで更新すること。
- 既読判定の正は `room_members.last_read_message_id`。`read_receipts` は既読人数の集計・監査用に併存させる。

---

## 2. ER 概要

```
users ──┬─< room_members >── rooms ──< messages ──< read_receipts
        │                      │           │
        └─ students (1:1)      ├─< memos   └─ topic_tag
                               └─ handling_status / urgency / assignee
snippets（ルーム非依存・全社共有）
tag_rules（キーワード辞書）
```

---

## 3. テーブル定義

### `users`

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `login_id` | TEXT | UNIQUE NOT NULL | ログインID |
| `password_hash` | TEXT | NOT NULL | bcrypt(cost 10) |
| `display_name` | TEXT | NOT NULL | 表示名 |
| `status_message` | TEXT | | ステータスメッセージ |
| `avatar_color` | TEXT | DEFAULT '#7C9CBF' | アイコン代替色（画像アップロードは非対応） |
| `role` | TEXT | NOT NULL CHECK(`hr`/`student`/`admin`) | |
| `created_at` | TEXT | NOT NULL | ISO8601 UTC |
| `updated_at` | TEXT | NOT NULL | |

### `students`（`role='student'` のユーザーの拡張プロフィール）

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `user_id` | INTEGER | PK, FK→users.id | |
| `university` | TEXT | | 大学名 |
| `faculty` | TEXT | | 学部・学科 |
| `grad_year` | INTEGER | | 卒業予定年 |
| `selection_status` | TEXT | NOT NULL DEFAULT 'entry' | 選考ステータス |
| `next_interview_at` | TEXT | | 次回面接日時 |
| `next_interview_room` | TEXT | | 会議室 |
| `interviewer` | TEXT | | 担当面接官 |
| `schedule_state` | TEXT | NOT NULL DEFAULT 'none' | 日程調整進捗（P3-4） |
| `updated_at` | TEXT | NOT NULL | |

### `rooms`

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `type` | TEXT | NOT NULL CHECK(`dm`/`group`) DEFAULT 'dm' | |
| `name` | TEXT | | グループ名（DM は NULL） |
| `student_user_id` | INTEGER | FK→users.id | DM の相手学生 |
| `handling_status` | TEXT | NOT NULL DEFAULT 'needs_reply' | 対応ステータス |
| `assignee_user_id` | INTEGER | FK→users.id | 担当人事（NULL＝未アサイン） |
| `urgency` | TEXT | NOT NULL DEFAULT 'normal' | 算出済み緊急度 |
| `last_message_id` | INTEGER | FK→messages.id | 非正規化 |
| `last_message_at` | TEXT | | ソート用 |
| `last_student_message_at` | TEXT | | **経過時間バッジの基準時刻** |
| `created_at` | TEXT | NOT NULL | |

### `room_members`

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `room_id` | INTEGER | PK(複合), FK→rooms.id | |
| `user_id` | INTEGER | PK(複合), FK→users.id | |
| `last_read_message_id` | INTEGER | NOT NULL DEFAULT 0 | 既読位置。未読数算出の基準 |
| `joined_at` | TEXT | NOT NULL | |

### `messages`

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `room_id` | INTEGER | NOT NULL, FK→rooms.id | |
| `sender_id` | INTEGER | NOT NULL, FK→users.id | |
| `body` | TEXT | NOT NULL | プレーンテキスト |
| `type` | TEXT | NOT NULL DEFAULT 'text' | `text` / `system` |
| `topic_tag` | TEXT | | 用件タグ（学生発言時のみ自動付与） |
| `client_msg_id` | TEXT | UNIQUE | クライアント生成 UUID。重複排除用 |
| `created_at` | TEXT | NOT NULL | |
| `deleted_at` | TEXT | | NULL でなければ送信取消済み |

### `read_receipts`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `message_id` | INTEGER | PK(複合), FK→messages.id |
| `user_id` | INTEGER | PK(複合), FK→users.id |
| `read_at` | TEXT | NOT NULL |

### `memos`

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `room_id` | INTEGER | NOT NULL, FK→rooms.id | |
| `author_id` | INTEGER | NOT NULL, FK→users.id | |
| `body` | TEXT | NOT NULL | |
| `scope` | TEXT | NOT NULL CHECK(`private`/`shared`) DEFAULT 'private' | |
| `created_at` | TEXT | NOT NULL | |
| `updated_at` | TEXT | NOT NULL | |

### `snippets`（定型文）

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `command` | TEXT | UNIQUE NOT NULL | `/合格` 等 |
| `title` | TEXT | NOT NULL | 一覧表示名 |
| `body` | TEXT | NOT NULL | `{学生名}` 等の変数を含むテンプレート |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | |

### `tag_rules`（用件タグのキーワード辞書）

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `tag` | TEXT | NOT NULL | 付与するタグ |
| `keyword` | TEXT | NOT NULL | 部分一致させるキーワード |
| `priority` | INTEGER | NOT NULL | 小さいほど優先 |

---

## 4. インデックス

```sql
CREATE INDEX idx_messages_room       ON messages(room_id, id DESC);
CREATE INDEX idx_rooms_sort          ON rooms(urgency, last_student_message_at);
CREATE INDEX idx_rooms_status        ON rooms(handling_status);
CREATE INDEX idx_rooms_assignee      ON rooms(assignee_user_id);
CREATE INDEX idx_room_members_user   ON room_members(user_id);
CREATE INDEX idx_memos_room          ON memos(room_id, scope);
```

`idx_messages_room` は無限スクロールのキーセットページネーションに必須。

---

## 5. 実装ルール

1. **クエリは必ずプレースホルダを使う。** 文字列連結禁止。
2. **メッセージ保存は必ずトランザクション**で行い、同一トランザクション内で以下を更新する。
   - `messages` に INSERT
   - `rooms.last_message_id` / `last_message_at`
   - 送信者が学生の場合のみ `rooms.last_student_message_at`
   - `rooms.handling_status`（自動遷移。`business-logic.md` 参照）
   - `rooms.urgency`（再計算）
3. **履歴取得は `WHERE room_id = ? AND id < ? ORDER BY id DESC LIMIT ?`** のキーセット方式。`OFFSET` を使わない。
4. **未読数**は `SELECT COUNT(*) FROM messages WHERE room_id = ? AND id > ? AND sender_id != ? AND deleted_at IS NULL` で算出する。
5. **削除は論理削除**（`deleted_at` を設定）。物理削除しない。
6. 起動時に `PRAGMA journal_mode = WAL;` と `PRAGMA foreign_keys = ON;` を実行する。
7. 書き込みトランザクションは短く保つ（SQLite のロック競合回避）。

---

## 6. シードデータ（`server/db/seed.js`）

デモの説得力に直結するため、以下を必ず投入する。

- 人事ユーザー 3名（`hr` × 2、`admin` × 1）
- 学生 10名。選考ステータスは `entry` 〜 `offer` に分散させる
- メッセージ 80件程度。**経過時間が 26h / 13h / 2h のルームを必ず含める**（赤・黄・通常のバッジを同時に見せるため）
- 用件タグが `absence_late` / `scheduling` / `result_waiting` のルームを各1件以上含める
- 担当者未アサインのルームを1件含める（警告色の確認用）
- `tag_rules` は `business-logic.md` のキーワード辞書を全件投入
- `snippets` は `/合格` `/不合格` `/督促` `/日程案内` `/面接前日リマインド` を投入
