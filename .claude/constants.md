# 列挙値定義（constants）

すべての列挙値は `shared/constants.js` に定義し、client / server の双方から import する。
**このファイルの値をコード内に文字列リテラルで直接書かないこと。**

---

## 1. 対応ステータス `HANDLING_STATUS`

人事側の処理状態。**ルーム（`rooms.handling_status`）**に紐づく。

| 値 | 表示名 | 色 | 意味 |
| --- | --- | --- | --- |
| `needs_reply` | 要返信 | `#E5484D` 赤 | 学生から届いていて未返信 |
| `in_progress` | 対応中 | `#F5A623` 橙 | 社内確認中など、対応に着手済み |
| `waiting_student` | 返信待ち | `#4A90D9` 青 | 人事が返信済みで学生の返答待ち |
| `done` | 完了 | `#3EA76B` 緑 | この件は完了 |
| `on_hold` | 保留 | `#8B8D98` 灰 | 意図的に止めている |

- 初期値：`needs_reply`
- `on_hold` は**自動遷移の対象外**（人事の明示的な意思とみなす）

## 2. 選考ステータス `SELECTION_STATUS`

学生の選考進捗。**学生（`students.selection_status`）**に紐づく。

| 値 | 表示名 |
| --- | --- |
| `entry` | エントリー |
| `document` | 書類 |
| `aptitude` | 適性検査 |
| `interview_1` | 一次面接 |
| `interview_2` | 二次面接 |
| `interview_3` | 三次面接 |
| `interview_4` | 四次面接 |
| `interview_5` | 五次面接 |
| `offer` | 内定 |
| `declined` | 辞退 |

> **面接は5回**。実データ準拠のため増減させないこと。

## 3. 用件タグ `TOPIC_TAG`

メッセージの内容分類。**サーバが自動判定**して `messages.topic_tag` に保存する。

| 値 | 表示名 | 優先度 |
| --- | --- | --- |
| `absence_late` | 欠席・遅刻 | 1 |
| `scheduling` | 日程調整 | 2 |
| `aptitude_test` | 適性検査 | 3 |
| `result_waiting` | 合否待ち | 4 |
| `question` | 質問 | 5 |
| `other` | その他 | 99（デフォルト） |

判定ロジックとキーワード辞書は `business-logic.md` を参照。

## 4. 緊急度 `URGENCY`

| 値 | 表示名 | UI 表現 |
| --- | --- | --- |
| `high` | 緊急 | 行の左端に赤いバー |
| `normal` | 通常 | 標準表示 |
| `low` | 低 | 行全体を薄く表示 |

## 5. 日程調整進捗 `SCHEDULE_STATE`（P3-4）

| 値 | 表示名 |
| --- | --- |
| `none` | 対象外 |
| `proposed` | 候補日提示済 |
| `interviewer_check` | 面接官確認中 |
| `room_pending` | 会議室未押さえ |
| `confirmed` | 確定 |

## 6. ロール `ROLE`

| 値 | 説明 |
| --- | --- |
| `hr` | 人事担当者。メイン利用者 |
| `student` | 応募学生。自分のルームのみアクセス可 |
| `admin` | 管理者。現状は `hr` と同権限（P3-2 未実装のため） |

## 7. メッセージ種別 `MESSAGE_TYPE`

| 値 | 説明 |
| --- | --- |
| `text` | 通常のメッセージ |
| `system` | ステータス変更などの自動投稿（例：「田中が対応ステータスを『対応中』に変更しました」） |

## 8. メモのスコープ `MEMO_SCOPE`

| 値 | 説明 |
| --- | --- |
| `private` | 個人メモ。作成者のみ閲覧可 |
| `shared` | チーム共有メモ。ルームの全人事が閲覧可 |

---

## 9. SLA 閾値

**緊急度（P1-6）の閾値と、通知（P4-1）の閾値は別物。流用しないこと。**
責務が違うため、片方を変えたときにもう片方まで動くのを防ぐ。

| 定数 | 既定値 | 環境変数 | 用途 |
| --- | --- | --- | --- |
| `SLA_WARN_HOURS` | 12 | `SLA_WARN_HOURS` | 緊急度：日程調整・合否待ちを `high` にする |
| `SLA_ALERT_HOURS` | 24 | `SLA_ALERT_HOURS` | 緊急度：要返信・対応中を `high` にする |
| `SLA_NOTIFY_HOURS` | 24 | `SLA_NOTIFY_HOURS` | 通知（N）：担当者へ通知する |
| `SLA_ESCALATE_HOURS` | 48 | `SLA_ESCALATE_HOURS` | 通知（2N）：上長へエスカレーションする |

`SLA_NOTIFY_HOURS` と `SLA_ALERT_HOURS` が同値なのは意図した整合。
**担当者への通知が飛ぶ瞬間と `urgency` が `high` に変わる瞬間が一致する**ので、受信箱の並びと通知が食い違わない。

`SLA_ALERT_EXEMPT_STATUSES`：通知の対象外にする対応ステータス。
`waiting_student` / `done`（人事が返信済み）と `on_hold`（意図的に止めている）。

---

## 10. 監視イベント `ALERT_KIND` / `ALERT_SEVERITY`（P4-0）

SLA 通知もコンプライアンス警告も `alerts` 1テーブルに集約する。詳細は `monitoring.md` §2。

### `ALERT_KIND`

| 値 | 表示名 | 通知先 |
| --- | --- | --- |
| `sla_notify` | 未返信24時間 | 担当者。未アサインなら上長全員 |
| `sla_escalate` | 上長エスカレーション | `role='admin'` の全員 |
| `compliance` | コンプライアンス警告 | NULL（本人へは送信前ダイアログで伝える） |

`SLA_ALERT_KINDS` に SLA 系の2つをまとめてある。返信時の解消処理はこれを使う。

### `ALERT_SEVERITY`

| 値 | 表示名 | 意味 |
| --- | --- | --- |
| `block` | 要修正 | 送信前に警告ダイアログで止める |
| `warn` | 要確認 | 注意を促すが止めない |
| `info` | 参考 | 記録のみ（AI による補助検知など） |

`ALERT_SEVERITY_ORDER` は重い順のソート用（`URGENCY_ORDER` と同じ役割）。

---

## 11. コンプライアンス分類 `COMPLIANCE_CATEGORY`（P4-2）

| 値 | 表示名 |
| --- | --- |
| `discrimination` | 就職差別のおそれ |
| `owahara` | オワハラのおそれ |

- 表示には必ず `COMPLIANCE_DISCLAIMER`（「参考情報です。最終判断は担当者が行ってください。」）を併記する
- **「検知しました」と断定しない。** 法的判断の代行に見えるため

### `COMPLIANCE_SOURCE`（P4-2b）

検知の出どころ。ダイアログでどちらが拾ったかを示す。

| 値 | 表示名 |
| --- | --- |
| `dictionary` | 辞書 |
| `ai` | AI |

### `COMPLIANCE_AI_STATUS`（P4-2b）

LLM による上乗せ検証が効いたか。**辞書判定は常に動く**ので、これは AI 分だけの状態。

| 値 | 表示名 | 意味 |
| --- | --- | --- |
| `ok` | AIによる検証済み | |
| `error` | AIによる検証はできていません | タイムアウト・APIエラー・レスポンス不正 |
| `unavailable` | AIによる検証はできていません | `GEMINI_API_KEY` 未設定 |

`ok` 以外のときは、**辞書だけの結果であることを画面に明示する**こと。黙って辞書の結果だけ
見せると「AIも通した」と誤解される。

---

## 12. `shared/constants.js` 実装方針

```js
// 値の配列と表示名マップをセットでエクスポートする
export const HANDLING_STATUS = Object.freeze({
  NEEDS_REPLY: 'needs_reply',
  IN_PROGRESS: 'in_progress',
  WAITING_STUDENT: 'waiting_student',
  DONE: 'done',
  ON_HOLD: 'on_hold',
});

export const HANDLING_STATUS_META = Object.freeze({
  [HANDLING_STATUS.NEEDS_REPLY]: { label: '要返信', color: '#E5484D' },
  // ...
});

export const HANDLING_STATUS_VALUES = Object.values(HANDLING_STATUS);
```

- 表示名（日本語）も `*_META` に集約し、コンポーネント側で日本語を直書きしない
- サーバのバリデーションは `*_VALUES.includes(value)` で行う
- CommonJS / ESM の相互運用が必要な場合は、`shared/` を ESM で書き、server 側も `"type": "module"` に揃える
