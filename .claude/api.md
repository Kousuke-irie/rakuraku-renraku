# API 仕様（REST / Socket.IO）

---

## 1. 共通仕様

- ベースURL：`/api`
- 認証：httpOnly Cookie の JWT。未認証時は `401 { "error": "unauthorized" }`
- 日時：すべて **ISO8601（UTC）文字列**
- エラー形式：`{ "error": "code", "message": "説明" }`
- **REST は「状態の取得と永続化」、WebSocket は「リアルタイム配信」**という役割分担を守る

### 責務分担の原則

| 用途 | 手段 |
| --- | --- |
| 履歴取得・一覧取得・プロフィール更新・ログイン | REST |
| 新着メッセージ・既読・ステータス変更の**通知** | WebSocket |
| メッセージ送信 | WebSocket（`message:send`）。切断時は REST にフォールバック |

---

## 2. REST エンドポイント

### 認証

| メソッド | パス | リクエスト | レスポンス |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{loginId, password, displayName, role}` | `{user}` + Set-Cookie |
| POST | `/auth/login` | `{loginId, password}` | `{user}` + Set-Cookie |
| POST | `/auth/logout` | - | `204` |
| GET | `/auth/me` | - | `{user}` |

- `register`：`login_id` の重複チェック → bcrypt(cost 10) でハッシュ化
- `register` で作成できるのは **`student` のみ**。`hr` / `admin` は `403 { "error": "forbidden_role" }`
  （hr は接続時に socket の `hr` ルームへ join し全ルームの `message:new` を受け取るため、
  公開登録で hr を名乗れると全学生の会話が漏れる）。hr / admin はシードまたは管理者機能で作成する
- `login`：JWT を httpOnly / SameSite=Lax Cookie で発行（有効期限7日、本番は Secure 付与）
- ログイン試行は IP 単位で **10回/分** に制限

### ルーム（受信箱）

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/rooms` | ルーム一覧。query: `handlingStatus`, `selectionStatus`, `topicTag`, `urgency`, `assigneeId`, `sort`, `q` |
| GET | `/rooms/:id` | ルーム詳細（学生プロフィール込み） |
| PATCH | `/rooms/:id` | `{handlingStatus?, assigneeUserId?}` |
| POST | `/rooms/:id/read` | `{lastReadMessageId}` |

#### `GET /rooms` レスポンス例

```json
{
  "rooms": [
    {
      "id": 12,
      "student": {
        "userId": 45,
        "displayName": "山田 太郎",
        "university": "東京大学",
        "selectionStatus": "interview_3",
        "avatarColor": "#7C9CBF"
      },
      "handlingStatus": "needs_reply",
      "urgency": "high",
      "topicTag": "absence_late",
      "assignee": { "id": 3, "displayName": "田中" },
      "unreadCount": 2,
      "lastMessage": {
        "id": 980,
        "body": "明日欠席します",
        "createdAt": "2026-08-04T01:12:00Z",
        "senderId": 45
      },
      "lastStudentMessageAt": "2026-08-04T01:12:00Z",
      "elapsedHours": 26.3
    }
  ]
}
```

`elapsedHours` はサーバで算出して返すが、**表示の更新はクライアント側で1分ごとに再計算**する。

### メッセージ

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/rooms/:id/messages` | 履歴取得。query: `before`（メッセージID）, `limit`（既定50） |
| POST | `/rooms/:id/messages` | 送信の REST フォールバック。body: `{body, clientMsgId}` |
| DELETE | `/messages/:id` | 送信取消（24h以内・自分のみ）。`deleted_at` を設定 |

- `GET` は降順で返し、**クライアント側で昇順に並べ替えて表示**する
- `before` によるキーセットページネーション。`OFFSET` は使わない
- message の形（REST・`message:new`・`message:sent` で共通）：
  `{ id, roomId, senderId, type, body, topicTag, clientMsgId, createdAt, deletedAt }`。
  クライアントは `roomId` でキャッシュを引き、`clientMsgId` で楽観描画を突き合わせるため、
  **この2つを省略しないこと**

### 学生・ユーザー

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/students/:userId` | 学生プロフィール取得 |
| PATCH | `/students/:userId` | 選考ステータス・面接日時・会議室・面接官・日程調整進捗の更新 |
| PUT | `/users/me` | 自分の表示名・ステータスメッセージ更新 |
| GET | `/users?role=hr` | 担当者アサイン用のユーザー一覧 |

### メモ・定型文・サマリー

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/rooms/:id/memos` | 自分の個人メモ＋共有メモ |
| POST | `/rooms/:id/memos` | `{body, scope}` |
| PATCH | `/memos/:id` | 本文更新／`scope` の昇格（P2-6） |
| DELETE | `/memos/:id` | 削除 |
| GET | `/snippets` | 定型文一覧 |
| GET | `/summary` | `{needsReply, urgent, overdue24h, unassigned}` |

### 会社情報（P2-10）

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/company` | `{company}`。未設定なら `{company: null}` |
| PUT | `/company` | `{name, description, recruitSiteUrl}` の全置換 |

```json
{
  "company": {
    "name": "株式会社ラクラク",
    "description": "「はたらく人の毎日を、少しだけ軽くする」をミッションに…",
    "recruitSiteUrl": "https://example.com/recruit",
    "updatedAt": "2026-08-06T01:00:00Z"
  }
}
```

- **GET は学生を含む全ロールが参照可。** 学生のトーク画面の会社情報パネル（`frontend.md` §7-2）に出すため
- **PUT は人事（hr / admin）のみ。** `req.user.role` だけで判定する
- `description` / `recruitSiteUrl` は任意。空文字を送ると `null`（未設定）で保存される
- `recruitSiteUrl` は `http:` / `https:` 以外を **400** で弾く（`javascript:` 対策）
- 更新頻度が低いマスタデータなので **Socket.IO の配信はしない。** 学生の画面には次回の取得時に反映される

### AI 現況サマリー（P3-1a・未実装）

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/ai/summary` | キャッシュ済みの要約を返す。生成中は `{status: 'loading'}` |
| POST | `/ai/summary` | キャッシュを破棄して再生成（右下の円形 AI ボタン／カードの更新） |

```json
{
  "status": "ready",
  "situation": "要返信7件のうち2件が24時間を超えています。",
  "todos": [
    { "roomId": 12, "studentName": "山田 太郎", "action": "欠席連絡に返信する", "reason": "25時間経過・緊急" }
  ],
  "generatedAt": "2026-08-06T01:00:00Z"
}
```

- `status`：`loading` / `ready` / `error` / `unavailable`（`GEMINI_API_KEY` 未設定）
- **人事のみ参照可**。`GET /summary` と同じくロールを検証する
- 生成ロジック・フォールバックは `business-logic.md` §7-2

---

## 3. Socket.IO

### 接続

```js
io(BASE_URL, { withCredentials: true })
```

- ハンドシェイク時に Cookie の JWT を検証し、`socket.data.user` に格納する
- 検証失敗時は接続を拒否（`connect_error`）
- 接続確立後、**自分が所属する全ルームへ自動 join** する（`socket.join('room:' + roomId)`）
  - これにより、どのルームを開いていても受信箱がリアルタイム更新される
- 人事ユーザーは追加で `hr` ルームにも join する（一覧・サマリーの一斉配信用）

### Client → Server

| イベント | ペイロード | 説明 |
| --- | --- | --- |
| `room:join` | `{ roomId }` | 明示的な join（新規ルーム作成時など） |
| `room:leave` | `{ roomId }` | leave |
| `message:send` | `{ roomId, body, clientMsgId }` | 送信。サーバでタグ判定・ステータス自動遷移・緊急度再計算を実行 |
| `message:read` | `{ roomId, lastReadMessageId }` | 既読更新 |
| `room:status_update` | `{ roomId, handlingStatus }` | 対応ステータス変更（低遅延用。REST と同等） |

### Server → Client

| イベント | ペイロード | 配信先 |
| --- | --- | --- |
| `message:new` | `{ message, room }` | 当該ルーム参加者 ＋ `hr` ルーム（一覧更新用） |
| `message:sent` | `{ clientMsgId, message }` | 送信者のみ（ack） |
| `message:deleted` | `{ roomId, messageId }` | ルーム参加者 |
| `read:updated` | `{ roomId, userId, lastReadMessageId }` | ルーム参加者 |
| `room:updated` | `{ room }` | `hr` ルーム。ステータス・緊急度・担当者の変更時 |
| `memo:updated` | `{ roomId, memo }` | `hr` ルーム（共有メモのみ） |
| `summary:updated` | `{ needsReply, urgent, overdue24h }` | `hr` ルーム |
| `ai:summary_updated` | `{ status, situation, todos, generatedAt }` | 生成を依頼した本人のみ（P3-1a・未実装） |
| `error` | `{ code, message }` | 発生元のみ |

---

## 4. 実装ルール

1. **認可はサーバ側で必ず検証する。** 全イベント・全エンドポイントで「そのユーザーが `room_members` に含まれるか」を確認する。クライアントから送られた `userId` を信用しない。
2. **学生ロールは自分のルーム以外にアクセスできない。**
3. **重複排除**：`message:send` を受けたら `client_msg_id` の既存レコードを確認し、存在すればそれを返して新規保存しない（再送時の二重登録防止）。
4. **再接続時の欠落対策**：クライアントは再接続後、各ルームの最新メッセージIDを添えて REST で差分を再取得する。
5. `message:new` は `hr` ルームにも配信するが、**学生には他ルームの情報を絶対に流さない。**
6. ハンドラは `server/sockets/handlers/` に機能別ファイルで分割し、`sockets/index.js` で登録する。
7. ビジネスロジック（タグ判定・緊急度・自動遷移）は `services/` に置き、REST とハンドラの両方から呼ぶ。**ハンドラ内にロジックを直書きしない。**
