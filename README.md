# hackathon-chatapp

**楽楽連ラク（らくらくれんらく）** — 採用コミュニケーション管理ツールのソースコード。

サービス名は「楽楽連ラク」が正式名称（詳細は [CLAUDE.md](CLAUDE.md) §1）。

## 事前準備

- VS Code（最新版）
- Git
- GitHubアカウント
- Node.js 22 LTS
- ブラウザ

Windows は WSL2 上の Ubuntu、Mac はネイティブ環境で実行します。Docker Desktop / Dev Container は使いません。

## 配置場所

- Windows: WSLホーム直下（`~/<リポジトリ名>`）に配置する。`/mnt/c` や OneDrive 配下には置かない。
- Mac: ホーム直下（`~/<リポジトリ名>`）に配置する。OneDrive / iCloud Drive 配下には置かない。

学生の clone は VS Code の「Git: Clone」から GitHub OAuth（ブラウザ認証）で行います。ターミナルでの素の `git clone` や SSH 鍵手順は標準フローにしません。

## 起動手順

1. VS Codeでリポジトリを開く
   
2. 初回セットアップの確認を行う

   ```bash
   bash ./check-env.sh
   ```

3. 依存パッケージをインストールする

   ```bash
   npm install
   ```

4. `.env` を作成する（初回のみ）

   ```bash
   cp .env.example .env
   ```

   `JWT_SECRET` は空だとサーバが起動時にエラーで停止する。次のコマンドで値を生成して `.env` に記入する。

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

   AI対応推奨度を確認する場合は、Google AI Studioで発行したキーを`GEMINI_API_KEY`へ設定する。
   未設定の場合も、AI表示以外の機能は動作する。

5. DBを初期化する（初回のみ）

   ```bash
   npm run db:migrate   # スキーマ適用
   npm run db:seed      # デモデータ投入
   ```

6. アプリを起動する

   | コマンド | 起動するもの |
   | --- | --- |
   | `npm run dev` | 両方（通常はこれを使う） |
   | `npm run dev:server` | APIサーバ + Socket.IO（`localhost:3000`）のみ |
   | `npm run dev:client` / `npm start` | Vite（`localhost:5173`）のみ |

7. ブラウザで `http://localhost:5173/` を開く

   ログインIDとパスワードは[シードデータ](#シードデータ)を参照。

講師のリファレンス環境では、lockfile通りに再現できることを `npm ci` で確認します。

## Gemini APIキーの発行と設定

ホームの「AI 現況サマリー」を使う開発者は、各自のGoogleアカウントでGemini APIキーを発行します。
APIキーはチーム内で共有せず、開発者ごとに用意してください。

### Google AI StudioでAPIキーを発行する

1. [Google AI StudioのAPIキー画面](https://aistudio.google.com/app/apikey)を開く。

2. Googleアカウントでログインし、初回表示される利用規約に同意する。

3. APIキーを紐づけるGoogle Cloudプロジェクトを選ぶ。

   初めてGoogle AI Studioを使う場合は、既定のプロジェクトが自動作成されることがあります。
   プロジェクトが表示されない場合は、Google AI Studioの「Dashboard」から「Projects」を開き、プロジェクトを作成またはインポートしてください。

4. 「Create API key」を押し、作成されたAPIキーをコピーする。

   発行画面や項目名が変わった場合は、[Gemini APIキーの公式手順](https://ai.google.dev/gemini-api/docs/api-key)を確認してください。

### ローカル環境へ設定する

1. `chatapp/.env` が存在しない場合は、`.env.example`をコピーする。

   ```bash
   cp .env.example .env
   ```

2. `chatapp/.env`へ、発行したAPIキーを設定する。

   ```dotenv
   GEMINI_API_KEY=ここに発行したAPIキーを貼り付ける
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

3. `npm run dev`を再起動する。

4. `hr1`、`hr2`、または`admin1`でログインする。

5. ホーム右側の「AI 現況サマリー」が「生成済み」になることを確認する。

   生成されない場合は、カードの「更新」を押してください。

### チーム開発での注意

- `.env`はGitへコミットしない。
  このリポジトリでは、`.env`を`.gitignore`の対象に設定しています。
- APIキーをGitHub、チャット、スクリーンショットへ貼らない。
- `.env.example`には設定名だけを記載し、実際のAPIキーを記載しない。
- 無料枠を超えた場合、課金設定をしていないプロジェクトではAI生成がエラーになりますが、ホームの一覧とチャットは動作を継続します。
- Geminiの無料枠では、送信内容がGoogleのサービス改善に使われる場合があります。
  実在する応募者情報を使う前に、所属組織の個人情報ルールを確認してください。

この実装がGeminiへ送る情報とエラー時の挙動は、[Gemini AI現況サマリーの設定](docs/GEMINI_AI_SUMMARY.md)を参照してください。


## シードデータ

DB本体（`data/`配下のSQLiteファイル）は`.gitignore`対象。`server/db/seed.js`（git管理下）を各自のローカルで実行してデモデータを投入する。

```bash
npm run db:migrate   # スキーマ適用
npm run db:seed      # デモデータ投入
```

- ログインID：`hr1` / `hr2` / `admin1`（人事）、`student1`〜`student40`（学生）。パスワードは全員共通で `password123`
- 学生40名・ルーム40件。担当は `hr1` / `hr2` / `admin1` が各12名、残り4名は未割当（どの人事の受信箱にも出ない「拾い上げ待ち」）
- `student1`〜`student10` はデモの筋書き用に手書きしたシナリオ。`student11` 以降は固定シードから生成しているので、実行するたびに同じ内容になる
- `db:seed` は**既存データを全削除してから入れ直す**（再実行可能）。手動で追加したテストデータは消えるので注意

## 機能

### 基本要件

#### ログイン画面

- ユーザ名が未入力で「入室する」が押されたらエラーダイアログを表示する

#### チャット画面

- ログイン画面で入力されたユーザ名に「さん」を加えて表示する
  - 入力：山田太郎
  - 表示：ログインユーザ：山田太郎さん
- 「投稿」ボタンでメッセージを投稿する
  - 投稿されたメッセージは自分を含め、すべてのクライアントに投稿者名とともに表示される
  - 例） ○○○○ さん：（投稿文）
- 「メモ」ボタンでメモを投稿する
  - 投稿されたメモは自分にだけ表示される
  - 例） ○○○○ さんのメモ：（投稿文）
- 投稿は新しい順に表示される
- ユーザの入退室時に自分を除いた他のクライアントに入退室のメッセージが表示される
  - 入室の例） ○○○○ さんが入室しました
  - 退室の例） ○○○○ さんが退室しました

### 追加要件

※追加実装した機能を追記してください

- 学生の最新メッセージをGeminiで分析し、ルール緊急度とは別にAI対応推奨度を保存する
- AI対応推奨度が高い未対応案件を受信箱で強調する
- トーク画面に、学生が求めていることと判断時に注意する背景を表示する
- ホームのGemini AI現況サマリー（設定手順は [docs/GEMINI_AI_SUMMARY.md](docs/GEMINI_AI_SUMMARY.md)）
- 画面右下に常駐し、新着通知を表情と吹き出しで知らせる通知ペット「らくす君」
  - ドラッグによる移動と、設定画面からの表示・非表示に対応
  - 表示・通知連動の編集箇所：`src/components/RakusuKunPet.vue`
  - 表情画像の差し替え先：`src/images/rakusukun/`（表示には台座なしの `*-cutout.png` を使用）
