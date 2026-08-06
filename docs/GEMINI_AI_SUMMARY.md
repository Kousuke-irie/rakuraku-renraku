# Gemini AI現況サマリーの設定

ホーム右側の「AI 現況サマリー」は、Google Gemini APIをサーバーから呼び出して生成する。
APIキーをブラウザへ送らず、`.env` だけに保存する。

## 初回設定

1. [Google AI StudioのAPIキー画面](https://aistudio.google.com/app/apikey)を開く。
2. Googleアカウントで規約に同意し、新しいAPIキーを作成する。
3. `chatapp/.env` の `GEMINI_API_KEY=` の後ろへ、発行されたキーを貼り付ける。
4. APIサーバーを再起動する。
5. 人事アカウントでログインし、ホームのAIカードが「生成済み」になることを確認する。

```dotenv
GEMINI_API_KEY=ここに発行したキー
GEMINI_MODEL=gemini-3.5-flash-lite
```

APIキーはGitへコミットしない。
`.env` は既に `.gitignore` の対象になっている。

## 無料運用

- 既定モデルは無料枠対象の軽量モデル `gemini-3.5-flash-lite`。
- ログインのたびに無条件で再生成せず、プロセス内キャッシュがあれば再利用する。
- ルーム更新のたびには呼ばず、カードの「更新」を押した場合だけ再生成する。
- 追加のnpmパッケージは使わず、Node.js標準機能でAPIを呼ぶ。
- 課金を有効にしなくても無料枠で試せる。無料枠の上限はGoogle AI StudioのDashboardで確認する。

無料枠では、Googleの案内上、送信内容がサービス改善に使われる場合がある。
この実装が送るのは、学生の表示名、各種ステータス、経過時間、最終メッセージの先頭40文字である。
会話全文、ログインID、メールアドレス、メモは送らない。
実在する応募者データを扱う前に、組織の個人情報ルールを確認すること。

## 失敗時の挙動

- `GEMINI_API_KEY` が空: AIカードだけ「利用できません」。ホーム一覧は動作する。
- 3秒以内に応答しない: AIカードに再試行案内を表示する。
- APIエラー、無料枠超過、JSON不正: AIカードにエラーを表示する。
- モデル名が変更された: `.env` の `GEMINI_MODEL` だけを現行の無料枠モデルへ変更する。

## 実装場所

- 生成・入力制限・キャッシュ: `server/services/aiSummary.js`
- API: `server/routes/aiSummary.js`
- 画面の状態管理: `src/stores/rooms.js`
- AIカード: `src/components/AiSummaryCard.vue`
