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

## 5. 日程調整進捗 `SCHEDULE_STATE`（旧P3-4・互換用）

| 値 | 表示名 |
| --- | --- |
| `none` | 対象外 |
| `proposed` | 候補日提示済 |
| `interviewer_check` | 面接官確認中 |
| `room_pending` | 会議室未押さえ |
| `confirmed` | 確定 |

改訂版P3-4では予約状態の正として使わない。既存プロフィールとの互換表示に必要な範囲だけ同期する。

### 面接日程予約 `SCHEDULE_REQUEST_STATUS`（改訂版P3-4）

| 値 | 表示名 |
| --- | --- |
| `draft` | 作成中 |
| `waiting_student` | 学生日程選択待ち |
| `booked` | 日程確定 |
| `expired` | 回答期限切れ |
| `cancelled` | 取消 |

面接形式は `INTERVIEW_FORMAT`（`online` / `onsite`）を使用する。

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

| 定数 | 既定値 | 環境変数 |
| --- | --- | --- |
| `SLA_WARN_HOURS` | 12 | `SLA_WARN_HOURS` |
| `SLA_ALERT_HOURS` | 24 | `SLA_ALERT_HOURS` |

---

## 10. `shared/constants.js` 実装方針

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
