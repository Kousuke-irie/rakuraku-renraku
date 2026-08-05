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


## シードデータ

DB本体（`data/`配下のSQLiteファイル）は`.gitignore`対象。`server/db/seed.js`（git管理下）を各自のローカルで実行してデモデータを投入する。

```bash
npm run db:migrate   # スキーマ適用
npm run db:seed      # デモデータ投入
```

- ログインID：`hr1` / `hr2` / `admin1`（人事）、`student1`〜`student10`（学生）。パスワードは全員共通で `password123`
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

- ...
- ...
- ...
