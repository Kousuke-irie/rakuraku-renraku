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
company_info（ルーム非依存・全社共有・必ず1行）
selection_steps（選考フローの設定：ルーム非依存・全社共有。P2-11）
users ──< selection_feedbacks（学生×ステップで1件。P2-11）
alerts（監視イベント：SLA通知・コンプライアンス警告。P4-0）
compliance_rules（就職差別・オワハラの辞書。P4-2）
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

### `company_info`（会社情報・P2-10）

人事が設定し、学生のトーク画面の会社情報パネルに出す。**単一テナントなので必ず1行だけ。**

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK CHECK(id = 1) | 2行目を作れないようにするための固定値 |
| `name` | TEXT | NOT NULL | 会社名（100文字以内） |
| `description` | TEXT | | 紹介文（1000文字以内）。未設定は NULL |
| `recruit_site_url` | TEXT | | 採用サイトURL（500文字以内）。未設定は NULL |
| `updated_at` | TEXT | NOT NULL | ISO8601(UTC) |

- 更新は `INSERT ... ON CONFLICT(id) DO UPDATE` の UPSERT。`migrate` だけして `seed` していない状態でも1行目を作れる
- **部分更新にしない。** 3項目すべてを受け取る全置換にする（「紹介文を空にする」を表現するため）
- `recruit_site_url` は**サーバ側で `http:` / `https:` のみ許可**する。学生の画面にリンクとして出るため

### `selection_steps`（選考フローの設定・P2-11）

人事が「どのステップを使うか」「学生にどう見せるか」を決める。
**ステップの識別子そのものは `shared/constants.js` の `SELECTION_STATUS` が正**で、
このテーブルは見せ方の設定だけを持つ。行の追加・削除はしない（PK が固定の列挙値）。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `status_key` | TEXT | PK CHECK(9種) | 選考ステータス。`declined` は含めない |
| `is_enabled` | INTEGER | NOT NULL CHECK(0/1) DEFAULT 1 | 学生のフローに出すか |
| `sort_order` | INTEGER | NOT NULL | 並び順 |
| `label` | TEXT | | 学生画面での表示名の上書き。NULL なら既定ラベル |
| `description` | TEXT | | この選考の内容（500文字以内） |
| `points` | TEXT | | 学生へのポイント（500文字以内） |
| `updated_at` | TEXT | NOT NULL | ISO8601 UTC |

- **`declined`（辞退）を CHECK に含めない。** 辞退は終端の分岐であり選考の一段階ではないため
- 更新は全ステップの UPSERT による全置換。部分更新は並び順が壊れる
- **有効なステップを0件にできない**（学生の画面が空になるため、ルート側で 400）
- 行が1件も無い場合はサービス層が既定値（面接1〜3次のみ有効）を返す

### `selection_feedbacks`（選考フィードバック・P2-11）

学生1名 × ステップで1件。人事が受信箱のプロフィールパネルから書く。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `student_user_id` | INTEGER | NOT NULL FK users | |
| `status_key` | TEXT | NOT NULL CHECK(9種) | どのステップへのFBか |
| `body` | TEXT | NOT NULL | 本文（1000文字以内） |
| `author_id` | INTEGER | NOT NULL FK users | 書いた人事 |
| `created_at` / `updated_at` | TEXT | NOT NULL | |

`UNIQUE(student_user_id, status_key)` で1件に固定し、保存は UPSERT。
本文が空なら行を削除する（「書いたものを取り消す」を表現するため）。

**★学生に返してよいのは「その学生が通過済みのステップ」のぶんだけ。**
進行中・未到達のFBを返すと、合否連絡より先に評価が本人に漏れる。
絞り込みは `server/services/selectionFlow.js` の `buildStudentFlow()` が行う。
クライアント側で隠す作りにしないこと。

### `tag_rules`（用件タグのキーワード辞書）

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `tag` | TEXT | NOT NULL | 付与するタグ |
| `keyword` | TEXT | NOT NULL | 部分一致させるキーワード |
| `priority` | INTEGER | NOT NULL | 小さいほど優先 |

### `alerts`（監視イベント・P4-0）

SLA 通知とコンプライアンス警告を集約する。設計意図は `monitoring.md` §2。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `kind` | TEXT | NOT NULL CHECK | `sla_notify` / `sla_escalate` / `compliance` |
| `severity` | TEXT | NOT NULL CHECK | `block` / `warn` / `info` |
| `room_id` | INTEGER | NOT NULL FK rooms | |
| `target_user_id` | INTEGER | FK users | 通知先。compliance では NULL |
| `actor_user_id` | INTEGER | FK users | 原因を作った人（送信者・担当者） |
| `trigger_message_id` | INTEGER | FK messages | 起点メッセージ。**冪等キーの一部** |
| `rule_code` | TEXT | | `COMPLIANCE_RULE` のいずれか。SLA では NULL |
| `source` | TEXT | | `dictionary` / `ai`。SLA では NULL。**`rule_code` に `ai_` 接頭辞を付けて代用しない** |
| `detail` | TEXT | NOT NULL | 画面用の短文。**本文全体を入れない** |
| `created_at` | TEXT | NOT NULL | ISO8601 UTC |
| `read_at` | TEXT | | 既読時刻 |
| `resolved_at` | TEXT | | SLA：返信した時刻。compliance は常に NULL |

**多重通知は部分 UNIQUE インデックス2本（`idx_alerts_sla_unique` / `idx_alerts_compliance_unique`）で防ぐ。**
60秒タイマーから `INSERT OR IGNORE` で書き込むこと。アプリ側に「通知済みかどうか」の状態を持たせない。
学生が新しく発言すれば `trigger_message_id` が変わるので、別イベントとして正しく再通知される。

**テーブルレベルの `UNIQUE(...)` にしないこと。** SQLite は UNIQUE 中の NULL を互いに異なる値として
扱うため、`target_user_id IS NULL` のコンプライアンス行が重複し放題になる。詳細は `monitoring.md` §2。

### `compliance_rules`（就職差別・オワハラの辞書・P4-2）

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `code` | TEXT | NOT NULL | ルールのグループキー。`alerts.rule_code` から参照される。**UNIQUE にしない** |
| `category` | TEXT | NOT NULL CHECK | `discrimination` / `owahara` |
| `keyword` | TEXT | NOT NULL | **正規表現**。1行＝1パターン |
| `exclude_keyword` | TEXT | | これらのいずれかに一致したら検知しない（カンマ区切りの正規表現・誤検知対策） |
| `severity` | TEXT | NOT NULL CHECK | `block` / `warn` / `info` |
| `message` | TEXT | NOT NULL | 人事に見せる警告文 |
| `priority` | INTEGER | NOT NULL | 小さいほど優先 |

`tag_rules` と違い、**最初のマッチで確定しない**。1通に複数の問題が混ざりうるので全件返す。
ただし同一 `code` は1件に畳む（同じ観点で2回警告しても判断材料が増えないため）。

`keyword` / `exclude_keyword` は**正規表現**として解釈する。照合は正規化済み本文
（NFKC・小文字化・空白除去）に対して行うので、**パターンに空白を書かないこと**。
不正な正規表現はリテラルとして扱われる（辞書1行の typo で検査全体を落とさないため）。

`code` に UNIQUE を張ると1ルール1キーワードしか持てなくなる。P4-0 の初版が誤って
UNIQUE を付けていたため、`migrate.js` の `dropLegacyComplianceRuleUnique()` が旧定義を
検出してテーブルを作り直す（辞書は seed で入れ直す前提なのでデータは移送しない）。

---

## 4. インデックス

```sql
CREATE INDEX idx_messages_room       ON messages(room_id, id DESC);
CREATE INDEX idx_rooms_sort          ON rooms(urgency, last_student_message_at);
CREATE INDEX idx_rooms_status        ON rooms(handling_status);
CREATE INDEX idx_rooms_assignee      ON rooms(assignee_user_id);
CREATE INDEX idx_room_members_user   ON room_members(user_id);
CREATE INDEX idx_memos_room          ON memos(room_id, scope);
CREATE INDEX idx_selection_steps_order ON selection_steps(is_enabled, sort_order);
CREATE INDEX idx_selection_feedbacks  ON selection_feedbacks(student_user_id);
CREATE INDEX idx_alerts_target       ON alerts(target_user_id, read_at, created_at DESC);
CREATE INDEX idx_alerts_open         ON alerts(kind, resolved_at);
CREATE INDEX idx_alerts_room         ON alerts(room_id);
CREATE INDEX idx_compliance_rules    ON compliance_rules(priority, id);
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
