# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際に**毎回参照する**ガイドです。
詳細仕様は `.claude/` 配下に分割しています。**作業前に該当ファイルを必ず読んでください。**

---

## 1. プロジェクト概要

**楽楽連ラク（らくらくれんらく）** — 採用コミュニケーション管理ツール

サービス名は **「楽楽連ラク」が正式名称**。画面のワードマーク・`<title>`・資料・PR の文面はこの表記に統一する（旧称「Sentry」は使わない）。

新卒採用の人事担当者が、学生とのやり取りを一元管理するリアルタイムチャットツール。
3日間のハッカソン形式で開発する。

### コンセプト（実装判断の基準）

> **「返信すべき学生が、上から順に並んでいる」**
> これはチャットツールではなく、**採用対応の受信箱（インボックス）**である。

**この一文が全ての設計判断の基準。** 実装方針に迷ったら「人事が受信箱を上から処理するだけで対応漏れがゼロになるか？」で判断すること。

### 解決する課題

| # | 課題 | 対応する機能 |
| --- | --- | --- |
| C-1 | 合否連絡が1日遅れる | 経過時間バッジ（P1-4） |
| C-2 | 当日の欠席・遅刻が埋もれる | 緊急度自動判定（P1-6） |
| C-3 | 定型文のコピペに2〜3分 | 定型文コマンド（P2-1/P2-2） |
| C-4 | 担当者不在だと引き継げない | プロフィールパネル・共有メモ（P2-4/P2-5） |
| C-5 | 日程調整の進捗が不透明 | 日程調整トラッカー（P3-4） |

---

## 2. ドキュメント参照ルール ★重要

**作業を始める前に、該当する詳細ドキュメントを必ず読むこと。** 推測で実装しない。

| 作業内容 | 必ず読むファイル |
| --- | --- |
| 機能を実装する／要件IDを指定された | `.claude/requirements.md` |
| DB スキーマ・マイグレーション・クエリを書く | `.claude/database.md` |
| ステータス・タグ・緊急度などの列挙値を扱う | `.claude/constants.md` |
| 用件タグ判定／緊急度算出／ステータス自動遷移を触る | `.claude/business-logic.md` |
| REST エンドポイント・Socket.IO イベントを追加/変更する | `.claude/api.md` |
| Vue コンポーネント・Pinia ストア・画面 UI を作る | `.claude/frontend.md` |
| ブランチを切る／PR を出す／タスク分担を確認する | `.claude/workflow.md` |

複数該当する場合は**すべて**読むこと。例：「P1-6 緊急度判定を実装して」→ `requirements.md` + `business-logic.md` + `constants.md` + `api.md`。

---

## 3. 技術スタック

| レイヤ | 技術 |
| --- | --- |
| フロントエンド | Vue 3 (Composition API + `<script setup>`) / Vite |
| 状態管理 | Pinia |
| ルーティング | Vue Router 4 |
| バックエンド | Node.js 20 / Express |
| リアルタイム | Socket.IO v4 |
| DB | SQLite（better-sqlite3、WAL モード） |
| 認証 | JWT（httpOnly Cookie） / bcrypt |
| HTTP クライアント | axios |

**勝手にライブラリを追加しない。** 必要な場合は理由を提示して確認を取ること。

---

## 4. ディレクトリ構成

```
project/
├── CLAUDE.md
├── .claude/                   # 詳細仕様（このファイルから参照）
├── client/                    # Vue 3 SPA
│   └── src/
│       ├── views/             # InboxView, ChatView, LoginView, ProfileView
│       ├── components/        # RoomListItem, MessageBubble, ProfilePanel, MemoPanel, SnippetPalette
│       ├── stores/            # auth.js, rooms.js, messages.js, ui.js
│       ├── composables/       # useSocket.js, useElapsedTime.js
│       ├── api/               # axios インスタンス・エンドポイント
│       ├── router/
│       └── constants/         # shared/constants.js を re-export するだけ
├── server/
│   ├── index.js               # Express + Socket.IO 起動
│   ├── db/                    # schema.sql, migrate.js, seed.js
│   ├── routes/                # auth, rooms, messages, students, memos, snippets, summary
│   ├── sockets/               # index.js, handlers/
│   ├── services/              # tagClassifier.js, urgencyCalculator.js, snippetRenderer.js
│   ├── middleware/            # auth.js, errorHandler.js
│   └── config/
└── shared/
    └── constants.js           # 列挙値の単一の情報源（client/server 共用）
```

---

## 5. 開発コマンド

```bash
# 初回セットアップ
npm install                 # ルートで workspaces を一括インストール
npm run db:migrate          # schema.sql を適用
npm run db:seed             # デモ用シードデータ投入（学生10名・メッセージ80件）

# 開発
npm run dev:server          # Express + Socket.IO (localhost:3000)
npm run dev:client          # Vite (localhost:5173) → /api と /socket.io を 3000 へ proxy
npm run dev                 # 上記2つを同時起動

# 検証
npm run lint
npm run build               # client をビルドし server から静的配信できることを確認
```

`.env` は `.env.example` をコピーして作成する。必須：`PORT` / `DATABASE_PATH` / `JWT_SECRET` / `JWT_EXPIRES_IN` / `CLIENT_ORIGIN` / `SLA_WARN_HOURS`(12) / `SLA_ALERT_HOURS`(24)。`GEMINI_API_KEY` は P3-1 用で任意。

---

## 6. 実装上の絶対ルール

違反したら実装をやり直すこと。

### 全体

1. **列挙値をハードコードしない。** 対応ステータス・選考ステータス・用件タグ・緊急度は必ず `shared/constants.js` から import する。文字列リテラル（`'needs_reply'` 等）を直接書かない。
2. **日時は ISO8601 の UTC 文字列**で保存・送受信する。表示時のみローカル変換する。
3. 要件IDのない機能を勝手に追加しない。スコープ外（モバイル対応・友だち検索・ブロック・グループ作成UI・ファイル送信・カレンダー連携）には手を出さない。

### バックエンド

4. **Vite dev サーバに依存しない。** Socket.IO は必ず `server/index.js` の Express HTTP サーバにアタッチする。
5. **SQL は必ずプレースホルダを使う。** 文字列連結でクエリを組み立てない。
6. **認可はサーバ側で必ず検証する。** ルーム／メッセージ／メモの全操作で「そのユーザーが `room_members` に含まれるか」を確認する。クライアントから送られた `userId` を信用しない。
7. **パスワードは bcrypt(cost 10)。** 平文・可逆暗号での保存は禁止。
8. **ログにメッセージ本文・学生氏名を出力しない**（個人情報のため）。
9. 履歴取得は `before` カーソルによる**キーセットページネーション**。`OFFSET` を使わない。

### フロントエンド

10. **`v-html` を使わない。** メッセージ本文はテキスト補間で描画する（XSS対策）。
11. **`provide/inject` のバケツリレーを使わない。** 状態は Pinia に置く。
12. **Socket イベントのハンドラは `composables/useSocket.js` に集約する。** コンポーネント内で直接 `socket.on()` しない。
13. **緊急度・ステータスを色だけで表現しない。** 必ずテキストラベルを併記する。

---

## 7. 優先度と進め方

| フェーズ | 内容 | 期限 |
| --- | --- | --- |
| **P0** | 基盤（永続化・独立バックエンド・認証・ルーム・Pinia・トーク画面UI） | Day1 |
| **P1** | Must。**これが無ければコンセプトが成立しない** | Day2 前半 |
| **P2** | Should。使える水準にする | Day2 後半 |
| **P3** | Could。**1つだけ選んで実装する** | Day3 午前 |

**P1 が終わるまで P2 以降に着手しない。** 時間が足りない場合は P2・P3 を切り捨てて P1 を優先する。
P3 は AI 緊急度判定（P3-1）と日程調整トラッカー（P3-4）が候補。**採用は1つだけ。**

各要件の詳細と受入条件は `.claude/requirements.md` を参照。

---

## 8. チーム開発の基本

- ブランチ：`feat/P1-6-urgency-calculator` のように**要件IDを含める**
- コミット：`feat(P1-6): 緊急度算出サービスを追加`
- `shared/constants.js` と `server/db/schema.sql` は**コンフリクトしやすい共有ファイル**。変更する場合は必ずチームに周知し、単独の PR にする
- 詳細は `.claude/workflow.md` を参照

---

## 9. 用語

| 用語 | 意味 |
| --- | --- |
| ルーム | 人事と学生1名の 1:1 トークルーム。学生1名につき1つ |
| 対応ステータス | 人事側の処理状態（要返信／対応中／等）。**ルーム**に紐づく |
| 選考ステータス | 学生の選考進捗（エントリー／一次面接／等）。**学生**に紐づく |
| 用件タグ | メッセージの内容分類。サーバが自動判定する（学生には選ばせない） |
| 緊急度 | 用件タグ＋経過時間から算出する優先度 |
| 経過時間 | 学生の最終メッセージ受信時刻から現在までの時間 |
| 受信箱 | 人事のメイン画面。ルームが優先順に並ぶ一覧 |
