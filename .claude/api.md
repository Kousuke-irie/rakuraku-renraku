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
| GET | `/rooms` | ルーム一覧。query: `handlingStatus`, `selectionStatus`, `topicTag`, `priority`, `assigneeId`, `sort`, `q` |
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
      "priority": "high",
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

### 選考フロー（P2-11 / S-09）

| メソッド | パス | 権限 |
| --- | --- | --- |
| GET | `/selection-flow` | 全ロール。無効なステップも含む全件 |
| PUT | `/selection-flow` | **人事のみ**。全ステップの一括置換 |
| GET | `/selection-flow/me` | **学生のみ**。自分の進捗＋見せてよいFB |
| POST | `/selection-flow/me/surveys` | **学生のみ**。面接アンケートの回答（S-11） |
| POST | `/selection-flow/me/hr-survey` | **学生のみ**。人事FBアンケートの回答（S-12） |
| GET | `/students/:userId/feedbacks` | **人事のみ**。本文は全件＋`isVisibleToStudent` |
| PUT | `/students/:userId/feedbacks/:statusKey` | **人事のみ**。本文が空なら削除 |

```json
// GET /selection-flow/me
{
  "steps": [
    {
      "statusKey": "document",
      "label": "書類選考",
      "description": "ご提出いただいた…",
      "points": "「学生時代に力を入れたこと」は…",
      "state": "done",
      "feedback": { "body": "志望動機が具体的で…", "updatedAt": "2026-08-06T01:00:00Z" },
      "note": { "noteKey": "document", "body": "ガクチカは…", "updatedAt": "2026-08-06T02:00:00Z" }
    }
  ],
  "selectionStatus": "interview_2",
  "isDeclined": false,
  "overallNote": { "noteKey": "overall", "body": "志望動機の軸…", "updatedAt": "…" },
  "upcomingInterviews": [
    {
      "id": 12,
      "selectionStage": "二次面接",
      "startsAt": "2026-08-10T05:00:00Z",
      "endsAt": "2026-08-10T06:00:00Z",
      "interviewerName": "佐藤 花子",
      "interviewFormat": "online",
      "locationText": null
    }
  ],
  "hrSurvey": {
    "answerable": false,
    "answered": false,
    "outcome": null,
    "outcomeLabel": null
  }
}
```

- `state` は `done` / `current` / `upcoming`。算出は `business-logic.md` §8
- **`GET /selection-flow/me` の対象は `req.user` から引く。** `userId` をクライアントから受け取らない
- **`feedback` は `state === 'done'` のステップにしか載せない。** サーバ側で落とすこと。
  進行中の評価が合否連絡より先に本人へ漏れる
- `PUT /selection-flow` は9件すべてを送る全置換。件数不足・重複・`declined` 指定は **400**
- 有効なステップが0件になる指定も **400**（学生の画面が空になるため）
- 更新頻度が低いので Socket.IO では配信しない
- `note` / `overallNote` は**本人のメモ**（S-10）。読み取りの往復を増やさないためここに載せる
- `upcomingInterviews` は**確定済み（`booked`）で、まだ終わっていない面接**（P3-4）。
  マイページに「次に何があるか」を出すために載せる。開始が早い順。
  - **終了済みのものはサーバが落とす。** クライアントで絞り直さないこと
  - 候補期間・回答期限・面接官の外部IDは載せない（確定後の学生に必要なのは
    いつ・誰と・どこで だけ）。詳細な調整の経緯はチャットの日程調整カードが持つ
  - `locationText` は `null` がありうる（会議室・URLは人事があとから決める：P4-5）
- `hrSurvey` は人事FBアンケート（S-12）の状態。`answerable` は**選考が終わっているか**
  （内定・辞退）で、`outcome` は `'offer'` / `'declined'` / `null`
  - **辞退した学生にも返す。** マイページはフロー図を出さないが、アンケートカードは出す
  - **`answerable` の判定はサーバが持つ。** クライアントで `selectionStatus` から
    組み立て直さないこと（判定が2箇所に散り、カードが出ていないのに POST できる状態になる）

### 人事FBアンケート（S-12）

選考が終わった学生が、担当人事の対応を3軸★＋自由記述で答える。人事は集計だけを読む。

| メソッド | パス | 権限 |
| --- | --- | --- |
| POST | `/selection-flow/me/hr-survey` | **学生のみ**。`{ ratings, comment }` |
| GET | `/hr-surveys` | **人事のみ**。担当者別の★集計 |
| GET | `/hr-surveys/comments?assigneeId=` | **人事のみ**。匿名化した自由記述 |
| GET | `/hr-surveys/ai-summary?assigneeId=` | **人事のみ**。自由記述のAI要約 |

```json
// POST /selection-flow/me/hr-survey
{ "ratings": { "speed": 4, "clarity": 5, "courtesy": 5 }, "comment": "ご対応ありがとうございました" }
// → 201 { "answeredAt": "2026-08-07T02:00:00Z" }
```

- **3軸すべて必須。** 1つでも欠けると 400（部分回答は集計の軸が欠けて比較できない）
- 対象は `req.user` から引く。`userId` をクライアントから受け取らない
- 選考が終わっていない学生は 400。判定は `isHrSurveyAnswerable()`（＝ `selectionPhaseOf`）
- 1人1回。2回目は**エラーにせず**先に入った1件をそのまま返す（学生に見せる必要がない）
- 担当人事は回答時点の `rooms.assignee_user_id` をコピーする（`database.md` の `hr_surveys`）

```json
// GET /hr-surveys
{
  "assignees": [
    { "id": "3", "displayName": "大西 陽子", "isUnknown": false,
      "count": 5, "avgOverall": 3.5,
      "axisAverages": { "speed": 3, "clarity": 3.4, "courtesy": 4.2 } }
  ],
  "overall": { "count": 12, "avgOverall": 3.1, "axisAverages": { "…": 0 } },
  "outcomes": [{ "outcomeStatus": "offer", "label": "内定", "count": 8, "avgOverall": 3.6, "axisAverages": {} }],
  "suppressed": { "assigneeCount": 1, "responseCount": 1 },
  "minSampleSize": 3,
  "answerableCount": 16
}
```

- **回答者は返さない。** 学生ID・氏名・ルームID・回答日時のいずれも載せないこと
- 回答が `minSampleSize` 未満の担当者は `assignees` に入れず、件数だけ `suppressed` に集約する。
  **伏せたぶんも `overall` には含める**（合計が合わないと集計そのものが信用されない）
- `?assigneeId=` は `'all'`（既定）／担当者ID／`'unknown'`（担当未割当）。
  **絞り込みは必ずサーバで行う。** 全件を返して画面で絞ると、通信内容の時点で匿名性が破れる
- この集計は `GET /dashboard` の `hrSurvey` にも同梱される（監視ダッシュボードは1往復で描く）。
  `GET /hr-surveys` は単体で確認したいとき用
- 個人ダッシュボード（`GET /dashboard/personal`）の `hrSurvey` は担当者1人ぶん。
  **下限未満なら数字を返さない。本人が自分のぶんを見る場合も同じ**
  （「自分ならよい」にすると、担当者は誰が答えたか分かる状態で読むことになる）

```json
// GET /students/:userId/feedbacks（人事のプロフィールパネル用）
{
  "steps": [
    {
      "statusKey": "document",
      "label": "書類選考",
      "state": "done",
      "isVisibleToStudent": true,
      "isEnabled": true,
      "feedback": { "body": "…", "updatedAt": "…", "authorName": "大西 陽子" }
    }
  ],
  "selectionStatus": "interview_2",
  "isDeclined": false
}
```

- **`isVisibleToStudent` はサーバが返す。クライアントで計算し直さない。**
  学生側（`GET /selection-flow/me`）と同じ `listVisibleSteps()` + `resolveStepStates()` を
  通しているので、並びと状態は必ず一致する。人事側で独自に判定すると、現在地が無効ステップに
  ある学生などでズレ、**「本人には非公開」と表示されているFBが実際は本人に見えている**
  という事故になる
- `isEnabled` が `false` の行は、会社の標準フローから外れているステップ
  （その学生の現在地かFBがあるために出している）。人事にその旨を注記すること

### 学生の選考メモ（S-10）

| メソッド | パス | 権限 |
| --- | --- | --- |
| PUT | `/student-notes/:noteKey` | **学生のみ**。本文が空なら削除 |

読み取りは専用エンドポイントを作らず、`GET /selection-flow/me` に相乗りさせる
（マイページを1往復で描くため）。各ステップに `note`、トップレベルに `overallNote` が載る。

```json
// PUT /student-notes/interview_2  { "body": "逆質問：評価制度について聞く" }
{ "note": { "noteKey": "interview_2", "body": "逆質問：…", "updatedAt": "2026-08-06T…" } }

// 本文が空 → 削除
{ "note": null }
```

- **対象は常に `req.user.id`。** `userId` をクライアントから受け取らない
- 学生以外のロールは **403**。`noteKey` が `STUDENT_NOTE_KEY_VALUES` 以外なら **400**
- 本文が `STUDENT_NOTE_MAX_LENGTH`（2000）超なら **400**
- **人事向けの読み取りエンドポイントを作らない。** 学生本人にしか見えないことが
  この機能の前提であり、覗ける経路を1つでも作ると機能ごと意味を失う
- 本人しか書かないので Socket.IO では配信しない

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

### 面接日程予約（P3-4）

| メソッド | パス | ロール・用途 |
| --- | --- | --- |
| GET | `/calendar/interviewers` | 人事：面接官一覧 |
| GET | `/calendar/interviewers/:id/slots` | 人事：送信前の空き枠確認 |
| POST | `/rooms/:roomId/schedule-requests` | 人事：学生へ予約依頼を送信 |
| GET | `/rooms/:roomId/schedule-requests` | ルーム参加者：履歴 |
| GET | `/schedule-requests/:id` | 対象学生本人またはルーム参加人事 |
| GET | `/schedule-requests/:id/slots` | 同上：最新空き枠 |
| POST | `/schedule-requests/:id/book` | 対象学生本人：原子的に予約確定 |
| GET | `/mock-calendar/interviewers` | 擬似カレンダーAPI |
| GET | `/mock-calendar/interviewers/:id/slots` | 擬似カレンダーAPI |
| POST | `/mock-calendar/bookings` | 擬似カレンダーAPI |

競合時は `409 { error: 'slot_already_booked', message }`。学生向けレスポンスやSocketには
他学生の情報を含めない。

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
| `schedule:watch` | `{ requestId }` | 認可後、同じ面接官の枠更新ルームへ参加 |
| `schedule:unwatch` | `{ requestId }` | 枠更新ルームから退出 |

### Server → Client

| イベント | ペイロード | 配信先 |
| --- | --- | --- |
| `message:new` | `{ message, room }` | 当該ルーム参加者 ＋ `hr` ルーム（一覧更新用） |
| `message:sent` | `{ clientMsgId, message }` | 送信者のみ（ack） |
| `message:deleted` | `{ roomId, messageId }` | ルーム参加者 |
| `read:updated` | `{ roomId, userId, lastReadMessageId }` | ルーム参加者 |
| `room:updated` | `{ room }` | `hr` ルーム。ステータス・AI推奨度・担当者の変更時 |
| `memo:updated` | `{ roomId, memo }` | `hr` ルーム（共有メモのみ） |
| `summary:updated` | `{ needsReply, urgent, overdue24h }` | `hr` ルーム |
| `ai:summary_updated` | `{ status, situation, todos, generatedAt }` | 生成を依頼した本人のみ（P3-1a・未実装） |
| `schedule:slot_updated` | `{ interviewerId, slotId, available, updatedAt }` | 同じ面接官の予約画面 |
| `schedule:request_updated` | `{ request }` | 対象ルーム |
| `schedule:booked` | `{ request }` | 対象ルーム |
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
