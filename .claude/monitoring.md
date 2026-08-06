# 監視機能仕様（P4）

人事の学生対応を**監視し、取りこぼしと不適切発言をゼロにする**ための機能群。
P0〜P3 が「人事が対応しやすくする」機能だったのに対し、P4 は「対応できていないことを検出する」機能である。

> **コンセプトとの関係**
> 「返信すべき学生が、上から順に並んでいる」だけでは、**並んでいるのに誰も見ていない**状態を防げない。
> P4 はその穴を埋める。判断に迷ったら「人事が受信箱を開かなかった日に、それでも取りこぼしが検出されるか？」で判断すること。

---

## 1. 要件一覧

| ID | 要件 | 課題 | 依存 |
| --- | --- | --- | --- |
| **P4-0** | 監視イベント基盤（`alerts` テーブル） | — | なし |
| **P4-1** | SLA監視・段階エスカレーション | C-1 | P4-0 |
| **P4-2** | 就職差別・オワハラ検知 | 新規 | P4-0 |
| **P4-3** | 送信前チェック（ブロック型） | 新規 | P4-2 |
| **P4-4** | 監視ダッシュボード | 新規 | P4-1 / P4-2 |

**P4-0 を最初に単独 PR でマージすること。** `shared/constants.js` と `server/db/schema.sql` を触るため、
後続 PR と並行すると全部コンフリクトする（CLAUDE.md §8）。

### P4-1. SLA監視・段階エスカレーション

学生の最終発言から **N=24時間** で担当者へ通知、**2N=48時間** で上長へエスカレーションする。

**受入条件**
- 学生の発言から24時間返信がないと、担当者宛の通知が1件だけ作られる（60秒ごとに増えない）
- 48時間で上長（`role='admin'`）宛の通知が追加で作られる
- 担当者が返信すると、そのルームの未解決 SLA 通知が解消される
- 未アサインのルームは24時間時点で**上長へ直行**する
- 通知画面（`/notifications`）に自分宛の通知が新しい順に並び、クリックで該当ルームが開く
- 環境変数で閾値を短縮すればデモ中にライブでエスカレーションが起きる

### P4-2. 就職差別・オワハラ検知

人事の送信内容から、**就職差別に当たる質問**と**オワハラ表現**を検出して記録する。

**受入条件**
- 「ご本籍はどちらですか」を検知し、`severity='block'` の警告を返す
- 「本籍地はお伺いしません」は**検知しない**（除外パターン）
- 「他社は辞退してください」を検知する
- `GEMINI_API_KEY` が未設定でも検知が動作する（辞書ベースが本体）
- 検知結果が `alerts` に記録され、ダッシュボードから件数を確認できる
- ログに本文・学生氏名が出力されない（CLAUDE.md §6-8）

### P4-3. 送信前チェック（ブロック型）

送信ボタン押下時に P4-2 の検査を実行し、検知したら警告ダイアログを出す。

**受入条件**
- 検知時、メッセージは送信されずダイアログが出る
- ダイアログには**該当箇所と理由**が表示される
- 「修正する」で入力欄に戻り、本文が失われない
- 「このまま送信」を選ぶと送信され、**その事実が記録される**
- ダイアログを経ずに socket で直接送信しても、サーバ側で検知・記録される
- 検査のために送信が1秒以上待たされない

### P4-4. 監視ダッシュボード

`/dashboard`（`role='admin'` 限定）。対応状況をチャートで可視化する。

**受入条件**
- 選考ステータスごとの学生数がグラフで表示される
- 担当者ごとの SLA 遵守状況が比較できる
- エスカレーション中の案件が一覧で確認できる
- すべてのチャートに**テーブル表示への切替**がある
- 数値がゼロ件でもレイアウトが崩れない

---

## 2. P4-0：共通基盤 `alerts`

SLA も コンプライアンスも「監視イベント」として1テーブルに集約する。
分けると P4-4 が4種類の集計を書く羽目になる。

### スキーマ（`server/db/schema.sql` に追記）

```sql
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('sla_notify', 'sla_escalate', 'compliance')),
  severity TEXT NOT NULL CHECK(severity IN ('block', 'warn', 'info')),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  target_user_id INTEGER REFERENCES users(id),
  actor_user_id INTEGER REFERENCES users(id),
  trigger_message_id INTEGER REFERENCES messages(id),
  rule_code TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  resolved_at TEXT
);

-- ★多重通知を防ぐ唯一の仕組み
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_sla_unique
  ON alerts(kind, room_id, trigger_message_id, target_user_id)
  WHERE kind IN ('sla_notify', 'sla_escalate');
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_compliance_unique
  ON alerts(room_id, trigger_message_id, rule_code)
  WHERE kind = 'compliance';

CREATE INDEX IF NOT EXISTS idx_alerts_target ON alerts(target_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_open   ON alerts(kind, resolved_at);
CREATE INDEX IF NOT EXISTS idx_alerts_room   ON alerts(room_id);
```

| 列 | 意味 |
| --- | --- |
| `kind` | イベント種別 |
| `severity` | 重大度。`block` は送信前に止める、`warn` は注意表示、`info` は記録のみ |
| `target_user_id` | 通知先。SLA は担当者／上長、コンプライアンスは NULL（本人には即時ダイアログで伝えるため） |
| `actor_user_id` | 原因を作った人。コンプライアンスの送信者。SLA では担当者 |
| `trigger_message_id` | 起点メッセージ。**冪等キーの一部** |
| `rule_code` | `compliance_rules.code`。SLA では NULL |
| `detail` | 画面に出す短文。**本文全体を入れない**（該当キーワード周辺のみ） |
| `resolved_at` | SLA：人事が返信した時刻。コンプライアンス：常に NULL（記録は消さない） |

### 冪等性 ★最重要

**部分 UNIQUE インデックス2本 + `INSERT OR IGNORE`** で担保する。
60秒タイマーが同じ学生を何度も通知しないための唯一の仕組みであり、**アプリ側に状態を持たせない**。

| インデックス | キー | 意味 |
| --- | --- | --- |
| `idx_alerts_sla_unique` | `(kind, room_id, trigger_message_id, target_user_id)` | 1ルーム×1起点メッセージ×1宛先×1種別につき1件 |
| `idx_alerts_compliance_unique` | `(room_id, trigger_message_id, rule_code)` | 1メッセージ×1ルールにつき1件 |

**テーブルレベルの `UNIQUE(...)` にしてはならない。**
SQLite は UNIQUE 制約中の NULL を互いに異なる値として扱うため、`target_user_id IS NULL` の
コンプライアンス行が重複し放題になる（実測で確認済み）。また `rule_code` がキーに入らないと、
1通に複数ルールが当たったときに1件しか記録されない。

検証済みの挙動：

| ケース | 結果 |
| --- | --- |
| 同じ SLA 通知を2回 INSERT | 1件（重複しない） |
| 同じ宛先に `sla_notify` と `sla_escalate` | 2件（`kind` が違うので両方立つ。これは正しい） |
| 同じコンプライアンス警告を2回 INSERT | 1件 |
| 同一メッセージに別ルールが2つ該当 | 2件（意図した挙動） |
| 学生が再発言（`trigger_message_id` が変わる） | 2件（正しく再通知される） |

### `shared/constants.js` への追加

```js
export const ALERT_KIND = Object.freeze({
  SLA_NOTIFY: 'sla_notify',
  SLA_ESCALATE: 'sla_escalate',
  COMPLIANCE: 'compliance',
});

export const ALERT_KIND_META = Object.freeze({
  [ALERT_KIND.SLA_NOTIFY]: { label: '未返信24時間' },
  [ALERT_KIND.SLA_ESCALATE]: { label: '上長エスカレーション' },
  [ALERT_KIND.COMPLIANCE]: { label: 'コンプライアンス警告' },
});

export const ALERT_KIND_VALUES = Object.values(ALERT_KIND);

export const ALERT_SEVERITY = Object.freeze({
  BLOCK: 'block',
  WARN: 'warn',
  INFO: 'info',
});

export const ALERT_SEVERITY_META = Object.freeze({
  [ALERT_SEVERITY.BLOCK]: { label: '要修正' },
  [ALERT_SEVERITY.WARN]: { label: '要確認' },
  [ALERT_SEVERITY.INFO]: { label: '参考' },
});

export const ALERT_SEVERITY_VALUES = Object.values(ALERT_SEVERITY);

export const COMPLIANCE_CATEGORY = Object.freeze({
  DISCRIMINATION: 'discrimination',
  OWAHARA: 'owahara',
});

export const COMPLIANCE_CATEGORY_META = Object.freeze({
  [COMPLIANCE_CATEGORY.DISCRIMINATION]: { label: '就職差別のおそれ' },
  [COMPLIANCE_CATEGORY.OWAHARA]: { label: 'オワハラのおそれ' },
});

export const COMPLIANCE_CATEGORY_VALUES = Object.values(COMPLIANCE_CATEGORY);

// SLA 通知の閾値（P4-1）。サーバは環境変数で上書きする。
export const SLA_NOTIFY_HOURS = 24;      // N：担当者へ通知
export const SLA_ESCALATE_HOURS = 48;    // 2N：上長へエスカレーション

// 監視ダッシュボードの推移グラフの日数（P4-4）
export const DASHBOARD_TREND_DAYS = 14;
```

`SOCKET_ON` に1件追加する：

```js
ALERT_NEW: 'alert:new',
```

**すべて `Object.freeze` + `_META` + `_VALUES` の3点セットで定義すること**（既存の全列挙値と同じ形）。
CHECK 制約の文字列と完全に一致させる。

---

## 3. P4-1：SLA監視・段階エスカレーション

実装：`server/services/slaMonitor.js`

### 閾値

| 経過時間 | `kind` | 通知先 |
| --- | --- | --- |
| **24h（N）** | `sla_notify` | `rooms.assignee_user_id`。**NULL なら上長全員** |
| **48h（2N）** | `sla_escalate` | `role = 'admin'` の全ユーザー |

- 環境変数 `SLA_NOTIFY_HOURS` / `SLA_ESCALATE_HOURS` で上書きする。
  既存の `envHours()`（`urgencyCalculator.js`）と同じヘルパを共有する
- **既存の `SLA_WARN_HOURS=12` / `SLA_ALERT_HOURS=24` は流用しない。**
  あれは緊急度（P1-6）の閾値であり、通知の閾値とは責務が別。混ぜると片方を変えたときに両方が動く
- ただし N=24 は `SLA_ALERT_HOURS` と同値なので、**担当者への通知は `urgency` が `high` に変わるのと同時に飛ぶ**。
  これは意図した整合であり、受信箱の並びと通知が食い違わない

### 対象外

以下は SLA の対象にしない（`ELAPSED_BADGE_HIDDEN_STATUSES` と同じ考え方）。

- `handling_status IN ('waiting_student', 'done')` — 人事は返信済み
- `handling_status = 'on_hold'` — 意図的に止めている（人事の明示的な意思。P1-2 の設計判断を踏襲）
- `last_student_message_at IS NULL` — 学生がまだ発言していない

### 検出

既存の60秒タイマー（`server/index.js`）の中で、`recalculateAllUrgencies` の**直後**に呼ぶ。
**新しいタイマーを増やさないこと。**

```
detectSlaBreaches(db, now):
  1. 対象ルームを取得（上記の対象外を除外）
     - 併せて最新の学生メッセージID（trigger_message_id）を引く
  2. 経過時間で kind を決める
     - >= SLA_ESCALATE_HOURS → sla_escalate（上長全員へ1件ずつ）
     - >= SLA_NOTIFY_HOURS   → sla_notify（担当者へ1件。未アサインなら上長全員へ）
  3. INSERT OR IGNORE で alerts に入れる
  4. changes > 0 だったものだけ返す（配信対象）
```

48時間を超えたルームには `sla_notify` と `sla_escalate` の**両方**が残る。
これは正しい。担当者宛の1件目は「あなたがまだ返していない」、上長宛の2件目は「部下が返していない」であり、宛先も意味も違う。

### 解消

人事が返信した時点で、そのルームの未解決 SLA 通知を閉じる。

```sql
UPDATE alerts
   SET resolved_at = ?
 WHERE room_id = ?
   AND kind IN ('sla_notify', 'sla_escalate')
   AND resolved_at IS NULL
```

呼び出し位置は `insertMessage`（`server/routes/messages.js`）内、送信者が `hr` / `admin` のときのみ。
P2-3 の自動ステータス遷移と同じ場所なので、そこに寄せる。

### 配信

`server/services/realtime.js` に追加する。既存の `emitAiSummaryUpdated` と同じ `user:{id}` ルームを使う。

```js
export function emitAlertNew(io, targetUserId, alert) {
  if (!io) return;
  io.to(`user:${targetUserId}`).emit(SOCKET_ON.ALERT_NEW, { alert });
}
```

### REST

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET | `/api/alerts` | 自分宛の通知。`?unread=true` / `?limit=50`。新しい順 |
| POST | `/api/alerts/:id/read` | 既読化。`target_user_id` が自分であることをサーバで検証する |
| POST | `/api/alerts/read-all` | 一括既読 |

`target_user_id != 自分` の通知は **404 を返す**（存在を漏らさない）。CLAUDE.md §6-6。

### 画面

`src/views/NotificationsView.vue` の雛形を置き換える。ファイル冒頭の「要件IDの追加が必要」コメントは削除し、`P4-1` を記載する。

- 1行＝1通知。`kind` のラベル・学生名・経過時間・発生時刻
- 未読は左に点。**色だけで示さない**（CLAUDE.md §6-13）
- 行クリックで `/inbox/:roomId` へ遷移し、同時に既読化
- `sla_escalate` は「上長エスカレーション」ラベルを併記する
- ナビレールのベルバッジ（`AppNavRail.vue`）の件数を、暫定集計から `GET /api/alerts?unread=true` の件数へ差し替える

ハンドラは `composables/useSocket.js` に集約する（CLAUDE.md §6-12）。

**`stores/alerts.js` は作らない。** `frontend.md` §3 が「ストアは4つに固定」と定めているため、
通知の状態（`alerts` / `alertsUnreadCount`）は `useUiStore` に置く。
定型文・会社情報・選考フローと同じ扱い。

### ★デモ用の時間短縮

**24時間はデモで待てない。** `envHours()` は小数を受けるので、コード変更なしで短縮できる。

```bash
SLA_NOTIFY_HOURS=0.02      # 72秒
SLA_ESCALATE_HOURS=0.04    # 144秒
```

60秒タイマーと合わせて「学生が発言 → 約1分後に担当者へ通知 → 約2.5分後に上長へエスカレーション」がライブで流れる。

**保険として seed も用意済み。** `student11`（長谷川 遥・担当 hr1・50時間経過）が
**エスカレーションを見せるための固定シナリオ**。担当を hr1 にしてあるのは、
admin1 にすると「上長が自分自身へ」の絵になり意図が伝わらないため。
生成分の学生にも60時間超が数名いるので、シード直後から通知一覧が埋まる。

`detail` の経過時間は1時間未満なら「1 時間未満」と出す。
**閾値を秒単位に短縮すると 0 になり「0 時間ありません」と壊れる**ため（実測で踏んだ）。

### 上長も学生を担当する（決定事項）

`admin` は上長であると同時に**自分の担当学生も持つ**。現状の seed（`admin1` = 木村 誠 が担当者を兼ねる）はそのまま正とする。

このため、エスカレーション先の算出でこうなる。

- **`role='admin'` の全員へ送る。担当者本人が admin でも除外しない**
- 除外すると、admin が1人しかいない構成で**エスカレーションが消滅する**（監視機能として最悪の挙動）
- 担当者が admin 本人の場合、その人は 24h に `sla_notify`、48h に `sla_escalate` の2件を受け取る。
  `UNIQUE` 制約は `kind` を含むので両方とも作られる。これは正しい —
  1件目は「あなたがまだ返していない」、2件目は「担当者が返していない（上長として把握せよ）」であり意味が違う
- 通知一覧では `ALERT_KIND_META` のラベルで両者を区別する

**デモの見せ方**：エスカレーションは `hr1` 担当の学生で起こす。
admin1 自身が担当する学生でやると「自分から自分へ」の絵になり、意図が伝わらない。

---

## 4. P4-2：就職差別・オワハラ検知

実装：`server/services/complianceChecker.js`

### 方針

- **辞書ベースが本体。AI は補助。** 送信をブロックする判定に外部 API を挟まない
- 検査対象は **`hr` / `admin` の発言のみ**。学生の発言は検査しない
- クライアントとサーバで**同一の検査関数**を使う。判定がズレると「ダイアログは出なかったのに記録された」が起きる

### 実装の分割

| ファイル | 責務 |
| --- | --- |
| `services/textNormalizer.js` | 照合前の正規化と位置の対応表。`normalizeForMatch` / `toOriginalRange` |
| `services/complianceChecker.js` | 辞書による検知。`checkCompliance` / `hasBlocking` / `extractContextAt` |
| `services/complianceAi.js` | LLM による検知。`checkComplianceWithAi` / `mergeFindings` |
| `services/complianceAlerts.js` | 検知結果を `alerts` に記録。`recordComplianceAlerts` / `queueAiComplianceRecord` |

辞書分の記録は `insertMessage` から呼ぶ（REST・socket の共通経路。外部通信が無いので
保存トランザクション内で完結してよい）。**AI 分は `queueAiComplianceRecord` で
トランザクションの外**（business-logic.md §7-5）。

### 照合の前処理（P4-2b）★

キーワードをそのまま `includes` すると **空白1つで回避できる**（「本 籍はどちらですか」）。
照合は必ず `normalizeForMatch` を通した文字列に対して行う。

1. NFKC 正規化（全角英数→半角、半角カナ→全角カナ）
2. 小文字化
3. 空白・全角空白・ゼロ幅文字の除去

**位置は一貫して UTF-16 コードユニット単位で扱うこと。** `RegExp.exec().index` も
`String.indexOf` もコードユニット基準なので、対応表をコードポイント単位にすると
絵文字を含む本文で該当箇所がずれる（実装時に踏んだ）。

半角カナの濁点は `ｼ` + `ﾞ` の2コードポイントなので、**1文字ずつ NFKC すると合成されない**。
`normalizeForMatch` は次の文字が `ﾞ` / `ﾟ` なら2文字まとめて正規化する。

### キーワードは正規表現（P4-2b）★

`compliance_rules.keyword` と `exclude_keyword` は**正規表現**として解釈する。

- 照合対象は正規化済み本文なので、**パターンに空白を書かないこと**（絶対に一致しない）
- 不正な正規表現は**リテラルとして**扱う。辞書1行の typo で検査全体を落とさないため
- 「尋ねている文」だけを拾うため、多くのルールで述語（何ですか・教えて 等）を
  パターンに含める。単語の存在だけで判定すると「弊社は労働組合と協議して…」まで block になる

### 辞書テーブル（`schema.sql`）

`tag_rules` と同じ**1行＝1キーワード**。

```sql
CREATE TABLE IF NOT EXISTS compliance_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('discrimination', 'owahara')),
  keyword TEXT NOT NULL,
  exclude_keyword TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('block', 'warn', 'info')),
  message TEXT NOT NULL,
  priority INTEGER NOT NULL
);
```

- **`code` を UNIQUE にしないこと。** 1つのルール（例 `honseki`）が
  本籍／出身地／生まれはどこ の複数キーワードを持つので、`code` は行のグループキーになる。
  P4-0 で誤って UNIQUE を付けたため、`migrate.js` の `dropLegacyComplianceRuleUnique()` が
  旧定義を検出してテーブルを作り直す
- `exclude_keyword` は**カンマ区切りで複数指定**できる。いずれか1つでも本文にあれば検知しない。
  除外語自体にカンマを含めないこと
- `tagClassifier.js` と同じくプロセス内キャッシュ + `clearComplianceRuleCache()` を持つ

### 既知の限界

除外語は**ルール単位**なので、1通に「正しい断り書き」と「実際の違反」が同じ code で同居すると
検知できない。例：「本籍はお伺いしませんが、出身地はどちらですか」は `honseki` ごと除外される。
辞書ベースの構造的な限界であり、拾うなら AI 併用（下記）の役目にする。

### 判定

```
checkCompliance(db, body): { code, category, severity, message, matched }[]

1. compliance_rules を priority 昇順で取得（初回のみ DB、以降キャッシュ）
2. body に keyword が部分一致するルールを集める
3. exclude_keyword が body に含まれるルールは除外する
4. 同一 code は1件に畳む
5. severity の重い順（block → warn → info）に並べて返す
```

**用件タグ（P1-5）と違い、最初のマッチで確定しない。** 1通に複数の問題が混ざりうるので全件返す。

### 辞書の初期データ

厚生労働省「公正な採用選考の基本」で**尋ねてはならないとされる事項**に沿って構成する。
根拠が公的基準にあることがこの機能の説得力の源なので、独自解釈で増やさない。

#### `discrimination`（すべて `block`）

| code | keyword | exclude_keyword | message |
| --- | --- | --- | --- |
| `honseki` | 本籍, 出身地, 生まれはどこ | お伺いしません, 伺いません, 質問しません, 不要です | 本籍・出生地に関する質問は就職差別に当たるおそれがあります |
| `family_job` | ご両親の職業, 父親の職業, 母親の職業, 家族構成, ご家族は何人 | — | 家族に関する質問は本人の適性・能力と関係がありません |
| `family_edu` | ご両親の学歴, 親の学歴 | — | 家族の学歴に関する質問は就職差別に当たるおそれがあります |
| `housing` | 持ち家, 間取り, 家賃はいくら, 住宅の広さ | — | 住宅状況に関する質問は就職差別に当たるおそれがあります |
| `assets` | 資産, 世帯収入, ご家庭の収入 | — | 生活環境・家庭環境に関する質問は避けてください |
| `religion` | 宗教, 信仰 | — | 信条・宗教に関する質問は思想信条の自由を侵すおそれがあります |
| `politics` | 支持政党, 政治観, 選挙は | — | 支持政党に関する質問は就職差別に当たるおそれがあります |
| `thought` | 尊敬する人物, 人生観, 信条 | — | 思想信条に関する質問は避けてください |
| `union` | 労働組合, 学生運動 | — | 労働組合・学生運動に関する質問は就職差別に当たるおそれがあります |
| `newspaper` | 購読新聞, 愛読書 | — | 購読紙・愛読書に関する質問は思想信条の把握につながります |

#### `owahara`

| code | keyword | severity | message |
| --- | --- | --- | --- |
| `withdraw_others` | 他社は辞退, 他社を辞退, 他社の選考を止め, 就活を終わらせ, 就職活動を終了 | `block` | 他社選考の辞退を条件にすることはオワハラに当たります |
| `decide_now` | 今この場で決めて, 今ここで決めて, 今すぐ決めて, この場で返事 | `block` | その場での意思決定の強要はオワハラに当たります |
| `offer_condition` | 内定を出す代わりに, 内定の条件として | `block` | 内定を交換条件にすることは避けてください |
| `deadline_today` | 返事は今日中, 本日中にご返答, 今日中に決めて | `warn` | 極端に短い回答期限は圧力と受け取られます |
| `pressure_soft` | 早めに返事を, すぐに決めて, 早急にご判断 | `warn` | 判断を急がせる表現になっていないか確認してください |

### 誤検知への備え ★デモの生死を分ける

「本籍地はお伺いしません」という**正しい**文が block になった瞬間にこの機能は信用を失う。

1. `exclude_keyword` を必ず持たせる（上表）
2. `block` でも**物理的には送信を禁止しない**。「修正する（既定）／このまま送信」の2択にする。
   業務を止めない設計のほうが、監視機能としても正しい（無視した事実こそ記録価値がある）
3. UI に免責を添える：**「参考情報です。最終判断は担当者が行ってください」**
   「就職差別を検知しました」と断定すると法的判断の代行に見える

### LLM 判定（P4-2b・実装済み）

実装：`server/services/complianceAi.js`

辞書は部分一致なので、**言い換え・迂回表現を原理的に拾えない**。そこを埋める層。

> **汎用のモデレーションAPI（Perspective API / OpenAI Moderation / Azure Content Safety）は使えない。**
> あれらは toxicity / hate / harassment という「攻撃性」の軸で測る。
> 「ご本籍はどちらですか」は丁寧で攻撃性ゼロなのでスコアが立たない。
> 測る軸が違うので、**厚労省の基準をこちらから定義してプロンプトで渡す**しかない。
> （なお Perspective API は 2026年12月に終了予定）

#### 送信前チェックでも待つ

当初は「ブロック判定に AI を挟まない」としていたが、**チームの判断で同期に変更した**。
接続できるときは AI の結果を待ってから送信可能にする。

- 待っている間は送信ボタンを `確認中…` にして押下不可にする（固まって見せない）
- タイムアウト（`COMPLIANCE_AI_TIMEOUT_MS`・既定8秒）・APIエラー → `status='error'`。
  **辞書の結果だけで先へ進める**

**タイムアウトは `AI_PRIORITY_TIMEOUT_MS`(3秒) を流用しないこと。**
実測で温まっていれば中央値約1.0秒・最大1.6秒だが、**初回だけ TLS ハンドシェイク等で3秒を超える**。
3秒にすると1通目が必ず `error` になる。余裕を持たせても通常の待ち時間は増えない。

`gemini-3.5-flash-lite` は無料枠だと **`503 UNAVAILABLE` を返すことがある**（実測で発生）。
そのときも `error` に落ちて辞書の結果だけで進むので、送信は止まらない。
- `GEMINI_API_KEY` 未設定 → `status='unavailable'`。API を呼ばない
- `ok` 以外のときはダイアログに
  **「AIによる検証はできていません。辞書による判定のみを表示しています。」**を出す

#### ★ルール語彙は辞書と共有する

AI にも**辞書と同じ `COMPLIANCE_RULE` から選ばせる**。プロンプトにルール一覧
（コード＋説明）を埋め、enum 外のコードは検証で捨てる。どれにも当てはまらないときだけ
`other_discrimination` / `other_owahara` に落とす。

当初は `ai_discrimination` のような AI 専用コードを作っていたが、これは誤り。

- **粒度が混ざる。** ダッシュボードの内訳で `honseki`（1論点）と
  `ai_discrimination`（10論点の寄せ集め）が並び、棒の長さを比較する意味がなくなる
- **情報が落ちる。** AI が宗教の質問と家庭環境の質問を検知しても同じコードに潰れる
- **`ai_` 接頭辞は本来あるべき列の代用だった。** 「どの検出器が見つけたか」は
  `alerts.source`（`dictionary` / `ai`）が持つ。ルールコードに混ぜない

`category` はモデルに答えさせず、`COMPLIANCE_RULE_CATEGORY` でコードから引く
（二重に答えさせると食い違う）。

#### 重複の除き方

`mergeFindings` と `queueAiComplianceRecord` は**同じルールコード**が重なったときだけ
AI 側を落とす。**カテゴリ単位で落とさないこと。** 辞書が `honseki` を拾ったからといって
AI が見つけた `religion` まで消えてしまう。

#### 誤検知を抑える仕掛け

AI 単独の指摘で業務を止める影響は大きいので、出力を絞る。

| 仕掛け | 内容 |
| --- | --- |
| 引用の実在確認 | `quote` が入力本文に含まれない指摘は捨てる（モデルの作文を表示しない） |
| enum 検証 | category / severity が定義外なら捨てる |
| 件数上限 | 最大3件。多いとダイアログが読めない |
| 重複排除 | 辞書が既に拾ったカテゴリは重ねない（`mergeFindings`） |
| プロンプト | 「確信が持てなければ含めない」「見逃しより誤検知の方が有害」と明示 |

#### キャッシュ

送信前チェックと送信後の記録で同じ本文を2回投げるため、本文をキーに60秒だけ
プロセス内キャッシュする。**Gemini への呼び出しは1通あたり1回**に収まる。

### ログ

`detail` には該当キーワードとその前後20文字程度までしか入れない。
**`console.log` / `console.warn` に本文・学生氏名を出さない**（CLAUDE.md §6-8）。
エラーログは `aiPriority.js:127` の作法（型と HTTP ステータスのみ）に倣う。

---

## 5. P4-3：送信前チェック（ブロック型）

### フロー

```
1. 人事が送信ボタン（または ⌘/Ctrl+Enter）
2. クライアントが POST /api/messages/check { roomId, body }
   → { results: [{ code, category, severity, message, matched }] }
3. results が空 → そのまま socket message:send
4. block / warn あり → ダイアログ表示
   ├ 「修正する」   → ダイアログを閉じ、入力欄にフォーカス。本文はそのまま
   └ 「このまま送信」→ message:send に { acknowledgedCodes: [...] } を添えて送信
5. サーバは insertMessage 内で同じ検査を再実行し、alerts に記録
   - acknowledgedCodes に含まれていた → detail に「警告を承知で送信」を付す
   - 含まれていない（＝チェックを経ずに直接送信された）→ detail に「送信前チェック未経由」を付す
```

**ステップ5がこの機能の本体である。** クライアントのダイアログは DevTools で消せるので、
サーバ側の再検査がないと「監視」が成立しない（CLAUDE.md §6-6）。

### API

| メソッド | パス | リクエスト | レスポンス |
| --- | --- | --- | --- |
| POST | `/api/messages/check` | `{ roomId, body }` | `{ results: [...] }` |

- `roomId` の `room_members` 検証は必須
- 検査は同期・辞書のみ。**10ms 程度で返ること**（受入条件「1秒以上待たせない」）
- REST にするのは「状態を変えない問い合わせ」だから。Socket に載せない（`api.md` §1 の責務分担）

### クライアント実装

差し込み口は `src/components/ChatPanel.vue` の `onSubmit`。ダイアログは `ComplianceDialog.vue`。

```js
const onSubmit = async () => {
  if (!canSend.value) return
  const results = await checkCompliance(roomId.value, draft.value)
  if (results.length > 0) {
    ui.openComplianceDialog(results)   // 送信しない
    return
  }
  await messages.sendMessage(roomId.value, draft.value)
}
```

- ダイアログの開閉状態は `stores/ui.js` に持つ（`snippetPaletteOpen` と同じ場所）
- 検査 API が失敗したら**送信を通す**。監視のために業務を止めない。サーバ側で記録は残る
- 該当箇所は `matched` の文字列で示す。**`v-html` を使わない**（CLAUDE.md §6-10）。
  ハイライトが必要なら文字列を分割して複数の `<span>` をテキスト補間で並べる

### ダイアログの中身

```
⚠ 送信前の確認                        （severity のラベルを併記）

  就職差別のおそれ
  「ご本籍はどちらですか」
  本籍・出生地に関する質問は就職差別に当たるおそれがあります

  参考情報です。最終判断は担当者が行ってください。

              [ このまま送信 ]  [ 修正する ]
```

- **「修正する」を既定フォーカス**にする（誤って Enter を押しても送信されない）
- 既存の `composer__warning`（P2-2 の未設定変数警告）と同じ見た目の語彙に揃える
- `ProfileDialog.vue` と同じく native `<dialog>` + `showModal()`。
  **`margin: auto` を必ず書くこと**（無いと top layer でも中央に来ず左上に寄る）
- 検知が多いと縦に伸びるので、リストだけ `overflow-y: auto` にしてボタンを常に見せる

---

## 6. P4-4：監視ダッシュボード

`/dashboard`。閲覧は**人事全員（hr / admin）**。ナビレールには「全学生」の下に追加する。

**担当者別の集計もあえて全員に見せる。相互監視のため。**
当初は admin 限定にしていたが、隠すと「取りこぼしの拾い上げ」が個人の努力に戻ってしまう。
学生には出さない（サーバ側 `requireHr` とルーターの `meta.roles` の両方で弾く）。

### チャートライブラリ

**Chart.js 4 + vue-chartjs 5 を採用する。** CLAUDE.md §3 の「勝手にライブラリを追加しない」に対する、
チーム合意済みの例外として明記する。

```bash
npm i chart.js vue-chartjs
```

| 判断 | 理由 |
| --- | --- |
| Chart.js を選ぶ | tree-shaking 後 60KB 台。必要な4種（bar / line）だけ登録すれば済む |
| ECharts を選ばない | 330KB 超。この規模の4枚のグラフに見合わない |
| Vuetify のチャートを使わない | 存在しない（Vuetify にチャートコンポーネントはない） |

**必要なコントローラだけ明示登録すること。** `chart.js/auto` を import すると全部入りになる。

```js
import { Chart, BarController, BarElement, LineController, LineElement,
         PointElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
Chart.register(BarController, BarElement, LineController, LineElement,
               PointElement, CategoryScale, LinearScale, Tooltip)
```

`Legend` は登録しない。**凡例は HTML で描く**（`ChartPanel` の `legend` prop）。
canvas 内に描くと読み上げできないうえ、色の隣にテキストを置けないため。

**色が2種類以上あるチャートには必ず凡例を付けること。** 単一色のチャート
（推移・コンプラ内訳）はタイトルが系列名を兼ねるので付けない。

実装は `src/plugins/charts.js`（登録・配色・共通オプション）と
`src/components/ChartPanel.vue`（枠・「表で見る」トグル）に分ける。
**配色は検証済みなので `CHART_COLOR` を変えないこと。**

### ★canvas の帰結：テーブル表示は必須

Chart.js は canvas に描くので DOM が存在せず、スクリーンリーダーから読めない。
**全チャートに「表で見る」トグルを付け、`<table>` を出せるようにすること。**
これは CLAUDE.md §6-13（色だけで表現しない）と同じ趣旨であり、任意ではない。

### 画面構成

```
┌─────────────────────────────────────────────────────┐
│ [KPIタイル] 要返信 / 24h超 / 48h超（上長対応中） / 今週の警告  │
├───────────────────────────┬─────────────────────────┤
│ 選考ステータス別 学生数        │ 担当者別 SLA 遵守状況        │
│ （横棒・単一色・ファネル順）     │ （横100%積み上げ・3段）      │
├───────────────────────────┼─────────────────────────┤
│ SLA違反の発生推移（直近14日）    │ コンプライアンス検知の内訳     │
│ （縦棒・単一系列）             │ （横棒・単一色・カテゴリ別）    │
├───────────────────────────┴─────────────────────────┤
│ エスカレーション中の案件（テーブル）                        │
└─────────────────────────────────────────────────────┘
```

### 各パネルの仕様

#### ① KPIタイル行 — チャートにしない

見出しの4数値は**棒グラフにしない**。数字そのものが答えなので、大きな数字（stat tile）で出す。

| タイル | 値 |
| --- | --- |
| 要返信 | `handling_status = 'needs_reply'` の件数 |
| 24時間超 | 未解決の `sla_notify` 件数 |
| 上長対応中 | 未解決の `sla_escalate` 件数 |
| 今週のコンプラ警告 | 直近7日の `kind='compliance'` 件数 |

既存のサマリーバー（P1-8）と数字が重なる部分があるが、こちらは**全学生・全担当者**が母数である点が違う。
ラベルに「全社」と明記して混同を避ける。

#### ② 選考ステータス別 学生数（★ユーザー要望）

- **形式**：横棒グラフ。カテゴリ名が長い（「エントリー」「一次面接」…）ので縦棒にしない
- **並び**：`SELECTION_STATUS_VALUES` の定義順＝選考の進行順。件数順に並べ替えない（ファネルとして読ませる）
- **区分は4種類**（`SELECTION_PHASE`）：選考前（エントリー）／選考中（書類〜五次面接）／
  確定（内定）／離脱（辞退）。エントリーも内定も“選考中”ではない
- **色は4区分に1色ずつ**。凡例を必ず添える

| 区分 | hex | |
| --- | --- | --- |
| 選考前 | `#C98500` | 琥珀 |
| 選考中 | `#3B7FC4` | 青 |
| 確定 | `#4a3aa7` | 紫 |
| 離脱 | `#D03B3B` | 赤 |

  - **「確定＝緑」にはできない。** バーの並びで確定(内定)と離脱(辞退)が隣接するため、
    緑と赤を当てると P型・D型色覚で潰れる（実測 CVD ΔE 5.2）。代わりに紫を当てている
  - この4色は全項目 PASS（隣接 CVD ΔE 15.0 / 通常視 17.7）。**勝手に変えないこと**
  - 緑を残す案（確定=`#008300` / 離脱=`#c2185b`）も CVD ΔE 6.4 の WARN 域で成立するが、
    離脱が赤でなくなるぶん「目立つべきものが目立たない」ので採らなかった
- 10段階を10色にしない。段階の違いは「バーの位置」が既に示しており、
  10色は必ず色覚多様性のチェックを落ちる（8色が上限）
- **母数**：既定は「全学生」。「自分の担当のみ」トグルは付けない（ダッシュボードは admin 用）

#### ③ 担当者別 返信状況

**画面に「SLA」という略語を出さない。** 何の略か伝わらないため、
「返信期限 24時間」のように**時間そのもの**を書く。ヘッダにも
「学生の最後の発言から24時間で担当者へ通知、48時間で上長へエスカレーション」と明示する。
コード側の識別子（`SLA_NOTIFY_HOURS` 等）はそのままでよい。

- **形式**：横100%積み上げ棒。1行＝1担当者。未配属の行を最上段に置く（`S-08` と同じ理由）
- **セグメント（3段）**：`24時間以内 / 24〜48時間 / 48時間超`
- **色**：検証済みの3色を使う

| セグメント | hex |
| --- | --- |
| 24時間以内 | `#2F8F5B` |
| 24〜48時間 | `#C98500` |
| 48時間超 | `#D03B3B` |

- **既存のチップ色（`#3EA76B` / `#F5A623` / `#E5484D`）をそのまま使わないこと。**
  `#F5A623` は白背景に対して 2.03:1 しかなく、細い積み上げセグメントでは背景に溶ける
- セグメント間に **2px の白ギャップ**、データ端に **4px の角丸**、各セグメントに**件数を直接ラベル**する。
  この3点が色覚多様性への二次エンコーディングとして機能する（色だけに頼らない）

#### ④ 返信遅れ通知の発生推移

- **形式**：縦棒。直近 `DASHBOARD_TREND_DAYS = 14` 日、日別
- **系列**：1本（`sla_notify` の発生件数）。**凡例を出さない**（タイトルが系列名を兼ねる）
- **色**：`#3B7FC4`
- 折れ線にしない。日別の離散カウントなので棒が正しい

#### ⑤ コンプライアンス検知の内訳

- **形式**：横棒。`rule_code` ごとの件数、多い順
- **色**：全バー同一色 `#3B7FC4`
- **ルールコード（`honseki` 等）を画面に出さない。** `COMPLIANCE_RULE_META` の
  日本語ラベル（「本籍・出生地」）をサーバが添えて返す
- 表には「うちAI検知」列を出す。辞書だけでは届かなかった件数＝AI層の効き具合が分かる
- **右肩に別枠で「警告を無視して送信：N件」を数字で出す。**
  他社ツールにない指標であり、この機能の価値はここに出る

#### ⑥ エスカレーション中の案件

チャートではなくテーブル。`kind='sla_escalate' AND resolved_at IS NULL`。

| 列 |
| --- |
| 学生名 / 担当者 / 選考ステータス / 経過時間 / エスカレーション日時 |

- 経過時間の長い順
- 行クリックで `/inbox/:roomId`

### 色の検証結果

`dataviz` スキルの検証スクリプトで実測した（ライトモード、背景 `#ffffff`）。

| パレット | 結果 |
| --- | --- |
| `#3B7FC4` 単色 | **PASS**（全項目） |
| `#2F8F5B, #C98500, #D03B3B` | **PASS**（CVD 分離のみ WARN 7.0 → 直接ラベル＋2pxギャップで充足） |
| 対応ステータス5色をそのまま流用 | **FAIL**。`#F5A623` が明度帯・コントラスト（2.03:1）を外し、`#8B8D98`↔`#3EA76B` の通常視 ΔE 14.2 が下限15を割る |
| 対応ステータス5色を調整 | **FAIL**。赤（要返信）と橙（対応中）が隣接する限り、P型・D型色覚での ΔE が 2〜4.5 にしかならない |

**したがって、対応ステータスの5分類はチャートにしない。**
必要ならテーブルの各行に既存の `StatusChip` を並べて表現する（チップはテキストラベルとセットなので色が単独で意味を担わない）。

ダークモードは現状 `src/style.css` に無いため未検証。導入する場合は**同じ検証を再実行すること**（明転写では通らない）。

### 集計 API

| メソッド | パス | レスポンス |
| --- | --- | --- |
| GET | `/api/dashboard` | 下記を1回で返す |

```json
{
  "kpi": { "needsReply": 12, "overdue24h": 4, "escalated": 1, "complianceThisWeek": 3 },
  "selectionBreakdown": [{ "status": "entry", "count": 8 }],
  "slaByAssignee": [{ "assigneeId": 2, "displayName": "大西 陽子", "within": 9, "over24h": 2, "over48h": 1 }],
  "slaTrend": [{ "date": "2026-08-01", "count": 2 }],
  "complianceBreakdown": [{ "ruleCode": "honseki", "category": "discrimination", "count": 2 }],
  "complianceIgnored": 1,
  "escalations": [{ "roomId": 12, "studentName": "…", "assigneeName": "…", "elapsedHours": 51.2, "createdAt": "…" }]
}
```

- 実装は `server/services/dashboard.js`。**1リクエスト＝複数クエリ**でよい（SQLite なので速い）
- 学生は **403**。`middleware/auth.js` の `requireHr` で弾く。
  ルーター側（`meta.roles: [ROLE.HR, ROLE.ADMIN]`）でも弾くが、
  **画面を隠すだけでは守れない**ので両方必要
- **選考ステータスは0人の段階も返す。** 欠けるとファネルの段が抜けて読めなくなる
- 担当者別SLAは alerts の履歴ではなく**いまこの瞬間**の経過時間で数える。
  「現在どれだけ滞留しているか」の指標なので、過去に超えたが返信済みのルームは遵守側に入る
- `/dashboard` のルートは**遅延読み込み**にする。chart.js を初期バンドルに載せないため
  （実測：分離すると 58KB gzip の別チャンクになる）
- 日別集計は `GROUP BY date(created_at)`。**件数0の日が欠落する**ので、サーバ側で14日分を埋めてから返す
  （クライアントで穴埋めするとグラフの日付軸がずれる）
- リアルタイム更新はしない。手動リロードで十分（`alerts` の更新のたびに再集計すると無駄が大きい）

---

## 7. 実装順と PR 分割

| # | PR | 内容 | 目安 |
| --- | --- | --- | --- |
| 1 | `feat/P4-0-alerts-foundation` | `schema.sql` に `alerts` / `compliance_rules`、`shared/constants.js` に列挙値 | **単独でマージ**。共有ファイルのみ |
| 2 | `feat/P4-2-compliance-checker` | `complianceChecker.js` + 辞書シード + サーバ側記録 | 半日 |
| 3 | `feat/P4-3-precheck-dialog` | `POST /api/messages/check` + ChatPanel ダイアログ | 半日 |
| 4 | `feat/P4-1-sla-escalation` | `slaMonitor.js` + `/api/alerts` + NotificationsView | 半日 |
| 5 | `feat/P4-4-dashboard` | Chart.js 導入 + `/api/dashboard` + DashboardView | 1日 |

**PR1 を通すまで 2〜5 に着手しないこと。** 並行すると `schema.sql` と `constants.js` で全滅する。

優先度：**P4-2 + P4-3 > P4-1 > P4-4**。
時間が足りなければ P4-4 を切る。P4-2/P4-3 は既存機能とまったく重ならないので、単独でも価値が残る。

### テスト

既存の `node --test server/**/*.test.js` に乗せる。最低限これだけは書く。

| ファイル | 検証すること |
| --- | --- |
| `complianceChecker.test.js` | 各ルールの検知／`exclude_keyword` による除外／複数同時検知の順序 |
| `slaMonitor.test.js` | 24h/48h の境界／**同じ入力で2回走らせても alerts が増えないこと**／未アサイン時の宛先 |
| `dashboard.test.js` | 件数0の日が埋まること／admin 以外が 403 になること |

冪等性のテストは必須。ここが壊れると通知が60秒ごとに増殖し、デモが即座に破綻する。

---

## 8. 環境変数

`.env.example` に追記する。

```bash
# 監視（P4-1）
SLA_NOTIFY_HOURS=24        # N：担当者へ通知
SLA_ESCALATE_HOURS=48      # 2N：上長へエスカレーション
```

デモ時は `.env.local` 側で `SLA_NOTIFY_HOURS=0.02` / `SLA_ESCALATE_HOURS=0.04` に落とす。

---

## 9. 決定事項（変更しないこと）

| # | 決定 | 理由 |
| --- | --- | --- |
| 1 | 監視イベントは `alerts` 1テーブルに集約する | 分けるとダッシュボードが4種類の集計を持つ |
| 2 | 冪等性は DB の UNIQUE 制約で担保する | アプリ側の状態管理は必ず壊れる |
| 3 | ~~送信ブロックの判定に外部 API を使わない~~ → **接続できるときは AI の結果を待つ**（P4-2b で変更）。待機中は送信ボタンを `確認中…` にする。落ちているときは辞書だけで進める | 検知漏れより待ち時間を許容するとチームで判断した |
| 4 | `block` でも物理的に送信を禁止しない | 業務を止めない。無視した事実の記録こそ監視価値 |
| 5 | 選考ステータス10段階を10色にしない | 8色を超える色分けは色覚多様性の検証を必ず落ちる |
| 6 | 対応ステータス5色をチャートに使わない | 赤（要返信）と橙（対応中）がP型・D型色覚で区別できない |
| 7 | 全チャートにテーブル表示を併設する | canvas は DOM を持たず読み上げできない |
| 8 | ダッシュボードはリアルタイム更新しない | 集計コストに見合わない |
| 9 | 通知の閾値と緊急度の閾値は別の環境変数にする | 責務が別。片方を変えたときに両方動くのを防ぐ |
| 10 | `admin` も学生を担当する。エスカレーション先から担当者本人を除外しない | 除外すると admin が1人の構成でエスカレーションが消滅する |

## 10. 非採用案

| 案 | 不採用の理由 |
| --- | --- |
| Perspective API / OpenAI Moderation / Azure Content Safety を使う | 測る軸が「攻撃性」。丁寧な差別質問はスコアが立たない。Perspective は2026年12月終了 |
| 日本語の差別語リスト（inappropriate-words-ja 等）を取り込む | 中身は放送禁止用語系の**語彙**辞書。「本籍を尋ねる」という**行為**は検出できない |
| 差別系ルールに「疑問形であること」を必須条件として足す | 検証に使ったテストケースに合わせただけで、根拠が弱い。正規表現に述語を含める形に置き換えた |
| SLA 通知を専用の `notifications` テーブルにする | ダッシュボードでコンプライアンス警告と合算できない |
| エスカレーション先を `users.manager_user_id` で持つ | 組織構造の管理が要る。`role='admin'` で足りる |
| 送信ブロックを Gemini の判定だけで行う | APIキー未設定時に機能が消える（`business-logic.md` §7 違反） |
| 対応ステータスの内訳を円グラフで出す | 5分類の円グラフは面積比較が読めず、色の検証も通らない |
| ダッシュボードを admin 限定にする | **相互監視ができない。** 隠すと取りこぼしの拾い上げが個人の努力に戻る（当初は限定していたが撤回） |
| AI 専用のルールコード（`ai_discrimination` 等）を使う | 内訳で辞書の具体ルールと粒度が混ざり比較できない。検出器の別は `alerts.source` で持つ |
| ルールコードを画面にそのまま出す | `honseki` では何のことか伝わらない。`COMPLIANCE_RULE_META` の日本語ラベルを出す |
| 選考ステータスで「確定＝緑」にする | 並び順で「離脱＝赤」と隣接し、P型・D型色覚で潰れる（実測 CVD ΔE 5.2）。確定は紫にした |
