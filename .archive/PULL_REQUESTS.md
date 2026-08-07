# Pull Request アーカイブ — `rkclhack/hackathon-t1-A`

全 65 件。元リポジトリが閉じられる前に取得した記録です。
構造化データは同ディレクトリの `pull-requests.json` を参照。

## #1 FEAT: 基本要件の実装

- 状態: **merged** / 作成者: Jo042
- `BasicRequirements` → `master`
- 作成: 2026-08-05T06:33:37Z / マージ: 2026-08-05T06:34:09Z
- 変更: +32 -22 (3 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/1

<details><summary>本文</summary>

## 概要
以下の基本要件の実装

```
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
```

</details>

---

## #2 add claude.md

- 状態: **merged** / 作成者: Kousuke-irie
- `main` → `master`
- 作成: 2026-08-05T06:38:52Z / マージ: 2026-08-05T06:43:43Z
- 変更: +1883 -11 (19 files, 9 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/2

---

## #3 Feat/p0 backend shared foundation

- 状態: **merged** / 作成者: Jo042
- `feat/P0-backend-shared-foundation` → `master`
- 作成: 2026-08-05T07:31:36Z / マージ: 2026-08-05T07:31:51Z
- 変更: +3067 -191 (20 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/3

<details><summary>本文</summary>

## 概要
バックエンド共通基盤の作成

</details>

---

## #4 Frontend/basic フロントエンド基盤を作成しました

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/basic` → `master`
- 作成: 2026-08-05T08:04:55Z / マージ: 2026-08-05T08:26:39Z
- 変更: +156 -55 (24 files, 6 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/4

---

## #5 A-5

- 状態: **merged** / 作成者: Kousuke-irie
- `frontend/basic-2` → `master`
- 作成: 2026-08-05T08:55:40Z / マージ: 2026-08-05T08:59:11Z
- 変更: +978 -18 (9 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/5

<details><summary>本文</summary>

フロントエンドの共通基盤の作成

</details>

---

## #6 feat(A-3): 認証ガード・ログイン画面・認証ストアを実装

- 状態: **merged** / 作成者: Kousuke-irie
- `frontend/Auth` → `master`
- 作成: 2026-08-05T10:18:53Z / マージ: 2026-08-05T10:19:12Z
- 変更: +444 -80 (8 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/6

<details><summary>本文</summary>

- router を認証状態ベースのガードに置換（S-01〜S-06 のルートを定義） リロードで必ず弾かれる beforeEnter を廃止し、/auth/me の解決結果で判定する
- authStore の各 action を実装。fetchMe は 401・サーバ未起動とも 未認証として正常終了させ、ガードが待ち続けないようにする
- api/index.js に axios インスタンスと 401 インターセプタを追加
- LoginView を loginId/password のフォームに刷新（?redirect= の復元付き）
- provide/inject を廃止し ChatView を Pinia 参照に移行
- main.js に Pinia を登録、vite を 5173 + /api proxy に変更

</details>

---

## #7 feat(A-5): REST APIクライアント層をリソース別に整備

- 状態: **merged** / 作成者: Kousuke-irie
- `frontend/api` → `master`
- 作成: 2026-08-05T10:31:18Z / マージ: 2026-08-05T10:31:31Z
- 変更: +322 -70 (10 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/7

<details><summary>本文</summary>

api.md §2 の全エンドポイントを axios の薄いラッパーとして定義した。

- client.js: axios インスタンス・401 インターセプタ・toErrorMessage を index.js から移設。配列パラメータが `key[]=` にならないよう paramsSerializer: { indexes: null } を追加
- rooms / messages / students / users / memos / snippets / summary を リソース別ファイルに分割（共有ファイル化によるコンフリクトを回避）
- index.js は re-export のみ。既存の stores/auth.js の import はそのまま動く
- 各関数の JSDoc に引数・レスポンスの形と、履歴が降順で返る点・ before キーセットページネーション・REST 送信はフォールバック専用である点を明記

</details>

---

## #8 feat(A-4/A-1残): ルーム基盤・Socket認可共通化とシードデータ

- 状態: **merged** / 作成者: Jo042
- `feat/A3-A4-auth-room-foundation` → `feat/backend-base`
- 作成: 2026-08-05T10:38:10Z / マージ: 2026-08-05T10:39:04Z
- 変更: +738 -5 (9 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/8

<details><summary>本文</summary>

## 概要

A-3（認証、既存コミット）に続き、A-4（ルーム基盤・Socket認可共通化）とA-1残（シードデータ）を実装。

## 変更内容

- `server/services/roomAuth.js`: `assertRoomMember` / `listMemberRoomIds` をルーム認可の単一の情報源として新規実装（REST/Socket共通）
- `server/sockets/index.js`: Socket.IOハンドシェイクでhttpOnly CookieのJWTを検証（`io.use`、失敗時は`connect_error`）。接続後に所属する全ルームへ一括join、hr/adminは`hr`ルームにも追加join
- `server/middleware/auth.js`: JWT検証を`verifyToken`として切り出し、HTTPミドルウェアとSocket認証で共有
- `server/db/seed.js`: 人事3名・学生10名・ルーム10件・メッセージ80件、`tag_rules`・`snippets`を投入

## 受入条件チェックリスト

### A-4
- [x] 学生Aへのメッセージが学生Bの画面に表示されない（room_membersに基づくjoinで確認済み。学生は自室のみjoin）
- [ ] 受信箱を開いたままでも、どのルームの新着でも一覧が更新される（`message:new`のhrルーム配信はfeat/P1-1-inbox-message-api側の実装のため、マージ後に結合確認）

### A-1
- [x] サーバを再起動してもメッセージが消えない（SQLite永続化、P0で確認済み）
- [x] シードデータ投入後、ルームを開けば過去メッセージが表示される想定のデータを用意（DB直接確認済み。REST経由の確認はfeat/P1-1-inbox-message-api側の実装とマージ後に実施）
- [x] 別ブラウザで同じアカウントにログインしても同じ履歴が見える（DBが単一の情報源のため自明）

## 検証

- `npm run db:migrate` / `npm run db:seed` 正常終了（users:13, rooms:10, messages:80, tagRules:29, snippets:5）
- 自分の変更ファイルは`eslint`エラーなし
- ログイン→Cookie発行→`/auth/me`、Socket接続（正常なCookieのみ接続成功、無し/不正な値は`connect_error`）を実リクエストで確認
- `room_members`：hr1は全10ルーム、学生は自室のみ（DB直接確認）

## 備考

`feat/P1-1-inbox-message-api` 側には、A-3/A-4完了までのつなぎとして `tempAuth.js` / 仮`roomAuth.js` / `db/db.js`（重複） / 仮Socket認証があります。このPRのマージ後、`feat/P1-1-inbox-message-api` を `feat/backend-base` にマージする際にそれらを本実装へ差し替えます。

</details>

---

## #9 feat(P1-1): 受信箱一覧とメッセージ送受信APIを追加

- 状態: **merged** / 作成者: Jo042
- `feat/P1-1-inbox-message-api` → `feat/backend-base`
- 作成: 2026-08-05T10:40:09Z / マージ: 2026-08-05T10:48:05Z
- 変更: +268 -0 (4 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/9

<details><summary>本文</summary>

## 概要

P1-1（受信箱一覧）とB-2/B-3基盤（メッセージ履歴取得・送信）を実装。

## 変更内容

- `GET /rooms`, `GET /rooms/:id`: 受信箱一覧・ルーム詳細
- `GET /rooms/:id/messages`, `POST /rooms/:id/messages`: 履歴取得・送信（RESTフォールバック）
- `message:send`（Socket）: 保存処理はRESTと共有（`insertMessage`）
- A-3（認証）/A-4（ルーム認可共通化）完了までのつなぎとして `tempAuth.js` / 仮`roomAuth.js` / 仮Socket認証を使用

## 備考

`feat/backend-base` には既にA-3/A-4/A-1残がマージ済みのため、このPRのマージ時に以下の差し替え作業が発生します（担当①側で対応）：
- `middleware/tempAuth.js` → `middleware/auth.js`（`requireAuth`）
- `services/roomAuth.js`（仮実装） → 本実装済みのもの
- `server/db/db.js`（重複） → `server/db/index.js`
- Socket仮認証（`handshake.auth.userId`） → JWT Cookie認証

## 受入条件チェックリスト（P1-1）

- [ ] ログイン直後にこの画面が表示される（フロントエンド側で確認）
- [ ] 別ブラウザから学生がメッセージを送ると、リロードせず該当行が最上位付近に移動し未読バッジが増える（フロントエンド側で確認）

</details>

---

## #10 useSocketの登録

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/page` → `master`
- 作成: 2026-08-05T10:49:56Z / マージ: 2026-08-05T10:50:24Z
- 変更: +104 -14 (2 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/10

---

## #11 feat(backend): 認証・ルーム基盤・受信箱API・シードデータをmasterへ統合

- 状態: **merged** / 作成者: Jo042
- `feat/backend-base` → `master`
- 作成: 2026-08-05T10:55:27Z / マージ: 2026-08-05T11:01:38Z
- 変更: +1006 -362 (12 files, 8 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/11

<details><summary>本文</summary>

## 概要

バックエンド基盤一式（P0 / A-3 / A-4 / A-1残 / P1-1）を `master` へ統合する。

## 含まれる内容

- A-3: ID+パスワード認証（bcrypt cost10）、JWT httpOnly Cookie
- A-4: ルーム認可の共通化（`services/roomAuth.js`）、Socket.IOのJWT Cookie認証・ルーム一括join
- A-1残: シードデータ（人事3名・学生10名・ルーム10件・メッセージ80件・tag_rules・snippets）
- P1-1: 受信箱一覧（`GET /rooms`, `GET /rooms/:id`）、メッセージ履歴・送信（REST+Socket `message:send`）

いずれも `feat/A3-A4-auth-room-foundation`（#8）→ `feat/P1-1-inbox-message-api`（#9）の順で
`feat/backend-base` に統合済み。サーバー起動＋実リクエストでの結合確認済み（ログイン、
ルーム一覧の可視範囲、ルーム越境アクセスの403、Socket送受信のリアルタイム配信）。

</details>

---

## #12 Frontend/UI

- 状態: **merged** / 作成者: Kousuke-irie
- `frontend/ui` → `master`
- 作成: 2026-08-05T10:58:03Z / マージ: 2026-08-05T10:58:16Z
- 変更: +530 -3 (9 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/12

---

## #13 フィクスチャの実装

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/page` → `master`
- 作成: 2026-08-05T11:04:51Z / マージ: 2026-08-05T11:06:14Z
- 変更: +677 -0 (7 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/13

---

## #14 Fix/a 2 a 3 auth socket alignment

- 状態: **merged** / 作成者: Kousuke-irie
- `fix/A-2-A-3-auth-socket-alignment` → `master`
- 作成: 2026-08-05T12:58:20Z / マージ: 2026-08-05T12:58:30Z
- 変更: +657 -255 (24 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/14

---

## #15 Feat/b 2 chat view UI

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/B-2-chat-view-ui` → `master`
- 作成: 2026-08-05T15:22:31Z / マージ: 2026-08-05T15:23:02Z
- 変更: +2409 -177 (14 files, 5 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/15

---

## #16 Feat/a 3 login view UI

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/A-3-login-view-ui` → `master`
- 作成: 2026-08-05T15:50:28Z / マージ: 2026-08-05T15:50:37Z
- 変更: +176 -73 (3 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/16

---

## #17 Feat/a 3 register view UI

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/A-3-register-view-ui` → `master`
- 作成: 2026-08-05T15:59:43Z / マージ: 2026-08-05T15:59:53Z
- 変更: +388 -192 (3 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/17

---

## #18 feat(B-1/P1-1): RoomListItemに一覧行の表示項目①〜⑥を実装

- 状態: **merged** / 作成者: takahasinoa114
- `feat/B-1-talklist-ui` → `master`
- 作成: 2026-08-05T16:58:53Z / マージ: 2026-08-06T00:50:51Z
- 変更: +201 -4 (2 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/18

<details><summary>本文</summary>

## 概要
B-1（トークリスト画面）はrequirements.mdの通りP1-1（受信箱）に統合済みのため、独立画面は作らず `RoomListItem.vue` を実装。

frontend.md §5 の一覧1行の表示項目のうち①〜⑥を実装:
- ① 氏名＋大学名
- ② 選考ステータスラベル
- ③ 最終メッセージ抜粋（40文字で省略）
- ④ 経過時間バッジ（ElapsedBadge流用）
- ⑤ 未読数バッジ（UnreadBadge流用）
- ⑥ 対応ステータスチップ（クリックでドロップダウン→1クリックで変更。frontend.md §9でRoomListItemの責務と明記）

⑦担当者・⑧ピン留めアイコンは未実装（別PRで対応予定）。

あわせて `stores/ui.js` の `openStatusMenu`/`closeStatusMenu` が空実装で
ドロップダウンが開かない不具合を修正（1行ずつの最小修正）。

## 受入条件チェックリスト
- [x] 列挙値を `shared/constants.js`（constants/index.js経由）から import している
- [x] 対応ステータスは一覧を離れず2クリック以内で変更操作ができる（UI側。ストアの`updateHandlingStatus`本体は未実装のため見た目上は反映されない）
- [ ] `npm run lint`
- [ ] 2ブラウザでの実動作確認（`updateHandlingStatus`実装後にあらためて確認）

## 補足
`InboxSidebar.vue` は既存の表示専用ガワのままで、`RoomListItem` への差し替えは含んでいません（コンフリクト回避のため別作業とする想定）。

</details>

---

## #19 feat(S-06): 全画面共通のナビレールと設定画面の雛形を追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/S-06-app-shell-nav` → `master`
- 作成: 2026-08-05T21:37:25Z / マージ: 2026-08-06T00:51:44Z
- 変更: +1318 -195 (12 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/19

<details><summary>本文</summary>

## 概要

login 中の全画面（S-03〜S-06）を共通シェルで包み、左端に開閉式のナビゲーションレールを追加します。あわせて S-06 設定画面を2カード構成の雛形にしました。

| 追加・変更 | 内容 |
| --- | --- |
| `components/AppShell.vue` | 画面全体の固定レイヤとレール列。`InboxView` / `ChatView` から `position: fixed` を移した |
| `components/AppNavRail.vue` | 既定 64px のアイコンレール。hover / focus で 208px へ開く |
| `components/NavIcon.vue` | レール用のインライン SVG アイコン（ライブラリは追加していない） |
| `components/ProfileDialog.vue` | プロフィール編集ダイアログの雛形 |
| `views/NotificationsView.vue` | 通知ページの雛形（人事のみ） |
| `views/ProfileSettingsView.vue` | S-06 を2カード構成（左=設定内ナビ／右=詳細）で雛形化 |

## 設計上の判断

**レールを開いてもグリッド列の幅は変えず、絶対配置で右に重ねています。** 列幅を動かすと hover するたび受信箱の3ペインが再レイアウトされ、トーク幅が揺れて会話が読めなくなるためです。

**開閉のトリガは `:hover` と `:has(:focus-visible)` です。** `:focus-within` だとクリック後もフォーカスが残り、ポインタを外しても開いたままになります。キーボードの Tab では開きます。

**ロゴは画像を切り出さずに CSS で出し分けています。** 円マークは `logo-rakuraku.png` の左端 227×227px ちょうどなので、`overflow: hidden` の枠幅を `height` → `height × 800/227` に伸ばすだけで円だけ→ワードマーク全体になります。

**トップバーを廃止しました。** `InboxView` のワードマーク・タグライン・アバター・ログアウトと、`ChatView` のログアウトはレールへ吸収しています。

## 雛形として残した箇所

いずれもサーバ側が未実装のため、画面上の注記とコード内コメントに依存先の要件IDを書いてあります。

- **プロフィールの保存**：`server/routes/users.js` が空で `PUT /api/users/me` が無いため、保存ボタンを無効化（B-5）
- **定型文の管理**：`server/routes/snippets.js` が空で `GET /api/snippets` が無いため、プレースホルダのみ（P2-1 / P2-2）
- **通知一覧**：件数のみ実データ。一覧本体は未実装
- **通知バッジの件数**：`rooms.rooms` からの暫定集計。P1-8 で `rooms.summary.needsReply` に差し替える（`InboxSidebar` の暫定集計と同じ方式）

## レビューして決めてほしいこと

- [ ] **通知を独立機能にするか。** P3-3「リマインダー通知」は「実装しない」なので、通知ページは要件の裏付けがありません。要返信ルームの一覧に寄せる案もあります
- [ ] **S-06 とプロフィール編集ダイアログの役割分担。** 今はダイアログを唯一の編集フォームとし、S-06 側は現在値の表示＋ダイアログを開くボタンにしています（フォームの二重実装を避けるため）

## 完了の定義（workflow.md §6）

- [x] `npm run lint` が通る
- [x] リロードしても壊れない（`/inbox` `/inbox/:roomId` `/notifications` `/settings/profile` で確認）
- [x] 列挙値を `shared/constants.js` から import している（`HANDLING_STATUS` / `HANDLING_STATUS_META` / `URGENCY` / `ROLE`）
- [x] `v-html` を使っていない
- [x] 2ロール（人事 `hr1` / 学生 `student1`）で実際に動作確認した
- [ ] サーバ側の認可チェック … **N/A**（サーバ側の変更なし）
- [ ] SQL のプレースホルダ … **N/A**（SQL の変更なし）
- [ ] Socket ハンドラの `useSocket.js` への集約 … **N/A**（socket の購読を追加していない）

## 動作確認したこと

- レールの hover / focus 開閉、遷移後にポインタを外すと閉じること
- キーボード Tab での開閉と、Enter でのリンク遷移
- 人事（受信箱・通知・設定）／学生（チャット・設定、通知は非表示）のロール出し分け
- プロフィール編集ダイアログの起動・画面中央への配置・キャンセル・Esc・backdrop クリックでの閉じ方
- 設定画面の3セクション切替
- `npm run build` の成功とコンソールエラーなし

## 注意

`router/index.js` を変更しているため、Vite の HMR ではルート表が更新されません。**ブラウザを一度リロードしてから触ってください**（リロード前は通知リンクが効きません）。またこのファイルは workflow.md §4 のコンフリクトしやすい共有ファイルなので、追加した1ルートだけに変更を留めています。

</details>

---

## #20 P1-2-P1-5-P1-6-P1-7-P1-8-backend

- 状態: **merged** / 作成者: Jo042
- `codex/feat/P1-2-P1-5-P1-6-P1-7-P1-8-backend` → `master`
- 作成: 2026-08-06T01:46:29Z / マージ: 2026-08-06T01:46:39Z
- 変更: +1072 -114 (21 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/20

<details><summary>本文</summary>

P1-2-P1-5-P1-6-P1-7-P1-8

</details>

---

## #21 P1-5

- 状態: **merged** / 作成者: hinato150
- `feat/P1-5` → `master`
- 作成: 2026-08-06T02:11:36Z / マージ: 2026-08-06T02:24:30Z
- 変更: +5 -0 (1 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/21

---

## #22 feat(P1-7): FilterBarに選考ステータスの絞り込みを実装

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/senkou` → `master`
- 作成: 2026-08-06T02:27:36Z / マージ: 2026-08-06T02:49:54Z
- 変更: +136 -5 (2 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/22

<details><summary>本文</summary>

選考ステータス(複数選択可)のドロップダウンを追加し、チェックした値で
受信箱一覧を絞り込めるようにした。対応ステータス・用件タグ・緊急度・
担当者・ソート・「自分の担当のみ」トグルは未実装。

あわせて stores/rooms.js の applyFilters（空実装）と filteredRooms （選考ステータス分のみ）を実装。

</details>

---

## #23 S-07: ホーム画面（学生一覧ボード）を追加し、ログイン後の着地点にする

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/S-07-home-dashboard` → `master`
- 作成: 2026-08-06T02:45:07Z / マージ: 2026-08-06T02:49:05Z
- 変更: +1844 -33 (22 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/23

<details><summary>本文</summary>

## 概要

人事のログイン後の着地点として **S-07 ホーム（`/home`）** を新設しました。
ステータスごとの列に学生カードを積んだボードで、「今日どの学生に対応すべきか」を俯瞰する画面です。
返信は従来どおり受信箱（S-03/S-04）で行い、カードクリックで `/inbox/:roomId` へ渡します。

あわせて、将来の AI 機能（P3-1a）の置き場所として右カラムのサマリーカードと右下の円形 AI ボタンを用意しました。**中身の生成はまだ未実装**で、カードは常に「準備中」を表示します。

## 主な変更

### 画面・導線
- `/home`（`HomeView`）を追加。ナビレールに「ホーム」項目を追加（受信箱と行き来できる）
- `auth.homePath` を `/inbox` → `/home` に変更。ログイン後遷移・ルーターガード・ナビレールはすべてこの getter を見ているため、変更はこの1箇所

### ボード
- 縦割りの軸を **対応／選考／緊急度** で切替可能（既定は選考）
- 0人の列も表示し、収まらない場合はボードごと横スクロール
- 列の中は常に `緊急度（高→低） → 経過時間の長い順`。**並び替え UI は持たない**
- カードは アイコン・氏名・残り2つのステータス・経過時間・新着の有無 のみ（大学名・最新メッセージは載せない）
- 新着は件数ではなく点で表現（`UnreadBadge` に `dot` バリアントを追加。受信箱側の既定は従来どおり件数）

### AI 枠（P3-1a・UI のみ）
- `AiSummaryCard`：`idle / loading / ready / error / unavailable` の5状態を描き分け済み。API を繋げば UI 変更なしで動く
- `AiLauncherButton`：右下固定の円形ボタン。パネル開閉＋未生成なら生成を要求

### ドキュメント
- `frontend.md`：S-07 を画面一覧・遷移図・§5-2（レイアウト）・§9（コンポーネント責務）に追加
- `requirements.md`：S-07 の受入条件を追加。P1-1 の着地点を S-07 へ移し、**P3-1a（AI 現況サマリー／TODO）** を新設
- `business-logic.md` §7-2：AI 要約の入出力・生成タイミング・キャッシュ・フォールバックを追記
- `api.md`：`GET/POST /api/ai/summary` と `ai:summary_updated` を予約として追記

## 受入条件（S-07）

- [x] 人事でログインすると `/home` が表示される（学生は従来どおり `/chat`）
- [x] `/home` でリロードしてもログイン画面に戻されない
- [x] 既定では選考ステータスで縦割りされ、列は選考の進行順に並ぶ
- [x] 切替ボタンで縦割りの軸を対応／選考／緊急度に変えられ、カードのチップもそれに追随する
- [x] 列の中は緊急度の高い順に並ぶ（並び替え UI は無い）
- [x] カードには アイコン・氏名・残り2つのステータス・経過時間・新着の有無 が出る
- [x] 新着は件数ではなく点で示される
- [x] カードをクリックすると該当学生のトークが `/inbox/:roomId` で開く
- [x] サイドバーからホームと受信箱を相互に行き来できる
- [x] 画面右下に AI 起動ボタン（円形）があり、右カラムに AI 現況サマリーの枠がある

## 完了の定義（workflow.md §6）

- [x] 列挙値を `shared/constants.js` から import している（文字列リテラルの直書きなし）
- [x] `v-html` を使っていない
- [x] コンポーネント内で直接 `socket.on()` していない
- [x] 状態は Pinia（`uiStore.boardGroupBy` / `roomsStore.aiSummary`）に置き、provide/inject を使っていない
- [x] 緊急度・ステータスを色だけで表現していない（必ずテキストラベル併記）
- [x] `npm run lint` / `npm run build` / `npm run test:server`（11 pass）が通る
- [x] ブラウザで動作確認済み（ログイン→着地、リロード、軸の切替、カードクリック、横スクロール、AI パネル開閉）
- [ ] サーバ側の変更なし（認可・SQL の観点は該当なし）

## ★レビュー時に見てほしい点

1. **`shared/constants.js` を変更しています**（workflow.md §4 のコンフリクト注意ファイル）。追加したのは末尾寄りの2ブロックのみです。
   - `BOARD_GROUP_BY` / `BOARD_GROUP_BY_META` / `DEFAULT_BOARD_GROUP_BY`（ホームの縦割り軸）
   - `AI_SUMMARY_STATUS` 系 / `SOCKET_ON.AI_SUMMARY_UPDATED`（P3-1a の受け皿）
2. **`src/router/index.js`** も注意ファイルですが、追加は `/home` の1エントリと `/` `catch-all` のリダイレクト先変更のみです。
3. **P1-7 との重複**：フィルタ・検索・並び替えは `roomsStore.filteredRooms / sortedRooms` が空実装のため**非活性のガワ**のままです。P1-7 実装時に `HomeFilterBar.vue` を削除して `FilterBar.vue` に寄せ、フィルタ状態を `roomsStore.filters` でホームと受信箱が共有する想定です（各ファイルの冒頭にコメントで明記）。
4. **`SummaryBar.vue`**（空スタブだったので実装）の件数は、`GET /api/summary` ではなくルーム一覧からの暫定集計です。P1-8 で `rooms.summary` に差し替えてください。
5. **未決事項 Q-3 への影響**：AI の枠を用意したことで P3-1 寄りに見えますが、今回入れたのは UI とドキュメントだけなので P3-4 を選ぶ場合も後戻りできます。

## 既知の制約

- 選考ステータスは10列あるため 1280px には収まらず、横スクロールになります（1列 204px）
- 0人の列も表示しています（パイプラインのどこが空いているかも情報のため）
- AI 要約の生成そのものは未実装（P3-1a）

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #24 P1-2: 対応ステータス（一覧から1クリックで変更）

- 状態: **merged** / 作成者: Jo042
- `feat/P1-2-handling-status` → `master`
- 作成: 2026-08-06T02:47:28Z / マージ: 2026-08-06T03:05:14Z
- 変更: +694 -373 (11 files, 6 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/24

<details><summary>本文</summary>

## 概要

P1-2「対応ステータス」を、既存の実装に足りない部分を補う形で完成させました。

着手前の状態は **「サーバは完成、UI の見た目はある、その2つが1本も繋がっていない」** でした。

| レイヤ | 着手前 |
| --- | --- |
| バックエンド | `PATCH /api/rooms/:id` と socket `room:status_update` が実装済み。ステータス更新 → 緊急度再計算 → `type='system'` のシステムメッセージ記録を1トランザクションで実行し、`message:new` / `room:updated` / `summary:updated` を配信していた |
| フロント | `roomsStore.updateHandlingStatus()` が**空実装**。UI から呼んでも何も起きない |
| フロント | ドロップダウンを持つ `RoomListItem.vue` が**どこからも import されていない**。`InboxSidebar.vue` が行を直書きしていて、そちらのチップは表示専用 |

## 変更内容

### 1. 繋ぎ込み（P1-2 本体）

- `stores/rooms.js`：`updateHandlingStatus()` を実装。楽観更新 → socket `room:status_update` → 失敗時ロールバック。未接続時は `PATCH /api/rooms/:id` にフォールバック。
- `composables/useSocket.js`：ack を待つ `emitSocketAck()` を追加。
  - 従来は `error` イベントしか無く、どのルームの失敗か特定できずロールバックできませんでした。
- `sockets/handlers/room.js`：`room:status_update` が `{ ok: true }` / `{ ok: false, code, message }` を返すように。ack がある場合は `error` イベントを重ねて投げません（トーストの二重表示防止）。

### 2. 一覧行の責務を1箇所に集約

- `HandlingStatusMenu.vue`（新規）：ステータスチップ＋ドロップダウンを切り出し。外側クリック / Escape で閉じ、一覧下端の行では上向きに開きます（`.rooms` の `overflow-y: auto` に切られるため）。`role="menu"` + `aria-checked` で読み上げにも対応。
- `RoomListItem.vue`：一覧1行の表示項目①〜⑧をすべて引き受け。
- `InboxSidebar.vue`：ヘッダ（検索・サマリー・フィルタ）と行の反復のみに縮小（-234行）。

**今後 P1-7 / P1-8 / P2-8 / P2-9 で行に項目が増えても、触るのは `RoomListItem.vue` 1ファイルで済みます。**

### 3. 不具合修正

- **システムメッセージが学生に見えていた問題**：「◯◯が対応ステータスを『対応中』に変更しました」がルーム参加者へ一律に配信され、学生のトーク画面にも表示されていました。`emitMessageNew`（配信）と `GET /rooms/:id/messages`（履歴）の両方で除外。
- **保留・完了の行でプルダウンが読めない問題**：緊急度 low の行に掛けた `opacity` が子孫のドロップダウンにも及んでいました。`opacity` は内側だけ戻せないため、その行のメニューを開いている間は行ごと不透明に戻します。

### 4. 副次的に必要だったもの

- `ToastStack.vue`（新規）：`ui.toasts` に積む口はあったのに描画先が無く、ロールバックも socket エラーも利用者に見えないままでした。`AppShell` に1つだけ配置。

## 受入条件（requirements.md P1-2）

- [x] 一覧を離れずに2クリック以内でステータスを変更できる（チップ＝開く／選択肢＝確定）
- [x] 他の人事の画面にも即座に反映される（`room:updated` を `hr` ルームへ配信）
- [x] 手動変更時は `type='system'` のシステムメッセージを記録する
- [x] 5種すべてを色で区別（`HANDLING_STATUS_META` の配色チップ＋テキストラベル併記）

## テスト計画

socket.io-client の実クライアントで通しの通信検証を行い、**11項目すべて PASS** しました。

```
PASS  socket room:status_update が ok を返す
PASS  他の人事に room:updated が届く — handlingStatus=in_progress
PASS  summary:updated が届く
PASS  人事にシステムメッセージが配信される
PASS  学生にはシステムメッセージが配信されない
PASS  人事の履歴にはシステムメッセージが含まれる / 学生の履歴には含まれない
PASS  学生からの変更は forbidden で拒否される
PASS  不正な列挙値は invalid_payload で拒否される
PASS  done へ変更すると緊急度が low になる
PASS  REST フォールバックでも変更できる
```

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:server`（既存11件）
- [x] ブラウザでの手動確認（2ブラウザ：`hr1` / `hr2`、学生：`student1`〜）

### レビュー時の手動確認手順

1. `hr1` でログイン → 行のステータスチップをクリック → 5件のドロップダウンが開く
2. 「対応中」を選ぶ → **一覧から離れずに**チップが橙へ。トーク画面にシステム行が入る
3. 「完了」を選ぶ → 行が薄くなり、経過時間バッジが消え、サマリーの「要返信」が減る
4. 「保留」「完了」の行でチップをクリック → **選択肢が薄くならず読める**
5. **一覧の一番下の行**でも選択肢が切れずに見える（上向きに開く）
6. 別ブラウザの `hr2` で **リロードなしに**同じ色へ変わり、並び順とサマリーも更新される
7. 学生アカウントのトーク画面には**システムメッセージが現れない**（リロード後も）
8. F5 リロードしても変更したステータスが保持されている

## 対象外

`roomsStore` の `fetchSummary` / `applyFilters` / `sortedRooms` / メモ系は空実装のままです。それぞれ P1-7 / P1-8 / P2-5 の担当範囲のため、本 PR では触っていません。

## 共有ファイルの変更

`shared/constants.js` と `server/db/schema.sql` は**変更していません**（workflow.md §4）。`eslint.config.js` に `document` / `window` のグローバル宣言を追加しています。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #25 feat: implement room sorting

- 状態: **merged** / 作成者: hinato150
- `feat/sort` → `master`
- 作成: 2026-08-06T03:27:31Z / マージ: 2026-08-06T03:59:29Z
- 変更: +102 -17 (2 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/25

<details><summary>本文</summary>

## 変更内容

- 受信箱のルーム一覧に、既定順・最終メッセージ順・経過時間順のソートを実装
- サイドバーから並び順を切り替えられるように変更
- 日時がないルームは各ソートで末尾に置き、同順位はルームIDで安定化
- 不正なソートキーを無視するように対応

## 目的

サーバーから受け取った順序に依存せず、Pinia上の状態を基準に受信箱の優先順位を即時に切り替えられるようにします。

## 確認

- `npm run lint`
- `npm run build`
- Piniaストアを使った既定順・最終メッセージ順・経過時間順の動作確認

</details>

---

## #26 feat(P2-4/P2-5): 詳細ペインの申し送りメモ・プロフィール編集を実装

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P2-4-P2-5-inbox-detail-panel` → `master`
- 作成: 2026-08-06T03:53:38Z / マージ: 2026-08-06T04:08:14Z
- 変更: +1671 -139 (19 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/26

<details><summary>本文</summary>

## 概要

受信箱の詳細ペイン（`/inbox/:roomId` の右カード）が見た目だけの状態だったので、実際に読み書きできるようにしました。課題 **C-4「担当者不在だと引き継げない」** への回答です。

1. **P2-5 / P2-6 申し送りメモ** — 個人／共有タブ、追加・編集・削除、共有への1クリック昇格
2. **P2-4 / P2-9 プロフィールのインライン編集** — 担当人事・選考ステータス・次回面接・会議室・担当面接官
3. **受信箱3ペインの幅をドラッグで変更**（要件外・UX 改善）

> ⚠️ `workflow.md` の「1ブランチ＝1要件」に反して3件をまとめています。`InboxDetailPane.vue` / `stores/rooms.js` / `stores/ui.js` を3件とも触るため、分割するとコンフリクトのほうが高くつくと判断しました。分けたほうがよければ言ってください。

## 変更点

### バックエンド

| エンドポイント | 状態 |
| --- | --- |
| `GET/POST /api/rooms/:id/memos`、`PATCH/DELETE /api/memos/:id` | 新規（空の Router だった） |
| `GET/PATCH /api/students/:userId` | 新規（同上） |
| `GET /api/users?role=hr&role=admin` | 新規（同上） |
| `PATCH /api/rooms/:id` | `assigneeUserId` を受け付けるよう拡張 |

- `services/memos.js` `services/studentProfile.js` を新設し、ロジックをハンドラに直書きしない
- 共有メモの追加・更新は `memo:updated`、プロフィール・担当者の変更は `room:updated` ＋ `summary:updated` を配信
- **認可は二段構え**：`room_members` の確認に加えて**人事ロールの検証**。学生も自室の `room_members` に含まれるので、これが無いと自分に関する申し送りメモを読めてしまう
- `PATCH/DELETE /memos/:id` は作成者本人のみ。対象ルームはクライアントの値ではなく `memos.room_id` から引いて検証

### フロントエンド

- `MemoPanel.vue` / `ProfilePanel.vue` を実装（どちらも TODO の空コンポーネントだった）
- `PaneResizer.vue` を新設。ペイン間の隙間（12px）をそのままつまみにしているので**見た目は変わりません**
- `stores/rooms.js` の空実装（メモ4種・`assign`・`updateStudent`・`fetchAssignableUsers`）を実装

## 受入条件

**P2-5 申し送りメモ**
- [x] 人事Aが共有メモを書くと、人事Bの画面にリロードなしで表示される
- [x] 個人メモは作成者以外には返らない

**P2-6 メモの共有昇格**
- [x] 個人メモを1クリックで `scope='shared'` に変更できる

**P2-4 学生プロフィールパネル**
- [x] 担当外の人事がルームを開いても、その学生の状況が1画面で把握できる
- [x] 各項目インライン編集可能

**P2-9 担当者アサイン表示**
- [x] 一覧に担当者名を表示、未アサインは警告色（詳細ペイン側でも警告色＋「未割当」）

## 完了の定義（workflow.md §6）

- [x] 列挙値を `shared/constants.js` から import している
- [x] サーバ側で認可チェック（`room_members` の確認）を行っている
- [x] SQL がプレースホルダになっている（`studentProfile.js` のカラム名はホワイトリスト経由でのみ組み立て、値は常にプレースホルダ）
- [x] `v-html` を使っていない
- [x] Socket イベントのハンドラが `useSocket.js` に集約されている（新規の `socket.on` は追加なし）
- [x] `npm run lint` / `npm run test:server`（11件）/ `npm run build` が通る
- [x] リロードしても壊れない
- [ ] **2ブラウザでの動作確認** — 人事Aをブラウザ、人事Bを API 経由にしてリアルタイム反映を確認しました。2ブラウザ同時での確認は未実施です

## 確認した挙動

- メモの作成・編集・削除・共有昇格、プロフィール5項目の編集がいずれも保存され、**受信箱の行・チャットヘッダ・詳細チップまでリロードなしで追随**
- 別の人事の変更が `memo:updated` / `room:updated` で即座に反映される
- 不正値（存在しない選考ステータス、パースできない日時、学生IDを担当人事に指定、未知のキー）はすべて 400、学生ロールは 403
- ペイン幅はトークペインに最低360px残る位置で自動的に止まり、横スクロールは発生しない

## レビューで見てほしい点・積み残し

- `PATCH /memos/:id` は **`shared → private` の降格を 403 で拒否**しています。配信済みの内容を相手の画面から消す手段が無いためですが、仕様として妥当か確認してください
- **メモ削除のリアルタイム配信はしていません**（`api.md` に `memo:deleted` の定義が無いため）。他の人事の画面には次回取得時に反映されます
- 次回面接が未設定のとき `datetime-local` の空表示が `----/--/-- --:--` になり、他項目の「未設定」と見た目が揃いません
- ペイン幅は Pinia 保持なのでリロードで既定値に戻ります（`localStorage` 保存は前例が無いため見送り）
- ついでに [`ChatPanel.vue`](https://github.com/rkclhack/hackathon-t1-A/blob/feat/P2-4-P2-5-inbox-detail-panel/chatapp/src/components/ChatPanel.vue) の送信者名の解決を修正しました。担当人事を外すと過去のその人の吹き出しから名前が消えていたため、人事の名簿から解決するようにしています
- `seed.js` にメモのデモデータは入れていません（共有ファイルのため）。デモで見せるなら別 PR で追加します

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #27 P1-7: 受信箱のフィルタ・ソート・検索を動くようにする

- 状態: **merged** / 作成者: Jo042
- `feat/P1-7-inbox-filter-sort` → `master`
- 作成: 2026-08-06T04:02:59Z / マージ: 2026-08-06T04:40:57Z
- 変更: +504 -254 (8 files, 6 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/27

<details><summary>本文</summary>

## 問題

受信箱でフィルタを押しても何も起きない状態でした。

`FilterBar.vue`（#22 で選考ステータス分が実装済み）が**どこからも import されておらず**、受信箱に表示されていたのは `InboxSidebar.vue` に直書きされた `disabled` なダミーボタン5個でした。

```js
// InboxSidebar.vue（変更前）
const FILTER_LABELS = ["対応", "選考", "タグ", "緊急度", "担当"]
```
```html
<button v-for="label in FILTER_LABELS" class="filters__chip" disabled>{{ label }} ▾</button>
```

ストア側も `filteredRooms` が選考ステータスのみ、`hasActiveFilters` / `clearFilters` / `toggleOnlyMine` が空実装でした。

## 変更内容

### 1. `stores/rooms.js` — 絞り込みの判定

`filterRooms` を全条件へ拡張しました（#25 の関数構成をそのまま使っています）。

| 条件 | 対応 |
| --- | --- |
| 対応ステータス | 複数選択 |
| 選考ステータス | 複数選択（#22 実装済み） |
| 用件タグ | 複数選択。未発言のルームは `other` 扱い |
| 緊急度 | 複数選択 |
| 担当者 | 単一選択（指定なし / 未割当 / 各担当者） |
| 自分の担当のみ | トグル。担当者指定とは排他 |
| 24h超 | `overdueOnly`（P1-8 から使う想定。まだ設定箇所なし） |
| 氏名・大学 | 部分一致（大文字小文字を無視、前後の空白は無視） |

あわせて空実装だった `hasActiveFilters` / `clearFilters` / `toggleOnlyMine` / `totalUnread` と、チェックボックス用の `toggleFilterValue` を実装。`filters` の初期値は `initialFilters()` に一本化し、state と `clearFilters` / `hasActiveFilters` が同じ定義を見るようにしました。

担当者の候補は `assigneeOptions` getter が返します。正は `GET /api/users?role=hr`（#26 で実装済み）で、まだ取得できていない間だけ一覧に出ている担当者から導出してフィルタが空にならないようにしています。

### 2. `FilterBar.vue` — UI

- 対応 / 選考 / タグ / 緊急度 … 複数選択（選択件数を「対応(2)」と表示）
- 担当者 … 単一選択
- 「自分の担当のみ」トグル、「条件をクリア」、ソート切替
- 定義を `MULTI_FILTERS` に集約したので、**1行足せば絞り込みが1種類増えます**

### 3. `InboxSidebar.vue` — 配線

- ダミーのチップを `<FilterBar />` に置き換え
- 非活性だった検索欄を `filters.q` に接続
- 絞り込み中は「**5 / 10件**」と表示し、隠れている行があることが分かるように
- 空状態を「条件に一致する学生はいません（＋クリアボタン）」と「対応が必要な学生はいません 🎉」で区別

### 4. ホーム画面（S-07）も同様に

`HomeFilterBar.vue` と `StudentBoard.vue` に残っていた指示コメントに従いました。

> `HomeFilterBar.vue`: P1-7 で FilterBar.vue に実装が入ったら、このファイルは削除して FilterBar.vue をホームでも使い回すこと
> `StudentBoard.vue`: ★P1-7 で roomsStore.sortedRooms（フィルタ適用済み）が入ったら、rooms.rooms ではなくそちらを入力にすること

`HomeFilterBar.vue` を削除して `FilterBar.vue` に統一し、`StudentBoard` の入力を `sortedRooms` へ、非活性だった検索欄を接続しました。絞り込み条件は `roomsStore.filters` で受信箱と共有されます。

### 5. リファクタ

`HandlingStatusMenu`（P1-2）と `FilterBar` で同じ「外側クリック・Escape で閉じる」処理が必要になったため `composables/useDismissOnOutside.js` に抽出しました。挙動は変えていません。

## #25 のソート実装との統合

作業中に #25（feat: implement room sorting）がマージされ、`sortedRooms` / `setSortKey` が重複しました。**#25 の関数構成（`timestampOf` / `byDefaultPriority` / `byLastMessage` / `byElapsedTime` / `filterRooms`）を採用**し、こちらの自前の比較関数は捨てています。

統合の際に `byLastMessage` の不具合を1件修正しました。

```js
// 変更前：欠損日時は +Infinity なので、降順の引き算だと
// 最終メッセージが無いルームが先頭に来ていた（#25 本文の「末尾に置く」と逆）
const recency = timestampOf(right...) - timestampOf(left...)

// 変更後：欠損かどうかを先に判定する
const missing = Number(leftAt === Infinity) - Number(rightAt === Infinity)
if (missing !== 0) return missing
```

ソートの `<select>` は #25 が `InboxSidebar` に置いていましたが、`FilterBar` はホームでも使い回すため FilterBar 側へ寄せ、#25 のピル型スタイルと `aria-label` を取り込んでいます。

## 受入条件（requirements.md P1-7）

- [x] 対応ステータス／選考ステータス／用件タグ／緊急度／担当者で絞り込める
- [x] デフォルトソートは `ピン留め → 緊急度 → 経過時間（長い順）`
- [x] 「自分の担当のみ」トグルがある
- [x] 「要返信 かつ 緊急」で絞ると該当学生のみ表示される
- [x] 条件をクリアすると全件に戻る
- [x] フィルタ条件とソート条件は Pinia に保持され、ルーム切替で失われない

## テスト計画

シードデータを投入した実 API のレスポンスに対して、ストアの getter を Node 上で直接検証しました（**26/26 PASS**）。

```
PASS  ピン留めが先頭 — 小林 蓮, 田中 太郎
PASS  ピン留めの後は緊急度の高い順 — 0 0 0 1 1 1 2 2 2
PASS  同じ緊急度なら経過時間が長い順 — 26 15 13
PASS  「要返信 かつ 緊急」で絞ると該当学生のみ — 田中 太郎, 高橋 美咲, 佐藤 花子
PASS  条件をクリアすると全件に戻る
PASS  未割当のみで絞れる — 鈴木 一郎
PASS  候補は未取得なら一覧から導出 / 取得済みなら GET /api/users を使う
PASS  「自分の担当のみ」で絞れる — 田中 太郎, 中村 陽菜, 伊藤 健太
PASS  氏名の部分一致で絞れる / 空白だけの検索は絞り込まない
PASS  経過時間順（長い順）に並ぶ — 200 100 76 26 15 13 5 2 1 0.5
PASS  最終メッセージ順（新しい順）に並ぶ
PASS  最終メッセージが無いルームは末尾（降順）   ← #25 から修正した箇所
PASS  学生メッセージが無いルームは末尾（昇順）
PASS  sortedRooms が rooms を破壊的に並べ替えない
PASS  絞り込みと並べ替えを併用できる          … 他12件
```

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:server`（既存11件）
- [ ] ブラウザでの手動確認

### レビュー時の手動確認手順

1. `/inbox` で「対応 ▾」→「要返信」、「緊急度 ▾」→「緊急」をチェック → 該当学生のみ残り、見出しが「3 / 10件」になる
2. 「条件をクリア」で全件に戻る
3. 検索欄に「山」と入力 → 氏名・大学に含まれる行だけ残る
4. 「担当 ▾」→「未割当」→ 鈴木 一郎のみ／「自分の担当のみ」→ 自分の担当だけ
5. ソートを「経過時間順」に変更 → 経過時間の長い順に並び替わる
6. 該当ゼロまで絞る → 「条件に一致する学生はいません」＋クリアボタンが出る
7. ドロップダウンを開いたまま別の場所をクリック / Esc で閉じる
8. `/`（ホーム）でも同じフィルタが効き、受信箱に戻っても条件が保持されている

## 対象外

P1-8（サマリーバーのクリックでフィルタ適用、`GET /api/summary` への切り替え）は範囲外です。`filters.overdueOnly` は P1-8 から使う想定で実装済みですが、まだどこからも設定していません。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #28 担当の学生のみを表示

- 状態: **merged** / 作成者: takahasinoa114
- `only-my-students` → `master`
- 作成: 2026-08-06T04:42:11Z / マージ: 2026-08-06T05:15:06Z
- 変更: +42 -149 (6 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/28

<details><summary>本文</summary>

受信箱の担当者ソート機能を削除
ログインした人事が担当している学生のみを学生リストに表示

</details>

---

## #29 P1-8: 未対応サマリーを押してフィルタできるようにする

- 状態: **merged** / 作成者: Jo042
- `feat/P1-8-summary-bar` → `master`
- 作成: 2026-08-06T04:49:33Z / マージ: 2026-08-06T04:59:16Z
- 変更: +141 -127 (2 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/29

<details><summary>本文</summary>

## 概要

受信箱の上にある「要返信 5 / 緊急 3 / 24h超 2」を、**押せるボタン**にして配色を整えました。

`SummaryBar.vue` に前提つきの TODO が残っていました。

> ★クリックでのフィルタ適用も P1-8 の範囲。roomsStore.filteredRooms が空実装のため、
> 今は押しても絞り込めない。誤操作を招かないようボタンにせず表示だけにしてある。
> （InboxSidebar にも同じ暫定集計がある。P1-8 でどちらもこのコンポーネントへ寄せる）

#27（P1-7）で `filteredRooms` が動くようになり、この前提が解けたので実装しました。

## 変更内容

### 1. 押すとフィルタが掛かる

各項目を `<button>` にし、押すと**その条件だけを入り切り**します。他の絞り込みは残るので、「要返信」と「緊急」を両方押せば AND で絞り込めます（P1-7 の受入条件と同じ組み合わせ）。

| 項目 | 適用する条件 |
| --- | --- |
| 緊急 | `urgency: ['high']` |
| 要返信 | `handlingStatus: ['needs_reply']` |
| 24h超 | `overdueOnly: true` |

`overdueOnly` は #27 で `filterRooms` に実装済みでしたが設定箇所がありませんでした。ここが最初の利用側になります。

### 2. 配色と状態

- 絞り込み中は**塗りに反転**（枠線＋淡色 → ベタ塗り＋白文字＋影）。押されていることが一目で分かります
- `hover` … 背景を濃く／`active` … 1px 沈む／`focus-visible` … トーン色のアウトライン
- 色は `--tone` / `--tone-on` の2変数に集約し、トーンごとの分岐を1行に。項目を足すときは `--tone` を1つ足すだけです

```css
.summary__item--alert { --tone: var(--color-sla-alert); }   /* 緊急・24h超 */
.summary__item--warn  { --tone: var(--color-primary); }     /* 要返信 */
.summary__item--empty { --tone: var(--color-ink-mute); }    /* 0件は主張させない */
```

**色だけで伝えない**ため（CLAUDE.md §6-13）、`aria-pressed` と `title`（「要返信の絞り込みを解除する」）でも状態を伝えます。

### 3. 重複の解消

`InboxSidebar.vue` が同じ集計を直書きしていたので `<SummaryBar />` に置き換えました（`SummaryBar` のコメントにある「P1-8 でどちらもこのコンポーネントへ寄せる」）。ホーム（S-07）でも同じコンポーネントを使っているので、**ホームのサマリーも同時に押せるようになります**。

`InboxSidebar` の責務は検索欄・配置・行の反復だけになりました。

## 件数の情報源について

**絞り込み前の全件**を数えています。絞り込むたびに未対応件数が減ると「あと何件対応が残っているか」という本来の役割が壊れるためです。

情報源は引き続きルーム一覧からの集計です（`fetchSummary` / `setSummary` は空実装のまま）。`GET /api/summary` への切り替えは見送りました。

- 集計結果が `GET /api/summary` と**完全に一致する**ことを確認済み（下記）
- `message:new` / `room:updated` で `rooms` が更新されるため、**リロードせず件数が増える**（P1-8 の受入条件を満たす）
- サーバ側の `getSummary` は `FROM rooms` で全ルームを数えており、閲覧者の所属ルームで絞っていない。現状は人事全員が全ルームのメンバーなので同じ結果になりますが、将来ずれる可能性があります

`summary:updated` を受けても `setSummary` が空実装で何も起きない点は残っています（`useSocket.js` から呼ばれています）。切り替えるかどうかは上記のスコープ差もあるのでチームで判断したく、この PR では触っていません。

## 受入条件（requirements.md P1-8）

- [x] 画面上部に「要返信 N件・緊急 N件・24h超 N件」を常時表示
- [x] 各項目クリックでフィルタ適用
- [x] 学生からメッセージが届くと、リロードせず件数が増える

## テスト計画

シードデータを投入した実 API のレスポンスに対し、サマリーが適用する条件をストア側で検証しました（**12/12 PASS**）。

```
一覧からの集計: {"urgent":3,"needsReply":5,"overdue24h":2}
GET /api/summary : {"needsReply":5,"urgent":3,"overdue24h":2,"unassigned":1}

PASS  集計がサーバの GET /api/summary と一致する
PASS  要返信を押すと要返信だけが残る — 5件
PASS  もう一度押すと解除される
PASS  要返信と緊急を重ねると AND で絞れる — 田中 太郎, 高橋 美咲, 佐藤 花子
PASS  片方だけ解除すると他方は残る — 5件
PASS  24h超を押すと24h超だけが残る — 2件 — 田中 太郎, 中村 陽菜
PASS  24h超は返信待ち・完了を含まない
PASS  24h超は hasActiveFilters を立てる
PASS  24h超をもう一度押すと解除される
PASS  条件をクリアするとサマリーの絞り込みも解除される
PASS  絞り込んでもサマリーの件数は減らない
```

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:server`（既存11件）
- [ ] ブラウザでの手動確認

### レビュー時の手動確認手順

1. `/inbox` を開く → サマリーが「緊急 3件（赤）／要返信 5件（オレンジ）／24h超 2件（赤）」で並ぶ
2. 「要返信」を押す → **塗りに反転**し、一覧が5件に。見出しが「5 / 10件」になる
3. 続けて「緊急」を押す → 両方が反転し、3件（田中 太郎・高橋 美咲・佐藤 花子）に
4. 「緊急」をもう一度押す → 緊急だけ解除され、要返信の5件に戻る
5. 「24h超」を押す → 2件（田中 太郎・中村 陽菜）。返信待ち・完了の学生は含まれない
6. FilterBar の「条件をクリア」→ サマリーの反転もすべて解除される
7. キーボードの Tab で移動でき、フォーカス枠が出る
8. `/`（ホーム）のサマリーでも同じように押せる
9. 別ブラウザの学生からメッセージを送る → リロードせず件数が増える

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #30 refactor(P1-1/P1-2/P1-4): 受信箱の一覧カードを整理し、ピン留め（P2-8）を削除

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P1-1-inbox-card-redesign` → `master`
- 作成: 2026-08-06T05:03:07Z / マージ: 2026-08-06T05:04:16Z
- 変更: +205 -505 (23 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/30

<details><summary>本文</summary>

## 目的

受信箱の左カードに項目が集まりすぎて可視性が落ちていたため、表示要素を減らしてレイアウトを組み直しました。あわせて、使わない方針になったピン留め（P2-8）を削除しています。

判断基準は「人事が受信箱を上から処理するだけで対応漏れがゼロになるか」。1行あたりの情報量を減らし、緊急の行だけが浮くようにしています。

## 変更内容

### 1. 一覧カードを3段に固定（P1-1）

| 段 | 内容 |
| --- | --- |
| 1段目 | 氏名／対応ステータスチップ（表示のみ）／最終メッセージ時刻 |
| 2段目 | 最終メッセージ抜粋／経過時間バッジ／未読数バッジ |
| 3段目 | 選考ステータス／用件タグ（チップにせず小さな文字で） |

- **大学名・担当人事を一覧から外した**（右ペインの `ProfilePanel` で見る）
- フッタに最大5個のピルが折り返していた状態を解消

### 2. 緊急度は行の面の着色だけで表す（P1-6）

- 緊急度チップと `UrgencyBar`（左端の縦バー）を廃止し、high の行の背景を淡い警告色にする
- 面の色は読み上げに乗らないため、ラベルは `sr-only` で残す（CLAUDE.md §6-13）
- 選択中の行（オレンジ）は緊急の面より優先されるので、選択位置は見失わない

### 3. 対応ステータスの変更口を右ペインへ移動（P1-2）

- `ProfilePanel` の先頭に「対応ステータス」欄を追加。他の項目と同じインライン編集の select
- 一覧行のチップは表示専用になり、`HandlingStatusMenu` と `ui.statusMenuRoomId` を削除
- 更新経路は従来どおり `rooms.updateHandlingStatus()`（socket 優先・楽観更新・失敗時ロールバック）

### 4. 経過時間を h 表記に統一（P1-4）

- `3分` / `2時間` / `1日3時間` → `<1m` / `45m` / `26h`
- **1日を超えても日に繰り上げない。** SLA 閾値（12h / 24h）と同じ単位のまま並ぶので、超過幅を直接比較できる
- ホームの `StudentCard` も同じバッジを使うため表記が揃う

### 5. ピン留め（P2-8）を削除

- UI（一覧・ホームカードの 📌）、既定ソートの第1キー、`togglePin()`、API の `isPinned`
- **`rooms.is_pinned` 列と `idx_rooms_sort` インデックスも削除**（`schema.sql` / `seed.js`）
- 既定ソートは `緊急度 → 経過時間（長い順）` の2段になる

### 6. 仕様書の更新

`requirements.md`（P2-8 の節・優先度表・P1-7 のソート記述）／`business-logic.md` §3・§6／`api.md`／`database.md`／`frontend.md`（一覧行の項目表を今回の3段に書き直し）／`workflow.md`

## ⚠️ マージ後に必要な作業

`server/db/schema.sql` を変更しているため、**マージ後は各自 DB を作り直してください。**

```bash
rm -f data/app.db data/app.db-wal data/app.db-shm && npm run db:migrate && npm run db:seed
```

CLAUDE.md §8 では共有ファイルの変更は単独 PR にする決まりですが、今回は UI 整理とまとめて1本にしています。分けた方がよければ言ってください。

## 確認したこと

- [x] `npm run lint` が通る
- [x] `npm run build` が通る
- [x] `db:migrate` → `db:seed` が通り、`PRAGMA table_info(rooms)` に `is_pinned` が無い
- [x] API レスポンスから `isPinned` が消えている
- [x] 一覧の先頭が緊急・経過時間の長いルームになる（ピン留めが最上位に来ない）
- [x] 右ペインでステータスを変更すると、一覧のチップ・サマリーバーの件数・トーク画面のシステムメッセージが連動する
- [x] 列挙値は `shared/constants.js` から import している
- [x] ホーム画面（`StudentCard`）が壊れていない

## 補足

一覧のチップが表示専用になったぶん、**一覧を眺めながら次々にステータスを捌く操作は1テンポ増えます**（学生を選んでから右ペインで変更）。受信箱は3ペインが同一画面なので P1-2 の受入条件「一覧を離れず2クリック以内」は満たしていますが、一覧から直接捌く動線も残したい場合は別途相談させてください。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #31 P2-1定型文コマンド作成

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/teikei` → `master`
- 作成: 2026-08-06T05:11:51Z / マージ: 2026-08-06T05:15:45Z
- 変更: +231 -18 (4 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/31

<details><summary>本文</summary>

入力欄で/を入力すると定型文が選択できるというコマンドを作成した

</details>

---

## #32 chore(A-1): シードの学生を40名に増やし、人事1人あたり12名担当にする

- 状態: **merged** / 作成者: Jo042
- `chore/A-1-seed-more-students` → `master`
- 作成: 2026-08-06T05:43:05Z / マージ: 2026-08-06T05:47:22Z
- 変更: +464 -122 (3 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/32

<details><summary>本文</summary>

## 目的

受信箱が担当制になった（#28）ことで、`myRooms`（`assignee.id === 自分`）に該当しないルームは一覧に出なくなった。
現行シードは学生10名／人事3名で **1人あたり3名**しかなく、コンセプトの一文

> 「返信すべき学生が、上から順に並んでいる」

が成立しているかをデモで確認できない。担当学生数を増やして、受信箱・ホームのボード・サマリー・フィルタが「量」のある状態で機能するようにする。

## 変更内容

### 1. シードの規模を拡大（`server/db/seed.js`）

| | Before | After |
| --- | --- | --- |
| 学生 | 10名 | **40名** |
| hr1 / hr2 / admin1 の担当 | 各3名 | **各12名** |
| 未割当 | 1名 | 4名 |
| メッセージ | 80件 | 326件 |
| `next_interview_at` 等の面接情報 | 全件未設定 | 7名に設定 |

- **`student1`〜`student10`（手書きシナリオ）は内容を1文字も変えていない。** デモの筋書きと、既存の受入確認手順を壊さないため。
- `student11`〜`student40` は12種のシナリオテンプレート（欠席・遅刻／日程調整／合否待ち／適性検査／質問／保留 など）× 氏名・大学・学部・卒業年・経過時間のバリエーションで生成する。
- 生成は **mulberry32 の固定シード**（`RANDOM_SEED`）なので、何度 `db:seed` しても同じ内容になる。各自のローカルで同じ画面が見える。
- 担当の割り当ては手書き分の既存人数を差し引いて不足分を配る方式にした。`STUDENTS_PER_HR` / `UNASSIGNED_COUNT` を書き換えれば規模だけ変わり、手書き分を足してもバランスが崩れない。
- 生成分には `next_interview_at` / `interviewer` / `next_interview_room` / `schedule_state` も入れた。従来は全件 NULL で ProfilePanel（P2-4）が空だった。

### 2. `seed.js` 冒頭コメントの積み残しを解消（同ファイル）

このファイルの冒頭に「本実装ができたら複製を消して置き換えること」と書かれたまま残っていたもの。

- シード内に複製していた `classifyTag` / `calculateUrgency` を削除し、`services/tagClassifier.js` / `services/urgencyCalculator.js` を使うようにした。`business-logic.md` のルールが二重管理でなくなる。用件タグ判定が `tag_rules` を読むため、投入順を学生より前に移動している。
- 学生ごとに呼んでいた `bcrypt.hashSync` を1回に集約（40回 → 1回）。

### 3. ドキュメント反映

- `README.md`：ログインIDが `student1`〜`student40` になったこと、担当の内訳、手書き分と生成分の違い、固定シードで再現することを追記。
- `CLAUDE.md` §5：`db:seed` の件数を実態に合わせた。

## 投入後の分布

```
       high  normal  low     ← 全員に「上から処理する」対象が5〜6件ある
hr1      5     4      3
hr2      6     3      3
admin1   5     3      4
未割当    0     2      2
```

- 対応ステータス：要返信19／対応中9／返信待ち6／完了3／保留3
- 用件タグ：質問8／その他8／日程調整6／合否待ち6／適性検査6／欠席遅刻6

## 動作確認

```bash
npm run db:migrate
npm run db:seed     # 既存データは全削除される
```

`data/app.db` を削除したうえで migrate → seed を実行し、上記の件数になることを確認済み。
**すでに `npm run dev:server` を起動している場合は、DB を作り直したあとサーバの再起動が必要。**

- [x] `npm run lint` が通る
- [x] `npm run test:server` が通る（11 pass）
- [x] `db:seed` を2回実行し、生成される学生データが同一（SHA1 一致）であることを確認
- [x] 用件タグが意図どおりに判定されることを確認（各シナリオの最終学生メッセージ）
- [ ] **2ブラウザ（人事・学生）での動作確認は未実施。** レビュー時に hr1 / hr2 / admin1 でログインし、受信箱に12件ずつ並ぶことを見てほしい

## Definition of Done（workflow.md §6）

- [x] 列挙値を `shared/constants.js` から import している（`SELECTION_STATUS` / `SCHEDULE_STATE` の直書きも解消した）
- [x] SQL がプレースホルダになっている
- [x] `npm run lint` が通る
- [ ] 2ブラウザでの動作確認（上記のとおり未実施）
- N/A サーバ側の認可チェック / `v-html` / `useSocket.js` への集約 … シード投入スクリプトのみの変更で該当なし

## レビューしてほしい点

1. **1人あたり12名という規模が妥当か。** 多すぎ／少なすぎなら `STUDENTS_PER_HR` の1行で変えられる。
2. **未割当4名の扱い。** `myRooms` の仕様上どの人事の受信箱にも出ないため、現状はどの画面からも見えない（`stores/rooms.js` のコメントは「拾い上げは別の全学生管理画面が担う想定」としているが、その画面はまだ無い）。ダッシュボードのネタとして残すか、0件にするか判断したい。
3. `seed.js` は `workflow.md` §4 の「コンフリクトしやすい共有ファイル」。他に手を入れている人がいれば先にマージしてほしい。

</details>

---

## #33 定型文の設定画面追加

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/teikei` → `master`
- 作成: 2026-08-06T05:44:26Z / マージ: 2026-08-06T05:46:26Z
- 変更: +745 -43 (8 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/33

<details><summary>本文</summary>

設定画面追加
削除・保存・編集の動作確認済み
チャットにコマンドの変更が反映されることも確認済み

</details>

---

## #34 feat(P2-1): 入力欄を本文に追従して拡大させる（長文の視認性改善）

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P2-1-composer-autogrow` → `master`
- 作成: 2026-08-06T05:48:57Z / マージ: 2026-08-06T05:51:01Z
- 変更: +341 -7 (5 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/34

<details><summary>本文</summary>

## 背景

定型文コマンド（P2-1／P2-2）で本文を展開すると、入力欄が3行固定のため全文が見えず視認性が落ちていた。課題 C-3「コピペ2〜3分を数秒に」は展開後に**中身を確認して送れる**ところまで含む、という判断で入力欄の高さを可変にした。

## 変更内容

| ファイル | 内容 |
| --- | --- |
| `src/composables/useComposerHeight.js`（新規） | 本文の行数から高さを算出。下限3行（76px）／上限 `min(420px, 画面高の50%)`、超えたら入力欄内でスクロール。ペイン幅・ウィンドウサイズの変化にも追従（`ResizeObserver` / `resize`） |
| `src/components/ComposerResizeHandle.vue`（新規） | 入力欄上辺のつまみ。ドラッグで高さを固定、**ダブルクリックで本文追従に戻る**。`role="separator"` ＋ ↑↓キー（1回＝1行）にも対応 |
| `src/components/ChatPanel.vue` | 人事側トークペインに適用 |
| `src/views/ChatView.vue` | 学生側トーク画面に適用 |
| `src/components/MessageList.vue` | 入力欄が伸びて一覧が縮んだとき、最下部を見ていたなら最下部に留める（これが無いと最新メッセージが隠れる） |

つまみは既存の `PaneResizer.vue` と同じ作り（Pointer Events ＋ `setPointerCapture`、`role="separator"` ＋ キーボード操作）に揃えている。高さは画面をまたいで共有する状態ではないためコンポーネントローカルに保持し、`ui.js` は変更していない。

## 受入条件（P2-1 / P2-2）

- [x] `/合` と入力すると候補が絞られ、Enter で本文が入力欄に展開される（既存動作の維持を確認）
- [x] `/面接前日リマインド` を展開すると**全文が見える**（244px に拡大）

## 動作確認（localhost・実ブラウザ）

| 操作 | 結果 |
| --- | --- |
| `/面接前日リマインド` を展開（10行） | 244px に拡大、全文が見える |
| 40行を入力 | 360px（＝50vh）で止まり中でスクロール、履歴は上に残る |
| つまみを下へ 160px ドラッグ | 360 → 200px に固定 |
| つまみを上へ大きくドラッグ | 上限 360px でクランプ |
| ↓×5 ／ ↑×3 | 360 → 240 → 312px（24px 刻み） |
| つまみをダブルクリック | 本文追従に復帰（空なら 76px＝3行） |
| 一覧ペインの幅を変更 | 折り返し行数に合わせて測り直し |
| 学生側 `/chat` で9行入力 | 拡大し、最新メッセージも隠れない |

## Definition of Done

- [x] `npm run lint` が通る
- [x] 人事・学生の両画面で動作確認した
- [x] リロードしても壊れない
- [x] 列挙値の直書きなし（寸法のみ扱うため `shared/constants.js` は変更なし）
- [x] `v-html` を使っていない
- [x] Socket ハンドラを追加していない（`useSocket.js` 変更なし）
- [x] 共有ファイル（`shared/constants.js` / `schema.sql` / `seed.js` / `sockets/index.js` / `router`）は未変更
- [x] サーバ側の変更なし（認可・SQL に影響なし）

## 補足

申し送りメモ（`MemoPanel.vue`）の入力欄は本 PR のスコープ外。同じ composable を当てられるので、必要なら別 PR で対応する。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #35 feat(S-07/P1-7): ホームの縦割り既定を対応ステータスに、受信箱の既定ソートを最終メッセージ順にする

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/S-07-default-board-and-sort` → `master`
- 作成: 2026-08-06T06:00:29Z / マージ: 2026-08-06T06:01:39Z
- 変更: +19 -17 (8 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/35

<details><summary>本文</summary>

## 概要

ログイン後のホーム（S-07）と受信箱（P1-7）の**既定値**を変更します。UI の切替は従来どおり残っているので、選考軸・緊急度順へはワンクリックで戻せます。

| 対象 | Before | After |
| --- | --- | --- |
| ホームの縦割り軸 | 選考ステータス | **対応ステータス**（要返信 → 対応中 → 返信待ち → 完了 → 保留） |
| 受信箱のソート | 緊急度順 | **最終メッセージ順** |

## 変更内容

- `shared/constants.js`：`DEFAULT_BOARD_GROUP_BY` → `BOARD_GROUP_BY.HANDLING`、`DEFAULT_SORT_KEY` → `SORT_KEY.LAST_MESSAGE`
- `server/routes/rooms.js`：`GET /api/rooms` の `sort` 未指定時の既定を `SORT_KEY.DEFAULT` 直書きから `DEFAULT_SORT_KEY` 参照に変更（クライアントと既定がズレないように）
- `src/components/StudentBoard.vue`：不正値時のフォールバック軸を `BOARD_GROUP_BY.SELECTION` 決め打ちから `DEFAULT_BOARD_GROUP_BY` 参照に変更
- `.claude/requirements.md` / `frontend.md` / `business-logic.md`：既定値の記述を実装に合わせて更新

## ★レビューして欲しい点

1. **`shared/constants.js` を触っています**（workflow.md §4 のコンフリクト注意ファイル）。定数の追加・削除はなく、既定値2行の変更のみです。
2. **仕様ドキュメントの受入条件を書き換えています。** 元の S-07 は「既定は選考ステータス」、P1-7 は「デフォルトソートは緊急度 → 経過時間」と定義されていました。今回の変更はこれと矛盾するため、実装に合わせてドキュメント側も更新しています。**この方針変更自体にチームの合意が必要です。**

## 受入条件の確認

S-07
- [x] 人事でログインすると `/home` が表示される
- [x] 既定で対応ステータスの縦割りになる（変更後の条件）
- [x] 切替ボタンで 対応／選考／緊急度 に変えられ、カードのチップも追随する
- [x] 列の中は緊急度の高い順に並ぶ
- [x] その列に学生が0人でも列は出る

P1-7
- [x] 既定が最終メッセージ順になる（変更後の条件）
- [x] 並び替えセレクトで 緊急度順／経過時間順 に切り替えられる

共通
- [x] 列挙値は `shared/constants.js` から import（文字列リテラル直書きなし）
- [x] `npm run lint` が通る
- [x] 人事アカウントでホーム・受信箱の表示を確認（コンソールエラーなし）

## 未確認

- 2ブラウザ（人事・学生）でのリアルタイム動作確認は未実施です（既定値の変更のみでリアルタイム系のコードには触れていないため）。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #36 feat(S-08): 全学生ページ（担当人事別ボード）を追加する

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/S-08-all-students-board` → `master`
- 作成: 2026-08-06T07:40:30Z / マージ: 2026-08-06T07:41:34Z
- 変更: +610 -155 (12 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/36

<details><summary>本文</summary>

## 概要

受信箱・ホームは担当制で**自分の担当学生しか表示されない**（`roomsStore.myRooms`・#28）ため、
担当外と未配属を含む全学生を**担当人事ごとの列**で俯瞰する画面 `/students` を追加します。
返信はこの画面では行わず、カードクリックで `/inbox/:roomId` を開きます。

サーバは変更していません。`room_members` には人事全員が入っている（`server/db/seed.js`）ので
`GET /api/rooms` は既に全学生を返しており、絞っていたのはクライアント側の getter だけでした。

## 受入条件（`.claude/requirements.md` S-08）

- [x] `/students` に自分の担当以外の学生も表示される
- [x] 列は担当人事ごとに分かれ、**未配属が一番左**にある
- [x] 担当が0名の人事の列も出る（`GET /api/users?role=hr&role=admin` を列の元にする）
- [x] 縦割りの軸を切り替える UI は無い（担当人事に固定）
- [x] 未対応サマリーバー（P1-8）が**全学生の件数**で出る
- [x] AI 現況サマリーは無い
- [x] カードをクリックすると担当外の学生でもトークが `/inbox/:roomId` で開く
- [x] フィルタ・検索・並び順は受信箱・ホームと同じ条件を共有する
- [x] サイドバーの「全学生」は**受信箱の下**にある

## 主な変更

| ファイル | 内容 |
| --- | --- |
| `views/StudentsView.vue` | 新規。`/students` の画面（見出し・サマリー・検索・フィルタ・件数＋ボード） |
| `components/AssigneeBoard.vue` | 新規。担当人事ごとの列を組み立てる（未配属を先頭に固定） |
| `components/BoardColumns.vue` | 新規。ホームの `StudentBoard` から列表示（横スクロール・列内の緊急度順）を切り出した共通部 |
| `components/StudentBoard.vue` | 軸ごとの列を組み立てるだけにし、表示は `BoardColumns` へ委譲（挙動は変更なし） |
| `components/SummaryBar.vue` | `scope` プロップを追加（`mine` 既定 / `all`）。数える範囲を画面に出ているルームと揃える |
| `components/StudentCard.vue` | `groupBy` を任意に。縦割りが担当人事のときは対応・選考・緊急度の3チップを出す |
| `stores/rooms.js` | `allSortedRooms`（全件にフィルタ・並べ替えを適用）を追加。比較関数を共通化 |
| `components/AppNavRail.vue` / `NavIcon.vue` / `router/index.js` | 受信箱の下に「全学生」を追加（hr/admin のみ） |

## 動作確認

- `/students`：全10名が `未配属 1 / 大西 陽子 3 / 松本 圭 3 / 木村 誠 3` の列で表示される
- サマリーは `緊急 3 / 要返信 5 / 24h超 2`（全学生の実数）。ホームは従来どおり自分の担当のみ `1 / 1 / 2`
- 「要返信」クリックで5件に絞られ、各列の件数も追随する
- 担当外の学生（佐藤 花子・担当は松本 圭）のカードから `/inbox/2` を開き、履歴とプロフィールが見られる
- ホームの縦割り切替（対応↔選考）はリファクタ後も動作。コンソールエラーなし
- `npm run lint` / `npm run build` 通過

## 補足

- 単独 PR にすべき共有ファイル（`shared/constants.js` / `schema.sql` / `seed.js` / `sockets/index.js`）は触っていません。`router/index.js` はルート追加の1ブロックのみです
- サマリーの件数は既存実装と同じくルーム一覧からの数え上げです（`GET /api/summary` の `fetchSummary` が未実装）。サーバ側サマリーが入ったら担当スコープの出し分けが必要になります

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #37 feat(P3-1): 最新UIにAI対応推奨度とGemini現況サマリーを統合

- 状態: **merged** / 作成者: hinato150
- `codex/feat/P3-1-ai-only` → `master`
- 作成: 2026-08-06T07:41:58Z / マージ: 2026-08-06T08:00:54Z
- 変更: +1747 -35 (36 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/37

<details><summary>本文</summary>

## 変更内容

- 学生の最新メッセージをGeminiで分析し、既存のルール緊急度とは別にAI対応推奨度を保存
- AI対応推奨度が高い未対応案件を受信箱とホームの並び順へ反映
- トーク画面に「求めていること」と「注意すべき背景」を表示
- ホームのAI現況サマリーAPI、キャッシュ、リアルタイム更新を実装
- APIキー未設定・タイムアウト・不正レスポンス時も既存機能を継続するフォールバックを追加
- 既存DB向けマイグレーションとGemini設定手順を追加

## 目的・影響

最新masterのUIを維持したまま、AI機能に必要な表示と接続箇所だけを追加しています。
学生向けレスポンスにはAIの内部判断を含めません。

## 確認

- `npm run test:server`：26件成功
- `npm run lint`：成功
- `npm run build`：成功
- `npm run db:migrate`：成功
- `npm run db:seed`：成功（users 43 / rooms 40 / messages 326）

</details>

---

## #38 P2-2定型文の自動補完機能追加

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/teikei` → `master`
- 作成: 2026-08-06T07:54:23Z / マージ: 2026-08-06T08:02:04Z
- 変更: +93 -1 (2 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/38

<details><summary>本文</summary>

コマンドを選択したら氏名など自動補完してくれる機能を追加しました

</details>

---

## #39 feat(P2-10): 会社情報の設定と学生への表示を追加する

- 状態: **merged** / 作成者: Jo042
- `feat/P2-10-company-info` → `master`
- 作成: 2026-08-06T08:20:15Z / マージ: 2026-08-06T08:35:33Z
- 変更: +849 -20 (17 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/39

<details><summary>本文</summary>

## 概要

人事が設定画面で会社情報を登録すると、**学生のトーク画面の右に常設される会社情報パネル**に反映される仕組みを追加します（新要件 **P2-10**）。選考中の学生が返信を待つ間に自社を知る接点を持たせるのが目的です。

あわせて、実装中に見つけた**設定画面のロール制限の不具合**を別コミットで修正しています。

## 設計判断

**タブ（別画面）ではなく余白の常設パネルにしました。** ナビレールは既定でアイコンのみ・hover で初めてラベルが出る作りのため、学生が隠れたタブに気づきません。会社情報は能動的に探させるものではなく、待ち時間に自然と目に入るものとして置くほうが目的に合うという判断です。人事側の受信箱がトークの右にプロフィールパネルを置くのと同じ構造で、既存の設計語彙にも乗ります。

```
┌────────────────────────────┬──────────────┐
│ 採用担当とのチャット                 │ 会社情報      │
│  ── 8月5日（水） ──              │ 株式会社〇〇   │
│  [採用担当] 面接の日程を…            │ （紹介文）     │
│              承知しました [自分]     │ ┌──────────┐│
├────────────────────────────┤ │採用サイト →│││
│ [入力欄]               [送信]  │ └──────────┘│
└────────────────────────────┴──────────────┘
```

**会社情報の置き場は新規ストアではなく `useUiStore` にしました。** `stores/ui.js` に「ルームに紐づかないマスタデータはここに置く（ストアは4つに固定するため）」という既存の制約があり、会社情報は定型文と同じ性質のためです。この判断を `frontend.md` §3 のルールとして明文化しました。

## 変更内容

### サーバー
- `company_info` テーブルを追加。単一テナントなので `CHECK(id = 1)` で1行に固定
- `GET /api/company`（**学生を含む全ロール**）／`PUT /api/company`（**人事のみ**）
- 更新は3項目の全置換 UPSERT。部分更新にすると「紹介文を空にする」が表現できないため

### クライアント
- `CompanyPanel.vue`（学生の閲覧用）／`CompanySettingsPanel.vue`（人事の編集用）
- `ChatView` を2カラム化（max-width 860 → 1160px。280px パネル＋隙間で 1280px に収まる）
- 設定画面に「会社情報」セクションを追加（人事のみ）

### ドキュメント
`requirements.md`（P2-10・**未決事項 Q-1 の決着**）／`database.md`／`api.md`／`frontend.md`（§6-2・§7-2）

## セキュリティ

- 権限判定は JWT 由来の `req.user.role` のみ。クライアント送信値は信用しない
- 採用サイトURLは**サーバ側で `http:` / `https:` のみ許可**（`javascript:` 対策）
- 表示は `v-html` を使わずテキスト補間。リンクは `rel="noopener noreferrer"`
- 文字数上限：会社名100／紹介文1000／URL500

## 同梱の修正（別コミット）

`/settings/profile` は全ロールが入れますが、**定型文セクションが学生にも表示されていました**。`GET /api/snippets` は人事限定なので、学生が開くと403のトーストが出る状態でした。定型文を人事限定セクションへ移し、見出しと中身の分岐を `activeSection.key` に統一しています。

## テスト計画

`npm run lint` / `npm run build` / 既存サーバーテスト11件は**すべて通過済み**。API は curl で以下を確認済みです。

| ケース | 結果 |
| --- | --- |
| 学生が GET | 200・内容が返る |
| 未認証で GET | 401 |
| 学生が PUT | 403 |
| `javascript:alert(...)` を保存 | 400 |
| スキーム無し `example.com` | 400 |
| 会社名が空／101文字 | 400 |
| 人事が PUT | 200・学生側にも反映 |
| 紹介文とURLを空欄 | 200・`null` で保存 |
| 2行目の INSERT | CHECK制約で拒否 |
| 学生が `GET /api/snippets` | 403（修正の根拠） |

### レビュー時にお願いしたいこと

- [ ] **画面の見た目の確認（未実施）。** Playwright 未導入のためスクリーンショットを撮れていません。`student1` でトーク画面のパネル、`hr1` で設定 → 会社情報を目視確認してください
- [ ] 学生の設定画面に定型文が出ないこと

## 注意

- **`server/db/schema.sql` を変更しています**（共有ファイル）。マージ後、各自 `npm run db:migrate` の実行が必要です
- `npm run db:seed` は既存データを全削除するため、このPRの検証では実行していません

## スコープ外

会社情報のリアルタイム配信（更新頻度が低いため）／定型文の変数（`{会社名}` 等）への展開／ロゴ画像のアップロード

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #40 ホーム画面のタグ削除

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/tag-delete` → `master`
- 作成: 2026-08-06T08:32:40Z / マージ: 2026-08-06T08:33:03Z
- 変更: +0 -3 (1 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/40

---

## #41 feat(P4-0): 監視イベント基盤（alerts）を追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-0-alerts-foundation` → `master`
- 作成: 2026-08-06T08:47:25Z / マージ: 2026-08-06T08:53:11Z
- 変更: +1026 -6 (8 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/41

<details><summary>本文</summary>

## 概要

人事の学生対応を**監視**する P4 系機能の共通基盤。SLA通知（P4-1）とコンプライアンス警告（P4-2/P4-3）を `alerts` 1テーブルに集約し、ダッシュボード（P4-4）が単一の集計元を持てるようにする。

**このPRに動作する機能は含まれない。** テーブルと列挙値と仕様書のみ。

`shared/constants.js` と `server/db/schema.sql` を触るため、**単独でマージしてから P4-1〜P4-4 に着手する**（CLAUDE.md §8）。

## 変更内容

| ファイル | 内容 |
| --- | --- |
| `server/db/schema.sql` | `alerts` / `compliance_rules` テーブル + インデックス6本 |
| `shared/constants.js` | `ALERT_KIND` / `ALERT_SEVERITY` / `COMPLIANCE_CATEGORY`、SLA通知の閾値、`SOCKET_ON.ALERT_NEW` |
| `.env.example` | `SLA_NOTIFY_HOURS=24` / `SLA_ESCALATE_HOURS=48` |
| `.claude/monitoring.md` | **新規。** P4-0〜P4-4 の仕様・受入条件・辞書初期データ・チャート仕様・PR分割 |
| `.claude/constants.md` | §9 を「緊急度の閾値」と「通知の閾値」の2系統に整理、§10-11 を追加 |
| `.claude/database.md` | ER図・テーブル定義・インデックスに反映 |
| `.claude/requirements.md` | P4 索引を追加。`P3-2 実装しない` を撤回、Q-4 を決定済みに |
| `CLAUDE.md` | §2 の参照ルール表に `monitoring.md` を追加 |

## 設計上の判断

### 1. 監視イベントを1テーブルに集約する

SLA通知とコンプライアンス警告を別テーブルにすると、ダッシュボードが2種類の集計を持つことになる。`kind` で判別する1テーブルに寄せ、P4-4 を `GROUP BY` だけで済むようにした。

### 2. 多重通知は部分UNIQUEインデックスで防ぐ ★レビュー観点

SLA検出は60秒タイマーから回るため、**同じ学生を毎分通知しない保証**が最重要。アプリ側に「通知済みか」の状態を持たせず、DB制約だけで担保する。

```sql
CREATE UNIQUE INDEX idx_alerts_sla_unique
  ON alerts(kind, room_id, trigger_message_id, target_user_id)
  WHERE kind IN ('sla_notify', 'sla_escalate');
CREATE UNIQUE INDEX idx_alerts_compliance_unique
  ON alerts(room_id, trigger_message_id, rule_code)
  WHERE kind = 'compliance';
```

**テーブルレベルの `UNIQUE(...)` は使えない。** SQLite は UNIQUE 制約中の NULL を互いに異なる値として扱うため、`target_user_id IS NULL` のコンプライアンス行が重複し放題になる。実測で確認済み（同じ警告を2回INSERTして2件入った）。加えて `rule_code` がキーに入らないと、1通に複数ルールが当たったとき1件しか残らない。

### 3. 通知の閾値と緊急度の閾値を分ける

`SLA_WARN_HOURS` / `SLA_ALERT_HOURS`（既存・緊急度用）は流用せず、`SLA_NOTIFY_HOURS` / `SLA_ESCALATE_HOURS` を新設した。責務が別なので、片方を変えたときに両方動くのを防ぐ。

`SLA_NOTIFY_HOURS=24` が `SLA_ALERT_HOURS=24` と同値なのは意図した整合で、**担当者への通知が飛ぶ瞬間と `urgency` が `high` に変わる瞬間が一致する**（受信箱の並びと通知が食い違わない）。

### 4. `admin` も学生を担当する

エスカレーション先は `role='admin'` の全員で、担当者本人が admin でも除外しない。除外すると admin が1人の構成でエスカレーションが消滅する。この場合その人は24hに `sla_notify`、48hに `sla_escalate` の2件を受け取るが、意味が違う（「あなたが返していない」／「担当者が返していない」）ので正しい。

## 検証

- `npm run lint` — クリーン
- `npm run test:server` — 26/26 パス
- `npm run db:migrate` — 適用済み。既存データ健全（users 43 / rooms 40 / messages 326）。新規テーブルのみで既存スキーマは無変更

冪等性の実測（5ケースすべて期待通り）：

| ケース | 結果 |
| --- | --- |
| 同じSLA通知を2回 INSERT | 1件 ✓ |
| 同じ宛先に `sla_notify` + `sla_escalate` | 2件 ✓（`kind` が違うので両方立つ） |
| 同じコンプラ警告を2回 INSERT | 1件 ✓ |
| 同一メッセージに別ルール2つ該当 | 2件 ✓ |
| 学生が再発言（起点が変わる） | 2件 ✓（正しく再通知） |

## 後続

`.claude/monitoring.md` §7 の順に進める。

1. **P4-2** 就職差別・オワハラ検知
2. **P4-3** 送信前チェック（ブロック型）
3. **P4-1** SLA監視・段階エスカレーション
4. **P4-4** 監視ダッシュボード（`chart.js` / `vue-chartjs` の追加を伴う）

## 補足

`vite.config.js` と `.claude/launch.json` にローカル開発用の未コミット変更が残っているが、P4-0 と無関係なのでこのPRには含めていない。別途 `chore` で切り出しが必要。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #42 feat(P4-2): 就職差別・オワハラ検知を追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-2-compliance-checker` → `master`
- 作成: 2026-08-06T09:04:02Z / マージ: 2026-08-06T11:37:16Z
- 変更: +845 -12 (10 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/42

<details><summary>本文</summary>

## 概要

人事の発言から、**就職差別に当たる質問**と**オワハラ表現**を検知し `alerts` に記録する。P4-0（#41）の上に乗る監視機能の第1弾。

辞書ベースで完結しており、**外部APIに依存しない**。`GEMINI_API_KEY` 未設定でも全機能が動く。

送信前の警告ダイアログは **P4-3** で載せる。このPRの時点では検知と記録のみで、UI 変更は無い。

## なぜサーバ側で記録するのか

送信前ダイアログ（P4-3）はクライアントにあり DevTools で無効化できる。**サーバ側で保存時に再検査して残さないと「監視」が成立しない**（CLAUDE.md §6-6）。記録が本体で、ダイアログはその手前の親切にすぎない。

`insertMessage` に差し込んだので、REST・socket のどちらから送っても記録される。

## 変更内容

| ファイル | 内容 |
| --- | --- |
| `server/services/complianceChecker.js` | 検知。DB は辞書の読み出しのみ |
| `server/services/complianceAlerts.js` | `alerts` への記録 |
| `server/routes/messages.js` | `insertMessage` から記録を呼ぶ。`acknowledgedCodes` を受け取れるようにした（P4-3 用） |
| `server/db/seed.js` | `compliance_rules` の辞書 15ルール / 46キーワード |
| `server/db/schema.sql` | `compliance_rules.code` の UNIQUE を外した（後述） |
| `server/db/migrate.js` | 旧定義のテーブルを検出して作り直す |
| `.claude/monitoring.md` / `.claude/database.md` | 実装に合わせて更新 |

## 辞書

出典は厚生労働省「公正な採用選考の基本」で**尋ねてはならない**とされる事項。根拠が公的基準にあることがこの機能の説得力の源なので、独自解釈で増やさないでほしい。

- `discrimination`（10ルール・すべて `block`）本籍／家族の職業・学歴／住宅／資産／宗教／支持政党／思想信条／労働組合／購読紙
- `owahara`（5ルール）他社辞退の要求・即決の強要・内定の交換条件は `block`、回答期限の圧力は `warn`

## レビュー観点

### 1. `compliance_rules.code` の UNIQUE を外した ★スキーマ変更

P4-0 で `code TEXT NOT NULL UNIQUE` として作ってしまったが、**1つのルールが複数キーワードを持つ**ため（`honseki` = 本籍／出身地／生まれはどこ）、`code` は行のグループキーでなければならない。`tag_rules` と同じ形に揃えた。

SQLite はインラインの UNIQUE だけを落とせないので、`migrate.js` の `dropLegacyComplianceRuleUnique()` が旧定義を検出してテーブルごと作り直す。辞書は seed で入れ直す前提なのでデータは移送しない。**テーブルは空なので実害はない。**

### 2. 誤検知対策

「本籍地はお伺いしません」という**正しい**文が block になった瞬間にこの機能は信用を失う。`exclude_keyword` をカンマ区切りで持たせ、いずれか1つでも本文にあれば検知しないようにした。

**既知の限界**：除外語はルール単位なので、1通に「正しい断り書き」と「実際の違反」が同じ code で同居すると検知できない（例：「本籍はお伺いしませんが、出身地はどちらですか」）。辞書ベースの構造的な限界で、拾うなら AI 併用の役目。`monitoring.md` に明記した。

### 3. 個人情報をログ・DBに残さない

`alerts.detail` には該当キーワードの**前後20文字だけ**を載せ、本文全体は保存しない。`console.log` にも出さない（CLAUDE.md §6-8）。テストで担保している。

### 4. 用件タグとの挙動の違い

`tagClassifier` は最初のマッチで確定するが、こちらは**全件返す**（1通に複数の問題が混ざりうるため）。ただし同一 `code` は1件に畳む。

## 検証

- `npm run lint` クリーン
- `npm run test:server` **45件パス**（本PRで19件追加）
- 実DB + 実辞書での動作確認：

| 入力 | 結果 |
| --- | --- |
| ご本籍はどちらですか | `honseki/block` |
| 本籍地はお伺いしませんのでご安心ください | **検知なし** |
| 内定をお出しする代わりに他社は辞退してください | `withdraw_others/block` |
| ご両親の職業を教えてください | `family_job/block` |
| 早めに返事をいただけますか | `pressure_soft/warn` |
| ご本籍と支持政党を教えてください。返事は今日中にお願いします | 3件（`block`,`block`,`warn` の順） |
| 明日の面接は10時からです | 検知なし |

`insertMessage` 経由の結合確認も実施。人事の発言1通で `alerts` が1件増え、無害な発言では増えず、メッセージ自体は両方とも正常に保存された（ネストしたトランザクションも問題なし）。

## 後続

- **P4-3** `POST /api/messages/check` + 送信前ダイアログ。`insertMessage` は既に `acknowledgedCodes` を受け取れるので、あとは API と UI だけ
- **P4-1** SLA監視・段階エスカレーション
- **P4-4** 監視ダッシュボード

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #43 feat(P4-3): 送信前チェック（ブロック型）を追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-3-precheck-dialog` → `feat/P4-2-compliance-checker`
- 作成: 2026-08-06T10:31:58Z / マージ: 2026-08-06T11:37:24Z
- 変更: +430 -11 (10 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/43

<details><summary>本文</summary>

> **このPRは #42（P4-2）の上に積んでいます。** base は `feat/P4-2-compliance-checker`。
> #42 がマージされると GitHub が自動で base を master に付け替えます。**先に #42 をレビュー・マージしてください。**

## 概要

人事が送信ボタンを押した時点で本文を検査し、就職差別・オワハラの疑いがあれば**警告ダイアログを出して送信を止める**。検知ロジックは P4-2 の `complianceChecker` をそのまま使う。

## 設計の要点

### 送信を物理的に禁止しない

ダイアログの選択肢は「修正する（既定フォーカス）」と「このまま送信」の2つ。後者を選べば送信される。

業務を止めないことを優先し、**警告を無視して送った事実が記録に残ることを監視の価値とする**（monitoring.md 決定事項4）。この記録は P4-4 ダッシュボードの「警告を無視して送信：N件」の集計元になる。

### このダイアログは監視の本体ではない

クライアント側にあるので DevTools で消せる。**監視の本体は P4-2 のサーバ側記録のまま。** チェックを経ずに socket を直叩きされた場合も検知・記録され、`detail` に「送信前チェック未経由」が残る。

`acknowledgedCodes` は socket・REST の両経路から `insertMessage` まで通し、`normalizeAcknowledgedCodes` で配列・文字列だけに絞ってから使う（クライアントの値を信用しない・CLAUDE.md §6-6）。

### 検査APIが落ちたら送信を通す

`onSubmit` の `catch` は握りつぶす。監視のための仕組みが業務を止めては本末転倒で、しかもサーバ側で記録は残るため取りこぼしもない。

## 変更内容

| ファイル | 内容 |
| --- | --- |
| `server/routes/messages.js` | `POST /api/messages/check`。`room_members` 検証あり。学生には常に空を返す |
| `server/services/complianceAlerts.js` | `normalizeAcknowledgedCodes` を追加 |
| `server/sockets/handlers/message.js` | `message:send` で `acknowledgedCodes` を受ける |
| `src/components/ComplianceDialog.vue` | 新規。native `<dialog>` + `showModal()` |
| `src/components/ChatPanel.vue` | `onSubmit` に検査を挟む／`onSendAnyway` |
| `src/stores/ui.js` | ダイアログの開閉状態 |
| `src/stores/messages.js` | `sendMessage` の第3引数で `acknowledgedCodes` を運ぶ |
| `src/api/messages.js` | `messagesApi.check` |

## レビュー観点

1. **`normalizeAcknowledgedCodes` を routes ではなく services に置いた。** `routes/messages.js` は `config/env.js` を巻き込むため、テストから import すると `JWT_SECRET` 未設定で落ちる（`npm run test:server` は `.env` を読まない）。純粋関数なので compliance 側が正しい置き場所でもある
2. **`v-html` を使っていない。** 該当箇所はテキスト補間で出す（CLAUDE.md §6-10）
3. **重大度は色だけでなくテキストでも示す**（CLAUDE.md §6-13）
4. **既定フォーカスは「修正する」。** 誤って Enter を押しても送信されない
5. 免責文（`COMPLIANCE_DISCLAIMER`）を常時表示。「検知しました」と断定せず、法的判断の代行に見せない

## 検証

`npm run lint` / `npm run build` クリーン、`npm run test:server` 46件パス。

ブラウザ（hr1 でログイン → 受信箱 → トーク）で以下を確認：

| 操作 | 結果 |
| --- | --- |
| 「ご本籍はどちらですか。あと、内定を出す代わりに他社は辞退してください。」を送信 | ダイアログが3件の検知を表示し、**送信されない**。本文は入力欄に残る |
| 「このまま送信」 | 送信され、`alerts` に `honseki/block` が「**警告を承知で送信**」の注記付きで記録された |
| 「本籍地はお伺いしませんのでご安心ください」を送信 | **ダイアログは出ず**そのまま送信。`alerts` は増えない |

### 実装中に直した点

初回の実装で `<dialog>` が中央ではなく左上に寄っていた。native `<dialog>` は `margin: auto` が無いと `showModal()` でも中央に来ない（`ProfileDialog.vue` は明示していた）。`monitoring.md` に注意書きとして残した。

## 後続

- **P4-1** SLA監視・段階エスカレーション
- **P4-4** 監視ダッシュボード

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #44 feat(S-09/P2-11): 学生マイページと選考フローの可視化を追加する

- 状態: **merged** / 作成者: Jo042
- `feat/S-09-selection-flow` → `master`
- 作成: 2026-08-06T10:56:40Z / マージ: 2026-08-06T10:57:04Z
- 変更: +2910 -17 (27 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/44

<details><summary>本文</summary>

## 概要

人事が設定した選考フローを、**学生のマイページに丸とつなぎ線の図**として出します（新要件 **S-09** / **P2-11**）。学生は自分がいまどの段階にいるかを一目で把握でき、各ステップを選ぶと内容・ポイント・企業からのフィードバックを読めます。

**学生のログイン後の着地点を `/chat` から `/mypage` に変更**しています。

```
┌────────────────────────────────────────────────────┐
│ 株式会社ラクラク  「はたらく人の毎日を、少しだけ…」  採用サイトを見る → │
├────────────────────────────────────────────────────┤
│ マイページ                                            │
│ 田中 太郎 さんの選考状況                                 │
│                          ◉ ← 現在地が山の頂上          │
│                    ╭─╯ ╰─╮                          │
│   ①━━━②━━━③━━━④      ⑤───⑥───⑦              │
│   ✓    ✓•   ✓•   ✓     進行中  ○    ○               │
│  エント 書類  適性  一次   二次   最終  内定                │
│   ← オレンジ（歩いてきた道）→  ← 薄いグレー（これから）→      │
├────────────────────────────────────────────────────┤
│ 二次面接                                    [進行中]   │
│ この選考について / ポイント / 企業からのフィードバック         │
└────────────────────────────────────────────────────┘
```

## 最大の設計判断：既存の選考ステータスを壊さない

「各選考ステップを会社が設定し、動的にUIが組み立てられる」という要件は、既存の `SELECTION_STATUS`（`shared/constants.js` の固定列挙値）と正面から衝突します。この列挙値は **22ファイル**が依存しており（受信箱の行、ホーム S-07 のボード列、全学生 S-08、フィルタ P1-7、AI要約、定型文の `{選考段階}` 変数）、`students.selection_status` の CHECK 制約でもあります。

そこで**識別子は列挙値のまま**にし、`selection_steps` テーブルには**見せ方の設定だけ**を持たせました。

| | できること | できないこと |
| --- | --- | --- |
| 会社の設定 | 使う/使わないの取捨選択、表示名の変更、並び順、説明・ポイント | 新しいステップ種別の追加 |

**既存22ファイルは無改修**です。シードは四次・五次面接を「使わない」設定にしてあるので、取捨選択できることがデモで伝わります。

## セキュリティ上いちばん重要な点

**フィードバックは「その学生が通過済みのステップ」のぶんだけ学生に返します。**

進行中・未到達のFBを返すと、合否連絡より先に評価が本人へ漏れます。絞り込みは `server/services/selectionFlow.js` の `buildStudentFlow()` が行い、**レスポンスに載せません**。クライアントで隠す実装にはしていません（レスポンスを見れば読めてしまうため）。

人事側には各ステップに「本人に公開中／本人には非公開」を明示し、いつ相手に見えるか分かる状態で書けるようにしています。

## 変更内容

### サーバー
- `selection_steps`（設定・PKが固定の列挙値）／`selection_feedbacks`（学生×ステップで1件）を追加
- `GET/PUT /api/selection-flow`、`GET /api/selection-flow/me`（学生のみ）
- `PUT /api/students/:userId/feedbacks/:statusKey`（人事のみ・既存の二段構え認可を再利用）
- **進捗は `students.selection_status` から毎回導出し、保存しない**（二重管理を避ける）

### クライアント
- `StudentHomeView`（S-09）／`SelectionFlow`／`SelectionStepDetail`
- `SelectionFlowSettingsPanel`（設定画面）／`StudentFeedbackPanel`（受信箱の右ペイン）
- `CompanyPanel` に `banner` レイアウトを追加してマイページ上部で使い回し（二重実装なし）
- `auth.homePath` の student を `/mypage` に変更、ナビレールを2項目に

### ドキュメント
`requirements.md`（S-09・P2-11）／`database.md`／`api.md`／`frontend.md` §7-3／`business-logic.md` §8／`constants.md`

## フロー図の実装メモ

- **山は正規分布（ガウス関数）で描く。** `lift(x) = -28 × exp(-(x-頂点x)² / 2σ²)`、σ = 丸の間隔 × 0.8。丸の持ち上げ量と線の高さを同じ式から出すので、**線は必ず丸の中心を通る**
- ベジェで丸から丸へ繋ぐと区間ごとのS字になり裾野が膨らむため、**4px 刻みで標本化**
- つなぎ線は疑似要素ではなく **SVG のパス**。疑似要素は DOM 順で丸の上に重なるうえ、山の形に追従できない
- 持ち上げは `transform` なので、測るのは**持ち上げる前**の位置（親のボタン基準）。持ち上げ後を測ると循環する
- アニメーションは全体 500ms 以内、`transform`/`opacity` のみ、入場はマウント時1回、`prefers-reduced-motion` 対応

## テスト計画

`npm run lint` / `npm run build` / 既存テスト26件は**すべて通過済み**。API は curl で確認済みです。

| ケース | 結果 |
| --- | --- |
| **進行中・未到達のFBが学生に漏れるか** | **漏れない**（機密文字列を仕込んで検証） |
| 学生が設定を更新 | 403 |
| 人事が `/selection-flow/me` | 403（学生専用） |
| 学生が他人のFB一覧を読む | 403 |
| 有効ステップ0件で保存 | 400 |
| ステップ件数不足 | 400 |
| `declined` をステップ指定 | 400 |
| 人事がFBを書く → 学生に反映 | 200・反映を確認 |
| FBを空文字で取り消し | 200・削除を確認 |

### レビュー時にお願いしたいこと

- [ ] **画面の見た目の確認（未実施）。** Playwright 未導入のためスクリーンショットを撮れていません
- [ ] 山の高さ（28px）と σ の係数（0.8）が強すぎ／弱すぎないか
- [ ] `student1` でマイページ、`student6`（辞退）で終端表示、`hr1` で設定→選考フローと受信箱右ペイン

## 注意

**`server/db/schema.sql` を変更しています**（共有ファイル）。マージ後、各自 `npm run db:migrate` の実行が必要です。既存DBにはテーブルが無いため、選考フローのAPIが 500 になります。

## スコープ外

新しいステップ種別の追加・削除／FBのリアルタイム配信／装飾つきテキスト／ステップごとの添付ファイル

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #45 feat(P4-2b): 検知を正規表現＋正規化にし、LLM判定を追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-2b-compliance-regex-ai` → `feat/P4-3-precheck-dialog`
- 作成: 2026-08-06T11:09:02Z / マージ: 2026-08-06T11:37:33Z
- 変更: +1163 -162 (19 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/45

<details><summary>本文</summary>

> **スタックの3段目です。** base は `feat/P4-3-precheck-dialog`（#43）。
> **#42 → #43 → 本PR の順にマージしてください。** 上流がマージされると base は自動で付け替わります。

## なぜ

P4-2 の判定が `body.includes(keyword)` だけだったので、実際に測ったら壊れていました。

| | 結果 |
| --- | --- |
| すり抜け | 9ケース中 **8件が検知できず** |
| 誤検知 | 6ケース中 **6件すべてで誤検知** |

「お父様のお仕事は何ですか」が素通りし、「宗教学を専攻されていたんですね」が要修正になる状態でした。デモで自由入力されると両方向に崩れます。

## 変更内容

### ① 照合前の正規化（`services/textNormalizer.js`・新規）

NFKC・小文字化・空白除去をかけてから照合します。**「本 籍はどちらですか」の回避が効かなくなります。**

該当箇所は元の本文から切り出したいので、正規化と同時に位置の対応表を作ります。

**踏んだ罠を2つ書いておきます。**

- **位置は UTF-16 コードユニット単位で統一する必要がある。** `RegExp.exec().index` も `String.indexOf` もコードユニット基準なので、対応表をコードポイント単位にすると絵文字を含む本文で該当箇所がずれます
- **半角カナの濁点は2コードポイント。** `ｼ` + `ﾞ` を1文字ずつ NFKC しても `ジ` に合成されません。次が `ﾞ`/`ﾟ` なら2文字まとめて正規化しています

どちらもテストで固定しました。

### ② キーワードを正規表現に

`(ご|お)?(両親|父|母|お父様).{0,12}(職業|お仕事|仕事|勤め)` のように書けるので、言い回しの揺れを1パターンで吸収できます。

同時に、多くのルールで**述語**（何ですか・教えて 等）をパターンに含めました。単語の存在だけで判定すると「弊社は労働組合と協議して制度を改定しました」まで block になるためです。

不正な正規表現はリテラルとして扱います。辞書1行の typo で検査全体を落とさないための保険で、これもテストがあります。

> 当初検討していた「差別系ルールに疑問形であることを必須にする」案は**不採用**にしました。検証に使ったテストケースに合わせただけで根拠が弱いという指摘を受け、正規表現に述語を含める形へ置き換えています。`monitoring.md` の非採用案に理由を残しました。

### ③ LLM 判定（`services/complianceAi.js`・新規）

辞書は言い換え・迂回表現を原理的に拾えないので、その層を足します。

**汎用のモデレーションAPIは使えません。** Perspective API / OpenAI Moderation / Azure Content Safety はいずれも toxicity・hate の軸で測るので、「ご本籍はどちらですか」は丁寧で攻撃性ゼロ＝スコアが立ちません。厚労省の基準をこちらからプロンプトで渡す以外に方法がありませんでした（なお Perspective API は2026年12月終了予定）。

**接続できるときは送信前チェックで結果を待ちます。** 待機中は送信ボタンを `確認中…` にして押下不可にし、固まって見せません。タイムアウト（3秒）・APIエラー・キー未設定のときは辞書の結果だけで先へ進め、ダイアログに「**AIによる検証はできていません。辞書による判定のみを表示しています。**」と明示します。

誤検知を抑える仕掛け：

| 仕掛け | 内容 |
| --- | --- |
| 引用の実在確認 | `quote` が入力に含まれない指摘は捨てる（モデルの作文を出さない） |
| enum 検証 | category / severity が定義外なら捨てる |
| 件数上限 | 最大3件 |
| 重複排除 | 辞書が既に拾ったカテゴリは重ねない |
| プロンプト | 「確信が持てなければ含めない」「見逃しより誤検知の方が有害」 |

本文をキーに60秒キャッシュし、送信前チェックと送信後の記録で**Gemini 呼び出しは1通1回**に収めています。AI 分の記録だけは保存トランザクションの外（`queueAiComplianceRecord`）で行います。

## 検証

`npm run lint` / `npm run build` クリーン、`npm run test:server` **66件パス**（本PRで20件追加）。

実辞書に対する16ケースの実測で**すり抜け・誤検知ともに0件**：

| 入力 | 変更前 | 変更後 |
| --- | --- | --- |
| お父様のお仕事は何ですか | — | `family_job` |
| ご両親はどんなお仕事をされていますか | — | `family_job` |
| 本 籍はどちらですか | — | `honseki` |
| ご　本　籍　はどちらですか | — | `honseki` |
| 他社さんは辞退していただけますか | — | `withdraw_others` |
| 弊社一本に絞っていただけませんか | — | `withdraw_others` |
| 今日中にお返事をいただけますか | — | `deadline_today` |
| 宗教学を専攻されていたんですね | `religion` 誤検知 | — |
| 資産運用部門への配属を希望されますか | `assets` 誤検知 | — |
| 弊社の信条は「誠実であること」です | `thought` 誤検知 | — |
| 労働組合との協議を経て制度を改定しました | `union` 誤検知 | — |
| ご家族構成の変更があれば人事までご連絡ください | `family_job` 誤検知 | — |
| 選挙は明日ですので投票所が混みます | `politics` 誤検知 | — |
| 本籍地はお伺いしませんのでご安心ください | — | — |

ブラウザでも確認済み（`GEMINI_API_KEY` 未設定の環境）。「お父様のお仕事は何ですか。あと、本 籍はどちらでしょうか。」で2件検知、「AIによる検証はできていません」の注記が表示され、「修正する」で本文を保ったまま閉じることを確認しました。

AI 経路は `ok` / `error` / `unavailable` の3状態をモック fetch で単体テストしています（実 API へのリクエストは発生させていません）。

## 後続

- **P4-1** SLA監視・段階エスカレーション
- **P4-4** 監視ダッシュボード

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #46 chore(P4-3/P4-2b): master に取り込まれなかった分を反映

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-3-precheck-dialog` → `master`
- 作成: 2026-08-06T11:44:20Z / マージ: 2026-08-06T11:51:22Z
- 変更: +1574 -154 (22 files, 6 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/46

<details><summary>本文</summary>

## これは何

#42・#43・#45 を**17秒以内に連続マージしたため**、GitHub が base を master へ付け替える前に処理が走り、**#43 と #45 の中身が master に入っていません**でした。

| PR | 実際のマージ先 |
| --- | --- |
| #42 | `master` ✓ |
| #43 | `feat/P4-2-compliance-checker`（master ではない） |
| #45 | `feat/P4-3-precheck-dialog`（master ではない） |

その結果、master には P4-2（辞書検知）だけが入り、以下が欠けています。

- `src/components/ComplianceDialog.vue`（送信前ダイアログ）
- `server/services/complianceAi.js`（LLM判定）
- `server/services/textNormalizer.js`（正規化）

このPRは `feat/P4-3-precheck-dialog`（#45 のマージを受けた全部入りブランチ）を master へ取り込み、欠落を解消するだけのものです。**新しい変更は含みません。**

## 内容

既にレビュー済みの以下がそのまま入ります。

- **P4-3** 送信前チェック（ブロック型）→ #43
- **P4-2b** 正規表現＋正規化＋LLM判定 → #45

## 検証

マージ前の同一ツリーで確認済み。

- `npm run lint` クリーン
- `npm run test:server` 66件パス
- `npm run build` 成功
- `npm run db:migrate` + `db:seed` 成功（compliance_rules 42行 / 15ルール）

## 今後の再発防止

スタックしたPRは**1本ずつ、base の付け替えを確認してから**次をマージしてください。`gh pr view <n> --json baseRefName` で base が `master` になったことを確認するのが確実です。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #47 feat(P4-1): SLA監視・段階エスカレーションを追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-1-sla-escalation` → `master`
- 作成: 2026-08-06T12:02:12Z / マージ: 2026-08-06T12:03:26Z
- 変更: +1097 -65 (16 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/47

<details><summary>本文</summary>

## 概要

学生の最終発言から **N=24時間で担当者へ通知、2N=48時間で上長へエスカレーション**する。「取りこぼしゼロ」の主機能。

P4-0（#41）で入れた `alerts` テーブルの上に乗ります。P4-2/P4-3 とはデータを共有しますが、機能としては独立しています。

## 設計の要点

### 多重通知は DB 制約だけで防ぐ

60秒タイマーから回るので、**同じ学生を毎分通知しない保証**が最重要です。`idx_alerts_sla_unique` + `INSERT OR IGNORE` に一本化し、アプリ側に「通知済みかどうか」の状態を持たせていません。学生が再発言すれば `trigger_message_id` が変わるので、正しく再通知されます。

**タイマーは増やしていません。** 既存の緊急度再計算と同じ60秒ループに相乗りさせ、`try` だけ分けて片方の失敗が他方を止めないようにしています。

### 通知先の決め方

| 経過 | 種別 | 宛先 |
| --- | --- | --- |
| 24h | `sla_notify` | 担当者。**未アサインなら上長へ直行** |
| 48h | `sla_escalate` | `role='admin'` の全員 |

- **未アサインを上長へ直行させる**のは、通知先がいない経路が一番取りこぼすためです
- **担当者が admin 本人でもエスカレーション先から除外しません。** 除外すると admin が1人の構成でエスカレーションが消滅します（monitoring.md 決定事項10）。その人は24hに「あなたが返していない」、48hに「担当者が返していない」の2件を受け取ります — 宛先も意味も違うので正しい挙動です

### 解消

人事が返信した時点で、そのルームの未解決 SLA 通知を閉じ、一覧から消します。「上から処理すれば終わる」状態を保つためです。**コンプライアンス記録（P4-2）は閉じません** — あちらは「起きた事実」であって解消するものではないので。

### ストアを増やさなかった

当初 `stores/alerts.js` を作る想定でしたが、`frontend.md` §3 に「**ストアは4つに固定**」とあるため `useUiStore` に置きました。定型文・会社情報・選考フローと同じ扱いです。monitoring.md の記述が誤っていたので併せて直しています。

## 変更内容

| ファイル | 内容 |
| --- | --- |
| `server/services/slaMonitor.js` | 検出と解消（新規） |
| `server/services/alertView.js` | 一覧・既読化のクエリ（新規） |
| `server/routes/alerts.js` | `GET /api/alerts` / `POST /:id/read` / `POST /read-all`（新規） |
| `server/index.js` | 既存60秒タイマーに検出を追加 |
| `server/routes/messages.js` | 返信時に解消 |
| `server/services/realtime.js` | `emitAlertNew`（宛先本人のみ） |
| `src/views/NotificationsView.vue` | 雛形を実装に置き換え |
| `src/components/AppNavRail.vue` | ベルの件数を暫定集計から実データへ |
| `src/stores/ui.js` / `src/api/alerts.js` | 状態と API |
| `server/db/seed.js` | エスカレーション用の固定シナリオを追加 |

他人宛の通知IDを指定された場合は **403 ではなく 404** を返します（403 だと「その通知は存在する」ことが漏れる・CLAUDE.md §6-6）。

## 検証

`npm run lint` / `npm run build` クリーン、`npm run test:server` **80件パス**（本PRで14件追加）。境界値・冪等性・対象外ステータス・admin兼任・解消の非干渉をテストで固定しています。

### 実データでの確認

**hr1（担当者）** — 自分の担当2件のみ、バッジ2

**admin1（上長）** — 5件。うち3件がエスカレーション

| 表示 | 学生 | 担当 |
| --- | --- | --- |
| 未返信24時間 | 大久保 悠斗 (26h) | 木村 誠（自分） |
| 上長エスカレーション | 村上 悠斗 (60h) | 松本 圭 |
| 未返信24時間 ＋ 上長エスカレーション | 西村 結衣 (63h) | 木村 誠（自分） |
| 上長エスカレーション | 長谷川 遥 (50h) | 大西 陽子 |

西村 結衣 が2行出ているのが、admin 兼任時の設計どおりの挙動です。

**ライフサイクル** — 行クリックで既読化してルームへ遷移（バッジ 5→4）、返信すると `sla_notify` / `sla_escalate` の両方が解消されて一覧から消えることを確認。

### ライブ動作

閾値を **72秒 / 144秒** に短縮したサーバを立てて確認しました。学生が発言してから **72秒後に socket 経由で通知が届く**ことを実測しています。デモではこの短縮値でライブ演出ができます。

```bash
SLA_NOTIFY_HOURS=0.02 SLA_ESCALATE_HOURS=0.04 npm run dev:server
```

このライブ検証で「返信が **0 時間** ありません」という壊れた文面が出ることが判明したため、1時間未満は「1 時間未満」と表示するよう修正しました。

## デモ用シード

`student11`（長谷川 遥・担当 hr1・50時間経過）をエスカレーション用の固定シナリオとして追加しました。担当を hr1 にしたのは、admin1 だと「上長が自分自身へ」の絵になり意図が伝わらないためです。生成分にも60時間超が数名いるので、シード直後から一覧が埋まります。

## 後続

**P4-4** 監視ダッシュボード（`alerts` を集計。chart.js の追加を伴う）

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #48 feat(P4-4): 監視ダッシュボードを追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-4-monitoring-dashboard` → `master`
- 作成: 2026-08-06T12:18:22Z / マージ: 2026-08-06T13:09:34Z
- 変更: +1886 -73 (27 files, 4 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/48

<details><summary>本文</summary>

## 概要

`alerts` を集計して全社の対応状況をグラフで可視化します。**P4 系の最後**の1本です。

閲覧は**上長（admin）限定**。担当者別の遵守率は評価につながる情報なので人事全員には開放しません。ルーター（`meta.roles`）とサーバ（`requireAdmin`）の**両方**で弾いています — 画面を隠すだけでは守れないためです。

## 画面

| ブロック | 形式 |
| --- | --- |
| KPI 4枚（要返信／24h超／上長対応中／今週の警告） | 数字タイル。グラフにしない |
| 選考ステータス別 学生数 | 横棒・単一色・進行順（辞退のみ赤） |
| 担当者別 SLA 遵守状況 | 横100%積み上げ・3段（未配属が先頭） |
| SLA通知の発生推移 | 縦棒・直近14日・単一系列 |
| コンプライアンス検知の内訳 | 横棒・単一色＋「警告を無視して送信 N件」 |
| 上長エスカレーション中の案件 | テーブル・経過の長い順・行クリックで遷移 |

## ライブラリ追加

`chart.js` + `vue-chartjs` を入れました（CLAUDE.md §3 に対する合意済みの例外）。

- `chart.js/auto` は使わず、必要なコントローラだけ明示登録
- `/dashboard` を**遅延読み込み**にして初期バンドルから外しました。開くのは上長だけなので、大多数のユーザーは読み込まずに済みます

```
dist/assets/DashboardView-*.js   164.77 kB │ gzip: 58.26 kB   ← 別チャンク
dist/assets/index-*.js           880.43 kB │ gzip: 286.25 kB  ← 変化なし
```

## レビュー観点

### 1. 配色は検証済みのものを使っています

`dataviz` の検証スクリプトで実測した値です。**`src/plugins/charts.js` の `CHART_COLOR` は変えないでください。**

- 単一色バー `#3B7FC4`（全項目 PASS）
- SLA3段 `#2F8F5B` / `#C98500` / `#D03B3B`（CVD分離のみ WARN → 直接ラベル＋2pxギャップで充足）

**対応ステータスのチップ色は流用していません。** `#F5A623` は白背景に対して 2.03:1 しかなく、細い積み上げセグメントでは背景に溶けます。

**選考ステータス10段階を10色にしていません。** 段階の違いはバーの位置が既に示しているので色に仕事がなく、9色目は色覚多様性の検証を必ず落ちます。

### 2. テーブル表示は任意ではありません

Chart.js は canvas に描くので DOM が無く、スクリーンリーダーから読めません。全チャートに「表で見る」トグルを付けています。色だけで情報を伝えない（CLAUDE.md §6-13）の実現手段でもあります。

### 3. 集計で気をつけた点

- **選考ステータスは0人の段階も返す。** 欠けるとファネルの段が抜けて読めなくなる
- **推移は件数0の日をサーバ側で埋める。** `GROUP BY` だけだと0件の日が行ごと消えて日付軸がずれる
- **担当者別SLAは `alerts` の履歴ではなく、いまこの瞬間の経過時間で数える。** 「現在どれだけ滞留しているか」の指標なので、過去に超えたが返信済みのルームは遵守側に入るのが正しい
- **エスカレーション表は1ルーム1行。** 上長が複数いると同じルームに alerts が複数立つため

## 検証

`npm run lint` / `npm run build` クリーン、`npm run test:server` **90件パス**（本PRで10件追加）。境界値・0埋め・対象外ステータス・空データを固定しています。

### ブラウザ確認（admin1）

実データで全パネルが描画されることを確認：

- KPI: 要返信20 / 24h超8 / 上長対応中3（赤枠強調） / 今週の警告0
- 選考ステータス別: エントリー3〜三次面接8、辞退1を赤で最下段
- 担当者別SLA: 未配属4件、他3名が 9-10 / 1-2 / 1 の積み上げ
- エスカレーション表: 63h / 60h / 50h の3件が経過順
- 「表で見る」でテーブルに切替（ラベルが「グラフで見る」に変わる）

コンプライアンス検知の内訳は、検証用に3件送って `family_job` / `honseki` / `pressure_soft` が各1件、**「警告を無視して送信 3件」**が正しく数えられることまで確認したうえで、データは片付けてあります。

### 権限

| ロール | API | 画面 | ナビ |
| --- | --- | --- | --- |
| admin | 200 | 表示 | 出る |
| hr | **403** | `/home` へリダイレクト | **出ない** |

## デモでの注意

シード直後は**コンプライアンス検知が0件**なので、その2枠は空で表示されます。P4-3 の送信前チェックをライブで実演すれば埋まるので、**ダッシュボードは検知デモの後に見せる**流れをおすすめします。

## これで P4 完了

| ID | 状態 |
| --- | --- |
| P4-0 監視イベント基盤 | マージ済み #41 |
| P4-2 就職差別・オワハラ検知 | マージ済み #42 |
| P4-3 送信前チェック | マージ済み #43 / #46 |
| P4-2b 正規表現＋LLM判定 | マージ済み #45 / #46 |
| P4-1 SLA監視・段階エスカレーション | マージ済み #47 |
| **P4-4 監視ダッシュボード** | **このPR** |

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #49 feat: ログイン→ホームの円形トランジションを追加

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/login-home-circle-transition` → `master`
- 作成: 2026-08-06T13:32:17Z / マージ: 2026-08-06T13:33:22Z
- 変更: +392 -3 (8 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/49

<details><summary>本文</summary>

## 概要

ログイン成功時に、ログイン画面のロゴの円（オレンジ部分）から画面全体を覆うように円を拡大し、覆っている間に裏側をホームへ差し替え、ナビレールのロゴの円へ収束させる画面転換を追加します。

要件IDのある機能ではなく、ログイン直後の体験を整えるための UI 変更です（既存の画面仕様・データには手を入れていません）。

## 変更内容

| ファイル | 役割 |
| --- | --- |
| `src/utils/logoMark.js`（新規） | ワードマーク画像内のオレンジの円の中心座標・半径を実測する |
| `src/composables/useCircleReveal.js`（新規） | 拡大 → 画面差し替え → 中心移動 → 収束の進行管理 |
| `src/components/CircleRevealOverlay.vue`（新規） | 円の描画のみ。ルート切替をまたぐため `App.vue` 直下（シェルの外）に置く |
| `src/stores/ui.js` | `circleReveal` の状態と `patchCircleReveal` / `resetCircleReveal` を追加 |
| `src/components/AuthLayout.vue` / `AppNavRail.vue` | ロゴ `<img>` に `data-logo-mark` の目印を付与 |
| `src/views/LoginView.vue` | 認証成功後、円で覆っている間に `router.replace` する |

## 実装上のポイント

- **座標はすべて `getBoundingClientRect()` から実測**。画像は 800×227 で円マークは左端の 227×227 なので、中心 = `left + width × (113.5/800)`、半径 = `height / 2`。ナビレールのロゴは `overflow:hidden` で右を切られているが、レイアウト矩形は切り取り前なので両画面で同じ式が使える。px の直書きは無いので、画面幅やレールの開閉が変わっても中心はずれない。
- **横滑り防止**：覆っている間に `transition: none` へ落とし、強制リフローでスタイルを確定させてから中心を差し替え、再度 transition を戻している。中心が変わると四隅までの距離も変わるため、倍率は移動前後の大きい方に合わせて画面の端が覗かないようにした。
- **拡縮は `transform: scale()` のみ**（`width`/`height` は触らない）。円には `pointer-events: none`、`will-change: transform` を付与。基準直径は 400px 固定（ロゴの 30px を基準にすると 80 倍拡大で輪郭がぼけ、画面対角の実寸だとレイヤが巨大になるため、拡大率が最大 5 倍程度に収まる中間値）。
- **イージング**：拡大 520ms `cubic-bezier(0.83, 0, 0.17, 1)`、収束 640ms `cubic-bezier(0.22, 1, 0.36, 1)`、着地後に 140ms のフェード（レールのロゴとの継ぎ目を消すため）。
- **フラグ管理**：`phase` は `idle → expanding → covered → collapsing → idle`。再生中の二重起動・ロゴ未検出・`prefers-reduced-motion: reduce` のいずれでも、アニメーションは諦めて遷移だけは必ず行う。`transitionend` はタイムアウトと競争させ、取りこぼしても止まらない。
- 進行は `requestAnimationFrame` ではなくタイマーで進める（裏に回ったタブではフレームが来ず、オレンジで覆ったまま固まるため。座標測定は `getBoundingClientRect()` が同期でレイアウトを走らせるので描画フレーム待ちは不要）。

## 確認したこと

- [x] ログイン画面のロゴの円と、拡大開始時の円が完全に一致する（中心 `(215.7, 336.4)` / 半径 `51.07` を実測して重なりをスクリーンショットで確認）
- [x] 画面が完全に覆われてから `/home` へ差し替わる（トレース：`expanding → covered → path が /home → 中心を差し替え`）
- [x] 中心の差し替えが `transition: none` の状態で行われ、円がスライドして見えない
- [x] ナビレールのロゴの円（中心 `(45, 40)` / 半径 `15`）へ収束し、円が DOM から取り除かれる
- [x] アニメーション完了後にホームが通常どおり操作できる／コンソールエラーなし
- [x] `npm run lint` が通る
- [x] `npm run build` が通る

## 補足

- ご指定どおり円に `pointer-events: none` を付けているため、被覆中（約 1.3 秒）のクリックは裏の画面に届きます。入力を塞ぎたい場合は別途ブロッカーを足せます。
- ログイン失敗時はエラーをログイン画面に出したいので、アニメーションは**認証が通ってから**開始します。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #50 feat(S-09/P2-11/S-10): 学生マイページの作り込みと選考メモの追加

- 状態: **merged** / 作成者: Jo042
- `feat/S-09-mypage-notes` → `master`
- 作成: 2026-08-06T14:47:16Z / マージ: 2026-08-06T21:36:08Z
- 変更: +1806 -199 (27 files, 12 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/50

<details><summary>本文</summary>

学生マイページ（S-09 / P2-11）の作り込みと、学生本人の選考メモ（S-10・新規要件）の追加です。
作業の途中で、FBの可視範囲まわりに**表示が事実と食い違うバグ**が2件見つかったので併せて直しています。

## 変更点

### 1. 会社情報の帯が読めなかった（S-09）

紹介文を `white-space: nowrap` + `ellipsis` で1行に切っていたため、本文がほぼ読めない状態でした。
上段に「社名｜採用サイトのリンク」、下段に紹介文を全幅で敷き、2行クランプ＋「もっと見る」で
その場に全文を開けるようにしています。溢れているときだけボタンを出します（`ResizeObserver` で実測）。

### 2. 選考ステップ詳細を2カラムに（P2-11）

説明・ポイント・FBを縦に積むだけの構成をやめ、**情報の性質で列を割りました**。

- 左：会社が全員に用意した「読むもの」（この選考について／ポイント）
- 右：その学生に固有の「受け取る・書くもの」（企業からのFB／自分のメモ）

ポイントは面で囲まずに行頭マーカーのリストとして組み、FBは左にオレンジの帯を持つカードにして
更新日を添えました。900px 以下では1カラムに畳みます。

### 3. 学生の選考メモ（S-10・新規要件）

学生がマイページで自分用のメモを書けるようにしました。粒度は2つです。

| 粒度 | 置き場 | 用途 |
| --- | --- | --- |
| ステップ別 | 詳細の右カラム | 逆質問の準備、面接の振り返り |
| 全体（`note_key='overall'`） | フローの下 | 志望動機の軸、企業研究 |

- **学生本人にしか見えません。** 人事向けの読み取り関数もエンドポイントも作っていません
- 保存は自動（入力停止800ms／blur／ステップ切替／画面離脱）。失敗しても入力中の本文は消しません
- 読みは `GET /selection-flow/me` に相乗りさせ、マイページの往復は1回のままです
- `note_key` を NULL 許容にしていないのは、SQLite の UNIQUE が NULL 同士を重複と見なさず、
  全体メモが学生1人につき何行でも作れてしまうためです

### 4. 現在地が図から消えてフローが直線になっていた（P2-11・バグ修正）

田中太郎さんは `selection_status = interview_2` ですが、会社のフロー設定で二次面接が
**無効**だったため、`current` のステップが1つも生まれず、山の頂点が決まらずに線がまっすぐに
なっていました。同じ原因で、**適性検査に書かれたFBが学生に一切届いていませんでした**。

会社の設定を「標準フロー」と捉え、**その学生の現在地とFBのあるステップは無効でも図に出す**
ようにしています（`listVisibleSteps()`）。人事があとから設定を変えても、進行中の学生の画面が
壊れません。

### 5. 人事の「本人には非公開」表示が嘘をついていた（P2-11・バグ修正）

人事パネルが可視範囲を自前で判定しており（有効ステップの中で現在地より前か）、
現在地が無効ステップにある学生で学生側とズレていました。

> 人事の画面：書類選考のFB →「本人には非公開」
> 学生の画面：同じFB → **表示されている**

さらに無効ステップの行は一覧に出ないため、**学生に見えているFBを人事が確認も取り消しも
できません**でした。評価の可視性に関わる表示なので、判定を `isFeedbackVisibleToStudent()` に
集約し、`GET /students/:userId/feedbacks` が学生側と同じ `listVisibleSteps` +
`resolveStepStates` を通した結果（`isVisibleToStudent`）を返すようにしています。
標準フローから外れた行にはその旨を注記します。

### 6. FBの到着をフロー図で知らせる（P2-11）

丸の右上の点しか手がかりがなく、凡例も言葉もないため意味が学習されませんでした。3層で伝えます。

| 層 | 内容 |
| --- | --- |
| 言葉 | 図の上の一文を動的に（「新しいフィードバックが2件届いています。」） |
| 図 | 未読＝塗り＋パルス、既読＝輪郭だけ |
| テキスト | 未読ノードのラベル下に「新着」（色と動きだけで伝えない） |

既読は `localStorage` に持ちます。人事がFBを書き直せば `updatedAt` が進んで自動的に未読へ戻ります。

### 7. マイページからチャットへの導線（S-09）

大元がチャットアプリなのに、着地点であるマイページからチャットへの入口がナビレールの1項目
だけで、**しかもそれが新着を知らせていませんでした**。ナビレールに未読バッジを追加し、
下段の全体メモの右にチャットカード（担当者名・最新メッセージの抜粋・未読件数）を置きました。
データは `GET /rooms` の既存フィールドで、専用APIは追加していません。

### 8. 体裁の調整

- 未読の一文をオレンジの本文から、濃さ＋図と同じ点による表現に変更
  （DESIGN.md「Don't use orange for body text」に反していたため）
- チャットカードをメモと同じ骨格（ラベル＋状態 → 中身）に揃え、2枚の底を揃える
- FB未着の点線枠を廃止（点線はこのシステムの他のどこにも無く、そこだけ浮いていた）
- 辞退してもチャットカードは残す（選考後こそ問い合わせ先が要る）

## テスト計画

- [x] `npm run lint` / `npm run build` / `npm run test:server`（26件）
- [x] 学生の現在地が `current` で返り、山が立つこと（`interview_2`）
- [x] 無効ステップ（`aptitude`）のFBが学生に届くこと
- [x] 人事の `isVisibleToStudent` と、学生に実際に届いているFBが一致すること（突き合わせ済み）
- [x] FBを書き直すと `updatedAt` が進むこと（既読が未読に戻る）
- [x] メモの保存・削除・文字数超過(400)・不正キー(400)・人事からのPUT(403)・未認証(401)
- [x] 別の学生に他人のメモが混ざらないこと
- [x] `student_notes` を読むのは学生専用エンドポイントだけであること（grep で確認）
- [ ] **見た目の確認（未実施）** — Playwright 未導入のため。`student1 / password123` で
      マイページを開き、パルス・2カラムの比率・未読バッジをご確認ください

## 既知の制約（このPRでは対応していません）

1. **`room:updated` が学生に配信されない。** サーバが `io.in('hr')` にしか送っていないため、
   学生のストアは socket では最新化されません。マイページを開くたび `fetchRooms()` を呼ぶことで
   回避しています（既読にして戻れば正しい件数になります）が、開きっぱなしでは更新されません。
2. **FBの既読は端末ローカル。** 別の端末で開くと未読からになります。FB本体はサーバが正なので
   読めなくなるわけではなく、このためにテーブルとAPIを増やす価値は薄いと判断しました。
3. **人事が未到達のステップにFBを書くと、そのステップが学生の図に現れます。**
   FB自体は `state !== done` なので学生に見えず、安全側に倒れています。人事側には
   「このステップは選考フローで無効です」と注記が出ます。
4. `shared/constants.js` と `server/db/schema.sql` を変更しています（コンフリクトしやすい共有
   ファイル）。マージ前に他のブランチとの兼ね合いをご確認ください。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #51 feat: P3-4 面接日程予約とAI推奨度表示を実装

- 状態: **merged** / 作成者: hinato150
- `codex/feat/P3-4-interview-scheduling` → `master`
- 作成: 2026-08-06T14:53:54Z / マージ: 2026-08-06T15:03:36Z
- 変更: +3266 -186 (60 files, 3 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/51

<details><summary>本文</summary>

## 概要

P3-4の面接日程予約フローを実装し、予約確定後に人事が次の対応へ進めるようにしました。あわせて、人事向けボードの優先表示をAI推奨度中心に整理しています。

## 変更内容

- 人事が候補日時を提示し、学生が空き枠を選択して予約を確定できる日程カードを追加
- 予約済み枠や既存予定との競合をサーバー側で再検証
- 日程確定後、人事だけに面接担当者への連絡・会議室決定を促す社内通知を表示
- 日程確定後の対応ステータスを「対応中」に維持
- 人事向け一覧・ボード・フィルターの優先度表示をAI推奨度に統一し、未判定時は既存の緊急度へフォールバック
- API・業務ロジック・画面仕様のドキュメントとテストを更新

## 目的・影響

学生はチャット内で面接日時を確定でき、人事は確定後に必要な社内調整を見落としにくくなります。また、対応一覧ではAI推奨度を基準に優先順位を判断できます。

## 検証

- `npm run test:server`（29件成功）
- `npm run build`
- `npm run lint`
- `git diff --check`

</details>

---

## #52 feat(S-09): 学生マイページに面接アンケート機能を追加

- 状態: **merged** / 作成者: takahasinoa114
- `frontend/questionnaire` → `master`
- 作成: 2026-08-06T15:26:44Z / マージ: 2026-08-06T15:27:46Z
- 変更: +408 -5 (5 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/52

<details><summary>本文</summary>

完了済みの面接ステップ（一次〜五次面接）が未回答のとき、選考フロー図の
アイコン右上に吹き出し型バッジを表示し、ステップ詳細エリアにアンケート
カード（5段階評価＋自由記述）を表示する。バッジクリックでカードまで
スムーズスクロールする。

★現時点ではフロントエンドのみのモック。バックエンド（永続化・API）は
未実装で、回答済み状態は StudentHomeView のローカル状態に置く
（リロードでリセットされる）。

frontend.md §7-3 に仕様を追記、§9 のコンポーネント表に InterviewSurveyCard.vue を追加。

</details>

---

## #53 feat(P4-1b): 通知の解消をリアルタイム配信し、通知機能を完成させる

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-1b-notification-delivery` → `master`
- 作成: 2026-08-06T23:09:28Z / マージ: 2026-08-06T23:21:06Z
- 変更: +277 -21 (12 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/53

<details><summary>本文</summary>

## 概要

P4-1 は「通知を**作る**」ところまでで、「作った通知が**その後どうなるか**」が欠けていました。
通知は作られた瞬間より、**片付いたときに消えること**のほうが重要です。消えなければ一覧が過去の残骸で埋まり、「上から処理すれば終わる」というコンセプトが崩れます。

### 直した5点

| # | 症状 | 原因 |
| --- | --- | --- |
| 1 | 返信して片付いた通知が一覧から消えず、未読バッジも減らない（リロードするまで） | `resolved_at` を更新するだけで配信イベントが無かった |
| 2 | 通知が届いても気づけない（ベルの数字が静かに増えるだけ） | `receiveAlert` がトーストを出していなかった |
| 3 | 切断中に作られた／解消された通知を取りこぼし、バッジが古いまま | `connect` 時に件数を数え直していなかった |
| 4 | 解消済みを後から見返せない | API は `includeResolved` 対応済みなのに UI から使えなかった |
| 5 | 学生ロールでも `GET /api/alerts` が叩けた | `requireHr` が無かった |

## 受入条件

- [x] 人事が返信すると、担当者と上長の**開いている画面から**その通知が消え、ベルの未読件数も同時に減る（リロード不要）
- [x] 通知が届くとトーストが出る。通知画面を開いていなくても気づける
- [x] socket を切って再接続すると、切断中の増減が反映された件数になる
- [x] 「未対応」／「すべて（解消済みを含む）」を切り替えられる。解消済みの行には**テキストで**「解消済み」が付く
- [x] 学生アカウントで `GET /api/alerts` を叩くと 403

## 設計上の判断

- **`unreadCount` を配信ペイロードに添える。** 通知一覧を一度も開いていない画面には `alerts` が空のまま件数だけが載っているので、クライアント側で減算するとベルの数字だけが実態とずれます
- **配信はコミット後。** トランザクション内で送ると、ロールバック時に相手の画面からだけ通知が消えて復活しません。`insertMessage` が `io` を受け取り、`run()` の直後に配信します
- `resolveSlaAlerts` は件数ではなく**閉じた行**を返します。宛先が分からないと誰に配信するか決められないためです

## 確認方法

```bash
npm run lint && node --test server/**/*.test.js
```

- テスト 104件パス（`slaMonitor.test.js` に宛先が返ることの検証を追加）
- 2ブラウザ（人事・学生）で動作確認済み。返信時にバッジが 3→2 に減ることを実機で確認

## Definition of Done

- [x] 列挙値を `shared/constants.js` から import している
- [x] サーバ側で認可チェック（`target_user_id` の検証）を行っている
- [x] SQL がプレースホルダになっている
- [x] `v-html` を使っていない
- [x] Socket イベントのハンドラが `useSocket.js` に集約されている
- [x] `npm run lint` が通る
- [x] リロードしても壊れない

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #54 feat(P4-5): 面接の会議室が未設定なら担当者へ通知する

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-5-interview-room-alert` → `feat/P4-1b-notification-delivery`
- 作成: 2026-08-06T23:10:03Z / マージ: 2026-08-06T23:21:16Z
- 変更: +756 -14 (12 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/54

<details><summary>本文</summary>

## 概要

面接日程は決まっているのに `students.next_interview_room` が空欄、という状態を検出して担当者へ通知します。当日「部屋がない」が起きるうえ、`{会議室}` を含む定型文（P2-2）が埋まらないので学生への案内も打てません。課題 C-5（日程調整の進捗が不透明）の穴を塞ぎます。

> **このPRは #53 の上に積んでいます。** #53 を先にマージしてください（マージ後、baseは自動で master に切り替わります）。

## 受入条件

- [x] 面接日時が設定済みで会議室が空欄の学生について、担当者へ通知が1件だけ作られる（60秒ごとに増えない）
- [x] 会議室を入力すると通知が解消され、**リロードせずに**一覧から消える
- [x] 面接日時を変更すると、古い通知は解消され、新しい日時で改めて1件作られる
- [x] 面接日時を消した／面接が過ぎた通知は解消される
- [x] 未アサインのルームは上長全員へ通知される
- [x] 辞退した学生には通知しない
- [x] 面接まで `INTERVIEW_ROOM_ALERT_LEAD_HOURS`（既定72時間）より先の面接では通知しない
- [x] 会議室が空白文字だけのときも「未設定」として扱う

## 設計上の判断

- **冪等キーに `trigger_message_id` を使えない。** この通知に起点メッセージは無く常に NULL になりますが、SQLite の UNIQUE は NULL を互いに異なる値として扱うため重複を弾けません（P4-0 で実測済みの罠）。代わりに `rule_code` に**面接日時**を入れます。副作用として**日程が変われば正しく再通知**されます
- **`schedule_state='room_pending'`（P3-4）で判定しない。** あれは人事が手で進める値で、手が回っていないときにこそ立っていません。監視は**実データ（日時と会議室名）**を見ます
- **解消は即時、検知は60秒タイマー。** 人事は「日時を入れる → 会議室を入れる」の順で操作するので、日時の保存時点で即座に検知すると**入力途中で自分に通知が飛びます**。60秒の間隔がそのまま猶予として働きます
- **面接が過ぎた通知も閉じる。** いま会議室を押さえても手遅れで、押しても何もできない通知を一覧に残さないためです
- **上長エスカレーションは設けない。** 会議室の押さえ漏れは担当者が気づけば5秒で終わる作業で、上長を巻き込む筋の話ではありません

## マイグレーション ★確認してほしい点

`alerts.kind` の CHECK 制約に値を足すため、既存DBでは**テーブルを作り直します**（`server/db/migrate.js`）。`compliance_rules` と違い通知の履歴なので**データは移送**します。

実測で確認済み:
- 既存13件を保持したまま適用でき、UNIQUE索引6本も再作成される
- 再実行しても no-op

```bash
npm run db:migrate && npm run db:seed
```

## 確認方法

- テスト 104件パス（`interviewRoomMonitor.test.js` 14件を追加。境界・冪等性・宛先・解消の各条件）
- 実機：受信箱で会議室を入力するとリロードなしでベルが 3→2 に減ることを確認
- デモ用シード：`student12`（hr1担当・26時間後）と `student3`（未アサイン・40時間後→上長直行）

## Definition of Done

- [x] 列挙値を `shared/constants.js` から import している
- [x] サーバ側で認可チェックを行っている
- [x] SQL がプレースホルダになっている
- [x] `v-html` を使っていない
- [x] `npm run lint` が通る
- [x] リロードしても壊れない

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

**コメント — Kousuke-irie**

## master（P3-4 日程調整）取り込み後の追記

コンフリクト解消のため `origin/master` を取り込みました。あわせて**P3-4 との組み合わせ**を確認しています。

### 意図せず良い形で噛み合いました

`scheduleBookingService.js` は日程確定時に `students.next_interview_room` へ `location_text` を書き込み、システムメッセージで

> 日程が確定しました（…）。面接担当の方に連絡し、**会議室を決定してください**。

と促しています。会議室が未定（`location_text` が NULL）のまま確定した面接は、このPRの監視が拾って担当者へ通知します。**上のメッセージのフォローアップが自動化される**形です。

### 1点だけ master のコードに手を入れています

`server/index.js` の60秒タイマーで、日程依頼の期限監視が

```js
const expired = expireWaitingScheduleRequests(db);
if (expired.length === 0) return;   // ← このタイマーのコールバック自体を抜ける
```

となっていました。このPRは同じタイマーに監視をもう1つ載せるため、**この `return` の後ろに処理を足すと黙って飛ばされます**。振る舞いを変えずに `if (expired.length > 0) { ... }` へ書き換え、コメントを添えました。処理順は SLA → 会議室 → 日程期限 です。

---

## #55 feat(P4-6): 通知を右上のバナーで知らせ、接続時に溜まった分をまとめる

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-6-notification-banner` → `feat/P4-5-interview-room-alert`
- 作成: 2026-08-06T23:10:29Z / マージ: 2026-08-06T23:21:30Z
- 変更: +312 -33 (10 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/55

<details><summary>本文</summary>

## 概要

通知は**作られた瞬間に気づけないと意味がありません**。#53 でトーストを出すようにしましたが、右下に本文1行が出るだけで、画面を見ていても通知だと分かりませんでした。

> **このPRは #54 の上に積んでいます。** #53 → #54 の順にマージしてください。

## 受入条件

- [x] 新着通知が**画面右上**にバナーで出る。見出し（種別＋学生名）と本文の2段
- [x] バナーをクリックすると該当画面が開き、バナーは閉じる
- [x] 上長エスカレーションのバナーは強調され、**「重要」のテキストラベル**が付く（色だけに頼らない）
- [x] 6秒で自動的に消える。× で即座に閉じられる
- [x] ログイン直後、未読があれば「未読の通知が N 件あります」が出る
- [x] 再接続時は**増えた分があるときだけ**「N 件増えました（未読 M 件）」が出る。変化が無ければ出さない
- [x] 再接続を繰り返してもまとめバナーは1枚しか残らない

## 設計上の判断

- **バナーは右上に置く。** 受信箱の左（一覧）・下（入力欄）は操作中の視線が乗ります。以前の右下は AI ランチャー（右下の丸ボタン）を避けるための位置で、通知としては目に入りませんでした
- **遷移先を `auth` ストアのロールから決めない。** 通知の `kind` が読者を一意に決めるので `src/utils/alertLink.js` で kind から引きます。ストアの循環 import（auth → ui → auth）も避けられます
- **強調する kind は `IMPORTANT_ALERT_KINDS`（現状 `sla_escalate` のみ）。** 増やすと強調の意味が薄まるので、「すでに手遅れになりかけているもの」だけに限ります
- 接続時のまとめは `unreadCount` / `unreadImportantCount` だけを見ます。一覧は取り直しません（`alerts` を未読だけで上書きすると通知画面の表示が壊れる）

## 実測で1つ直しました ★

シード直後は60秒タイマーが**一度に5件**通知を作り、バナーが画面の右側を埋めて操作できなくなりました。同時表示を**3枚**に制限しています（`MAX_TOASTS`）。5件到着時に最大3枚しか出ないことを実機で確認済みです。

## 互換性

`pushToast` の引数を拡張しましたが、既存の `{ type, message }` 呼び出し（約20箇所）はそのまま動きます。`title` を省略すると従来どおり本文1段で表示されます。

## 確認方法

- テスト 104件パス（既存のまま）／`npm run lint` 通過
- 実機：admin1 でログイン → 右上に `通知（重要なものがあります）＋重要` バナー。クリックで `/notifications` へ遷移

## Definition of Done

- [x] 列挙値を `shared/constants.js` から import している
- [x] `v-html` を使っていない
- [x] Socket イベントのハンドラが `useSocket.js` に集約されている
- [x] 色だけで意味を表現していない（「重要」ラベルを併記）
- [x] `npm run lint` が通る
- [x] リロードしても壊れない

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #56 feat(P4-7): 学生本人へ選考の進行とFBの公開を通知する

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-7-student-notifications` → `feat/P4-6-notification-banner`
- 作成: 2026-08-06T23:11:07Z / マージ: 2026-08-06T23:21:39Z
- 変更: +1001 -82 (20 files, 2 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/56

<details><summary>本文</summary>

## 概要

これまで通知は人事の監視イベントだけで、学生は「選考が進んだ」「FBが載った」を**マイページを開き直すまで知れませんでした**。学生本人への通知を追加します。

`alerts` テーブルは**共用**し（決定事項9「監視イベントは1テーブルに集約する」を維持）、混ざらないようロジックで制御します。

> **このPRは #55 の上に積んでいます。** #53 → #54 → #55 の順にマージしてください。

## 受入条件

- [x] 人事が選考ステータスを進めると、学生本人に通知が1件だけ届く（同じ段階で2回は届かない）
- [x] ステータスを**戻した**とき・辞退を登録したときは通知しない
- [x] FBは**本人に見える状態（完了済みステップ）になったときだけ**通知する
- [x] FBを先に書いてから該当ステップが完了した場合も、完了時に通知される
- [x] 学生のナビレールにベルが出て、`/notifications` に自分のお知らせだけが並ぶ
- [x] **学生に人事の監視イベントは1件も返らない。** 宛先を取り違えた行があっても返らない
- [x] 学生向けの通知に学生氏名・担当人事名が載らない

## ★ 読者の分離（レビューの要点）

分離は次の3点**だけ**で行っています。

| # | 場所 | 役割 |
| --- | --- | --- |
| 1 | `shared/constants.js` の `ALERT_KIND_AUDIENCE` | **単一の情報源。** kind ごとに読者（`hr` / `student`）を定める |
| 2 | `server/services/alertView.js` の `AUDIENCE_SQL` | **実効的な壁。** 全読み出しで `users.role` と kind を突き合わせる |
| 3 | `server/services/studentNotifier.js` | 学生向けの kind を、学生本人宛にだけ作る |

- **ルート層（`routes/alerts.js`）でロール分岐しない。** 壁が2箇所に散ると、片方の更新漏れで漏洩します。ルートは `requireAuth` だけを見ます
- **壁は既読化（UPDATE）にも掛けています。** 読めない通知を既読にできる状態は、壁が半分しかないのと同じです
- `ALERT_KIND_AUDIENCE` に無い kind は**どちらにも返りません**（安全側に倒す）。★kind を足したら必ずこの表にも足してください
- テスト `server/services/alertView.test.js` は、**意図的に宛先を取り違えた行を直接 INSERT** して、それでも返らないことを確認しています

## 通知するタイミング

| 出来事 | 呼び出し位置 | 冪等キー（`rule_code`） |
| --- | --- | --- |
| 選考が進んだ | `PATCH /students/:userId` | 到達した選考ステップ |
| FBが見える状態になった | `PUT /students/:userId/feedbacks/:statusKey` と `PATCH /students/:userId` の両方 | ステップ |

- 「進んだ」の判定は `SELECTION_FLOW_STEP_VALUES`（進行順）での位置の比較。**戻したときは通知しません**（打ち間違いの訂正で「進みました」が飛ぶのを避ける）
- **FBの可視判定は `buildStudentFlow` を再利用します。** マイページが実際に返しているものと同じ関数なので、「完了済みステップだけ」という約束が二重管理になりません。進行中のステップに書いたFBを通知すると、合否連絡より先に本人へ漏れます
- 文面は**合否を断定しません**。「一次面接に合格しました」と書くと、ステータスの付け替えが合否通知そのものになります。正式な連絡は人事がチャットで行うものです
- ステップ名は人事が設定した表示名（`selection_steps.label`）を使い、学生が見ている呼び名に合わせます

## マイグレーション

`alerts.kind` の CHECK にさらに2値を足すため、既存DBでは再度テーブルを作り直します（データは移送）。判定を**`ALERT_KIND_VALUES` の全件照合**に変えたので、今後 kind を足しても目印の更新漏れで静かに壊れません。実測で13件を保持・索引7本の再作成・再実行 no-op を確認済みです。

## 確認方法

```bash
npm run lint && node --test server/**/*.test.js && npm run build
```

- テスト **118件パス**（`studentNotifier.test.js` 6件、`alertView.test.js` 8件を追加）
- 実機：
  - student1 でログイン → ベル3件、「お知らせ」に選考進行1件＋FB公開2件（氏名・担当者名なし）、行クリックで `/mypage`
  - hr1 の資格で `PATCH /students/:id` → 学生宛に通知が作られ、**戻すと作られない**ことをAPI経由で確認
  - 学生の資格で `GET /api/alerts` → 学生向け2種のみ、`unreadImportantCount: 0`
- デモ用シードは**本番と同じサービス関数**で作っています（手書きINSERTだと可視条件がシードと本番で食い違うため）

## Definition of Done

- [x] 列挙値を `shared/constants.js` から import している
- [x] サーバ側で認可チェックを行っている（宛先＋読者の二重）
- [x] SQL がプレースホルダになっている
- [x] `v-html` を使っていない
- [x] Socket イベントのハンドラが `useSocket.js` に集約されている
- [x] `npm run lint` が通る
- [x] 2ブラウザ（人事・学生）で動作確認した
- [x] リロードしても壊れない

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #57 feat(P4-5/P4-6/P4-7): master へ届いていない通知機能3件を回収する

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-5-P4-7-notification-integration` → `master`
- 作成: 2026-08-06T23:29:57Z / マージ: 2026-08-06T23:30:57Z
- 変更: +2036 -96 (24 files, 8 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/57

<details><summary>本文</summary>

## このPRの目的

**マージ済みなのに master へ届いていない3要件を回収します。** 新しい実装は含まれていません。中身は #54 / #55 / #56 でレビュー・マージ済みのものと同一です。

## なぜ届かなかったか

スタックPRを **33秒の間に連続マージ**したためです。各PRは親ブランチが base なので、親が先に master へ入ってしまうと、後から親ブランチへマージされた内容は master へ流れません。

```
23:21:06  #53 → master                    ← master はここで確定
23:21:16  #54 → feat/P4-1b-notification-delivery
23:21:30  #55 → feat/P4-5-interview-room-alert
23:21:39  #56 → feat/P4-6-notification-banner
```

GitHub の自動リターゲット（子PRの base を master へ繰り上げる）は **base ブランチが削除されたときだけ**働くため、今回は発動しませんでした。結果、master には #53（P4-1b）だけが入っています。

> **次にスタックPRを出すときは、親PRのマージ時に「Delete branch」を押してください。** そうすれば子PRの base が master へ自動で繰り上がります。

## 含まれる要件

| 要件 | 元PR | 内容 |
| --- | --- | --- |
| **P4-5** | #54 | 面接の会議室が未設定なら担当者へ通知する |
| **P4-6** | #55 | 通知を右上のバナーで知らせ、接続時に溜まった分をまとめる |
| **P4-7** | #56 | 学生本人へ選考の進行とFBの公開を通知する（読者の分離つき） |

差分は 24ファイル / +2,036 / −96 です。

## レビューのポイント（再掲）

すでに各PRで確認済みですが、master へ入る時点で見ておきたい2点だけ再掲します。

1. **`alerts` の CHECK 制約を作り直すマイグレーション**（`server/db/migrate.js`）
   既存DBはテーブルごと作り直しますが、**通知の履歴はデータを移送**します。判定は `ALERT_KIND_VALUES` の全件照合なので、今後 kind を足しても目印の更新漏れで静かに壊れません。
2. **読者の分離**（P4-7）
   `alerts` は人事の監視イベントと学生向けのお知らせを共用します。混ざらない保証は `ALERT_KIND_AUDIENCE`（定義）と `server/services/alertView.js`（全読み出し＋既読化での突き合わせ）の2点だけに集約してあります。**ルート層ではロール分岐しません。**

## 確認

```bash
npm run lint && node --test server/**/*.test.js && npm run build
npm run db:migrate && npm run db:seed
```

- `npm run lint` 通過
- テスト **121件すべてパス**
- `npm run build` 成功
- `npm run db:migrate` を最新 master 込みの状態で再適用し、既存アラート18件と索引7本が保持されることを確認
- `origin/master` を取り込み済み。**コンフリクトなし**

## マージ後のお願い

この4本はもう不要なので削除してください。

- `feat/P4-1b-notification-delivery`
- `feat/P4-5-interview-room-alert`
- `feat/P4-6-notification-banner`
- `feat/P4-7-student-notifications`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #58 通知ペットのらくす君を追加

- 状態: **merged** / 作成者: hinato150
- `feature/rakusukun-pet` → `master`
- 作成: 2026-08-07T01:16:21Z / マージ: 2026-08-07T01:16:31Z
- 変更: +737 -0 (11 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/58

---

## #59 fix(S-10): seed の初期化対象に student_notes を追加

- 状態: **merged** / 作成者: Jo042
- `fix/S-10-seed-student-notes` → `master`
- 作成: 2026-08-07T01:18:15Z / マージ: 2026-08-07T01:18:33Z
- 変更: +1 -1 (1 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/59

<details><summary>本文</summary>

`npm run db:seed` が **`SQLITE_CONSTRAINT_FOREIGNKEY` で失敗する**バグの修正です。

## 症状

学生メモ（S-10）が1件でも存在すると、seed が必ず落ちます。

```
SqliteError: FOREIGN KEY constraint failed
    at clearExistingData (server/db/seed.js:793:40)
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
```

## 原因

`student_notes` は `users(id)` を参照していますが、`clearExistingData()` の削除対象一覧から
漏れていました。`db/index.js:7` で `foreign_keys = ON` にしているため、
`DELETE FROM users` が `student_notes` からの参照に阻まれます。

私が S-10 でテーブルを追加したときの登録漏れです。`selection_feedbacks` は
既に一覧に入っていたので、同じ扱いに揃えました。

## 変更

削除対象の配列に `student_notes` を追加。外部キーの依存順に合わせ、`students` / `users` より
前（`selection_feedbacks` の隣）に置いています。

## 影響

トランザクション内で落ちていたためロールバックされ、DB が壊れることはありませんでした。
ただし **seed をやり直せない**状態だったので、デモデータを初期化したい場面で詰まります。

## テスト計画

- [x] 修正前：`npm run db:seed` が `SQLITE_CONSTRAINT_FOREIGNKEY` で失敗することを再現
- [x] 修正前：失敗後もロールバックにより users 43件 / messages 326件 / student_notes 2件が無傷
- [x] 修正後：`npm run db:seed` が正常終了
- [x] seed 後に `student_notes` が0件（孤児レコードが残らない）
- [x] `npm run lint` / `npm run test:server`（93件）
- [x] エンドポイント疎通：学生 `/selection-flow/me` `/rooms` `PUT /student-notes/:key`、
      人事 `/students/:id/feedbacks` `/alerts` `/dashboard` `/calendar/interviewers` `/summary` すべて200

## 補足：面接アンケートが表示されない件について

seed をやり直すと、選考フロー設定が初期値（一次・二次面接が有効）に戻ります。
田中さん（student1）は二次面接中なので**一次面接が `done`** になり、面接アンケートの
表示条件（完了済みの面接ステップ）を満たすようになります。

アンケートが見えなくなっていたのは、DB の選考フロー設定で一次・二次面接が無効化されており、
`done` の面接ステップが1件も無かったためでした。コード側の不具合ではありません。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #60 feat(P4-8): 個人ダッシュボードを追加し、選考フロー設定と営業時間にシードを合わせる

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P4-8-personal-dashboard` → `master`
- 作成: 2026-08-07T02:00:51Z / マージ: 2026-08-07T02:02:07Z
- 変更: +3153 -578 (19 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/60

<details><summary>本文</summary>

## 概要

監視ダッシュボード（`/dashboard`）に **「全社／個人」のタブ**を追加します。

全社（P4-4）が「取りこぼしが**どこに**あるか」を探す画面なのに対し、個人（P4-8）は「**自分の持ち分**がいまどうなっているか」を見る画面です。母数を担当者1人ぶん（`rooms.assignee_user_id`）に絞って集計します。

あわせて、選考ステータス別グラフを**選考フロー設定に従わせる**修正と、**シードデータの作り直し**を含みます。

### 置き場所をタブにした理由

| 案 | 判定 |
| --- | --- |
| **ダッシュボードのタブ**（採用） | 全社と個人は同じ指標を違う母数で見るもので、**行き来しながら比べる**のが本来の使い方。URL が同じなら往復が1クリックで済む。chart.js の遅延読み込み（`/dashboard` 単位）もそのまま効く |
| ホーム（S-07）のタブ | ✗ ホームは「返信すべき学生が上から順に並ぶ」板。分析を混ぜるとコンセプトが濁る。chart.js が初期バンドルに載り、遅延読み込みの決定を壊す |
| 新規ページ＋ナビレール追加 | ✗ ほぼ同義の選択肢が2つ並び、毎回選ばせることになる。チャンクも二重 |

担当者は切り替えられます。全社タブで担当者別の遵守率を全員に見せているのと同じ理由（**相互監視**・`monitoring.md` §6）で、ここだけ本人限定にはしていません。

---

## 変更内容

### 1. 個人ダッシュボード（P4-8）

`GET /api/dashboard/personal?assigneeId=`（`requireHr`・省略時は自分・人事以外の id は404）

| パネル | 形式 |
| --- | --- |
| KPI | 担当学生／要返信／24時間超の未返信／返信中央値 |
| 対応ステータスの構成比 | ドーナツ（5分類） |
| AI推奨度の構成比 | ドーナツ（3分類） |
| 返信状況の構成比 | ドーナツ（3分類） |
| 選考ステータス別 担当学生数 | 横棒 |
| 返信にかかった時間の分布 | 縦棒ヒストグラム |
| 時間帯別の送信タイミング | 折れ線2系列（各系列内の構成比） |

**「返信状況」は対応ステータスとは独立の軸**です。対応ステータスは人が付けるので「対応中のまま2日放置」が起こりえますが、返信状況は「学生の最後の発言に返したか」を時刻だけから機械的に決めるため、その放置が必ず出ます。

**返信所要時間は学生の連続発言の *先頭* から測ります。** 学生が3通続けて送って6時間後に返した場合、学生が待った体感は最後の1通からではなく最初の1通からの時間だからです。中央値を主役にし、平均は併記に留めています（夜間・週末をまたいだ数件で平均は簡単に跳ねるため）。

**時間帯別はサーバが UTC で返し、クライアントが表示時にローカルへ回します**（CLAUDE.md §6-2）。整数時間オフセットなので配列の回転で無損失です。

`services/effectivePriority.js` を切り出し、AI推奨度の実効値SQLを `roomView.js`（受信箱）と共有しています。★片方だけ直すと「受信箱では高なのにグラフでは通常」という食い違いが出ます。

### 2. 選考ステータス別グラフを選考フロー設定に従わせる

使っていない段階（四次・五次面接）が空の段として並んでいました。`selection_steps`（P2-11）の**有効・並び順・表示名**に従うようにします（`listDashboardSelectionSteps()` を全社・個人で共通利用）。

**無効な段階でも学生が実在するなら「（フロー対象外）」として出します。** `listVisibleSteps()` が学生の現在地を必ず含めるのと同じ理由で、「フロー設定を変えただけで進行中の学生が消える」状態を作らないためです。消すとグラフの合計が学生数と合わなくなり、数字そのものが信用されなくなります。

### 3. シードデータ

ダッシュボードは**シードの質がそのまま画面の説得力**になるため、グラフが成立する条件を満たすように作り替えました。

- 学生の選考ステータスをフローで有効な段階だけに揃える（初期状態でフロー外の在籍者ゼロ）
- **人事の送信を営業時間（9:00〜21:00）内に収める。** 従来は `hoursAgo` をそのまま時刻にしていたため、流した時刻しだいで人事が深夜3時に返信していました
- 学生は4種類の生活リズムに寄せる（深夜2〜5時は除く）
- ルームごとに**折り返しの速さ**を配る。一律3時間固定では所要時間の分布が1本の棒にしかなりませんでした
- **過去の監視イベントを投入。** `detectSlaBreaches()` はいまこの瞬間の滞留しか作れないので、推移グラフは必ず今日1本の棒になっていました

実装のポイントは**新しいメッセージから逆向きに時刻を決める**ことです。調整は必ず過去方向にしか動かさないので、並び順が壊れず、最新メッセージが「今」を追い越しません。

### 4. 配色（`dataviz` の検証スクリプトで実測）

| パレット | 用途 | 結果 |
| --- | --- | --- |
| `#D03B3B, #C98500, #3B7FC4, #2F8F5B, #4a3aa7` | 対応ステータス5分類 | **PASS**（隣接・この並び順で）。最悪 CVD ΔE 10.2 ／ 通常視 16.9 |
| 同上（`--pairs all`） | — | **FAIL**。要返信(赤)↔完了(緑) が CVD ΔE 5.2 |
| `#D03B3B, #C98500, #3B7FC4` | AI推奨度・返信状況 | **PASS**（全ペア） |
| SLA の3色（緑橙赤） | 3分類ドーナツへの流用 | **FAIL**。3ペアすべてが隣接し緑と赤が必ず接する → 緑を青に置換 |
| `#3B7FC4, #C98500` | 時間帯別2系列 | **PASS**（全ペア） |

> ⚠️ 上表の FAIL のため、**ドーナツの凡例に件数と割合を必ず出しています**（`ChartPanel` の `legend[].value`）。装飾ではなく検証FAILの補償なので外さないでください。折れ線は色に加えて**線種（実線／破線）と点の形（丸／三角）**でも区別しています。

`monitoring.md` §10 の非採用案「対応ステータスの内訳を円グラフで出す」は、**円ではなくドーナツにする／チップ色を流用せず検証済みの5色を起こす**の2条件つきで撤回しました。条件を外すなら不採用のままです。

---

## 受入条件（Definition of Done・workflow.md §6）

- [x] 列挙値を `shared/constants.js` から import している（文字列リテラル直書きなし）
- [x] サーバ側で認可チェックを行っている（`requireHr` ＋ ルーターの `meta.roles`）
- [x] SQL がプレースホルダになっている
- [x] `v-html` を使っていない
- [x] Socket イベントを追加していない（このPRはリアルタイム更新なし）
- [x] `npm run lint` が通る
- [x] `npm run test:server` が通る（135件・うち新規11件）
- [x] `npm run build` が通る。chart.js は `/dashboard` の遅延チャンクに留まる（70.6KB gzip）
- [x] リロードしても壊れない（タブ状態は `?scope=` に保持）
- [x] ブラウザで全社／個人の両タブ・担当者切り替え・「表で見る」を動作確認

### 実機確認した結果

- 営業時間外の人事送信：**0件**／深夜2〜5時の学生送信：11件（162件中・7%）
- 時間帯グラフ：人事は17〜18時ピーク、学生は6〜7時ピーク。**ずれが読める**
- 返信所要時間：全6バケットが埋まり、担当者ごとに中央値が異なる（4.2h／5.7h／7.0h）
- 発生推移：14日間にばらけて表示。コンプラ内訳：7ルール（うちAI検知2件）、警告を無視して送信2件
- `student11`（50時間経過→上長エスカレーション）など P4-1／P4-5 のデモ用の作り込みは維持
- シードは2回流しても同じ結果（決定性を維持）

---

## レビューで見てほしい点

1. **「返信状況」の3分類の定義**が、対応ステータスと重複せず意味を持っているか
2. **フロー外の段階を「（フロー対象外）」として残す判断**（消して合計をずらすより良いか）
3. **営業時間を時刻のみで実装し、曜日を考慮していない**こと。平日限定にすると金曜夜→月曜朝の長い待ち時間が生まれ、所要時間の分布はさらに現実的になります。必要なら追加します

## 注意

`shared/constants.js` と `server/db/seed.js` は**コンフリクトしやすい共有ファイル**（workflow.md §4）です。マージ前に他のPRとの兼ね合いをご確認ください。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #61 feat(S-11): 面接アンケートの保存と面接官別ダッシュボード

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/S-11-interview-survey` → `master`
- 作成: 2026-08-07T02:54:14Z / マージ: 2026-08-07T02:54:49Z
- 変更: +2092 -54 (25 files, 4 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/61

<details><summary>本文</summary>

学生が面接後に答えるアンケート（★5段階＋自由記述）をDBに保存し、人事が**面接官別**に読めるようにします。

学生側のカード（`InterviewSurveyCard.vue`）は S-09 でUIだけ作られていて、送信は `console.info` するだけのモックでした。ここを実送信に変え、人事側の閲覧画面を新設します。

> **要件IDについて**：`S-11` はこの実装で新たに採番したもので、`.claude/requirements.md` にはまだ項目がありません。マージ方針が決まったら追記します（下の「残作業」参照）。

---

## 1. 人事のダッシュボードとは別ページにしています

`/dashboard`（監視ダッシュボード）に足すのではなく、`/interviews` を新設してナビレールに項目を追加しました。

| | `/dashboard`（P4-4 / P4-8） | `/interviews`（このPR） |
| --- | --- | --- |
| 主語 | **人事**の対応品質 | **面接官**の面接品質 |
| 母数 | ルーム・通知 | 学生の回答 |
| 次の行動 | 取りこぼしを拾う | 面接官へのFB・研修 |

監視ダッシュボードのKPIは「要返信／24h超／48h超／今週の警告」で、画面全体が一貫して「人事の対応に取りこぼしがないか」を問うています。ここに面接官の評価を混ぜると1画面の問いが二重になるため分けました。

chart.js は両ページが共有する `src/plugins/charts.js` ごと共通チャンクに出るので、バンドルは増えていません（`ChartPanel-*.js` 184KB を両者が共有）。

## 2. ★匿名性がこの機能の生死を分けます

カードに「**回答内容は選考の合否には一切影響しません**」と書いて集めている以上、人事が回答者を特定できると分かった時点で学生は忖度して書き、データ自体が無価値になります。`student_notes`（S-10）の「人事向けの読み取り経路を作らない」と同じ思想です。

- 人事向けレスポンスに `student_user_id` も**回答日時も**載せない（面接日程と突き合わせると回答者が割れるため）
- 回答が `INTERVIEW_SURVEY_MIN_SAMPLE`（3件）に満たない面接官は、個別の行にせず自由記述も返さない
- **絞り込みは必ずサーバ側**。全件をクライアントへ渡してドロップダウンで絞る作りにすると、通信内容の時点で下限が破れています（エンドポイントを3本に割っているのはこのため）
- 伏せた件数は画面に明示。数字が合わないと集計そのものが信用されなくなるので

残る限界として、全体平均と各面接官の平均から伏せた面接官の**平均は逆算できます**。面接官が少ないうちは避けられません。守るべき本丸は自由記述（誰が何を書いたか）で、そちらは確実に落としています（`services/interviewSurveys.js` のコメントに明記）。

## 3. 「学生Xの第N次面接を誰が担当したか」を保持する仕組みがありませんでした

- `students.interviewer` は**次回**面接官の氏名（TEXT）で、面接のたびに上書きされる
- `schedule_requests.selection_stage` は人事が自由に書ける表示名（「2次」「二次面接（役員）」等）で、ステップと対応づけられない

そこで `schedule_requests.selection_status_key`（`SELECTION_STATUS` のキー・nullable）を追加し、予約確定済みの依頼から面接官を引けるようにしました。既存の自由入力テキストへの依存という以前からの脆さも、あわせて解消しています。

アンケート側の `interviewer_id` は**参照ではなく回答時点のスナップショット**です。あとから日程や担当が変わっても過去の評価を書き換えないため。特定できなければ `NULL`（「面接官不明」に集約）で、**推測で埋めません**。

---

## 変更点

### DB（`schema.sql` / `migrate.js`）
- `interview_surveys` を追加（学生1名×面接ステップで1件・`UNIQUE`・上書き不可なので `updated_at` を持たない）
- `schedule_requests.selection_status_key` を追加。既存DB向けに `migrate.js` で `ALTER`（インデックス作成より前に実行）

### サーバ
- `services/interviewSurveys.js` … 保存・面接官の解決・匿名集計。回答可否の判定は `selectionFlow.resolveStepStates` に通す
- `services/interviewSurveyAi.js` … 自由記述のGemini要約。`services/aiSummary.js`（P3-1a）と同じ構造。外部へ送るのは**本文と★だけ**
- `POST /api/selection-flow/me/surveys`（学生）／`GET /api/interview-surveys{,/comments,/ai-summary}`（人事のみ）
- `GET /selection-flow/me` の各ステップに `surveyAnswered` を追加

### クライアント
- `InterviewSurveyCard.vue` … モック送信を実APIに置換。回答済み状態は**サーバ由来**にした（従来はローカル `Set` でリロードすると未回答に戻り、同じ学生に何度も答えさせていた）
- `views/InterviewSurveysView.vue` … KPI／面接官別の横棒／ドロップダウンで切り替わるAI要約＋匿名の原文

### seed
- 面接官を3名→5名に増やし、傾向差をつけた回答を投入。1名だけ2件で止めて**匿名性の下限で伏せられる挙動**をデモで見せられるように
- デモ用4名（`student2/4/5/9`）は**未回答のまま**残し、完了済み面接ぶんの予約実績だけ入れる。その場で回答して面接官別の平均が動くのを見せる席です（`student2` が最適：一次面接完了・担当は佐藤 健）

---

## 設計判断で残したもの

**過去の面接ぶんの `schedule_requests` を全学生には作っていません。** 受信箱のカードは `schedule_requests` の最新1件を出すため、全学生に入れると「[日程確定] 過去の日付」が30枚以上並び、**メイン画面の見た目が変わってしまう**からです。上記デモ用4名に限定しており、この4名はもともとデモ用の日程依頼を持っていて、そちらの `id` のほうが大きいのでカードの表示は変わりません（確認済み）。

そのため、それ以外の学生が新規回答すると「面接官不明」に入ります。実運用では予約フロー経由で面接が組まれるため解消しますが、現行シードデータ上はそうなる、という制約です。

---

## 見た目

**人事 `/interviews`** — 面接官別の平均満足度（x軸は 0〜5 で固定。自動伸縮させると 0.2 の差がバー2倍に見えるため）。棒グラフは**ドロップダウンに連動させていません**。比較が目的の図から比較対象を消してしまうので。

**学生マイページ** — 完了済みの面接ステップにだけカードが出て、送信するとお礼メッセージに切り替わり、リロードしても戻りません。

---

## 動作確認

| | 結果 |
| --- | --- |
| `npm run db:migrate` / `db:seed` | 通過（アンケート27件・面接官5名・うち1名は下限で非表示） |
| `npm run lint` / `npm run build` | 通過 |
| `node --test "server/services/*.test.js"` | **142 pass / 0 fail**（新規7件を含む） |
| 人事画面 | 描画・スコープ切替（AI要約は実際のGeminiで生成）・「表で見る」・スクロール |
| 学生→人事の通し | ★5＋記述を送信 → `201` → リロード後も回答済み → 面接官「佐藤 健」に紐付くところまで |

### 完了の定義（`workflow.md` §6）

- [x] 列挙値を `shared/constants.js` から import している（文字列リテラル直書きなし）
- [x] SQL がプレースホルダになっている
- [x] `v-html` を使っていない
- [x] `npm run lint` が通る
- [x] リロードしても壊れない（**まさにこの点の既存バグを修正しています**）
- [x] 人事・学生の両方で動作確認した
- [ ] `requirements.md` の受入条件 — **S-11 が未記載**（このPRで採番したため。下記の残作業）
- [ ] サーバ側の `room_members` チェック — **該当なし**。このPRはルームを操作しません。認可は「人事のみ（`requireHr`）」と「学生本人のみ（`req.user.id` を使い、クライアントの `userId` を受け取らない）」で行っています
- [ ] Socket ハンドラの `useSocket.js` 集約 — **該当なし**。このPRはリアルタイム配信を行いません（アンケートは更新頻度が低く、開いたときと手動更新で取り直します）

---

## 残作業（このPRには含めていません）

- `.claude/requirements.md` に S-11 の項目と受入条件を追記
- `.claude/frontend.md` §7-3 の「フロントエンドのみのモック」という記述の更新
- `.claude/api.md` に新エンドポイントを追記

## レビュー時にご注意ください

`workflow.md` §4 のコンフリクトしやすい共有ファイルのうち、**`schema.sql` / `shared/constants.js` / `seed.js` / `router/index.js` の4つすべてに触れています**。定数は末尾への追記のみで既存ブロックは変更していませんが、他の作業中ブランチがある場合は早めのマージをご検討ください。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #62 feat(P3-4): 確定した面接を学生マイページに表示する

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P3-4-mypage-booked-interview` → `master`
- 作成: 2026-08-07T03:19:21Z / マージ: 2026-08-07T03:20:30Z
- 変更: +361 -1 (6 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/62

<details><summary>本文</summary>

## なにを

面接日程が確定（`schedule_requests.status = booked`）したら、学生マイページ（`/mypage`）にその予定を出す。

## なぜ

学生が日程を予約したあと、**その予定はチャットの日程調整カードの中にしか無かった**。
前日に確認したい学生は、着地点であるマイページから一度チャットへ移動し、過去のメッセージを遡らないと自分の面接日時にたどり着けない。

マイページ（S-09）は「いま自分がどこにいて、次に何があるか」を出す画面。
フロー図が示すのは**現在地**で、このカードが示すのは**次の予定**なので、フロー図より上に置いた。

## 変更点

### サーバ

- `services/scheduleRequests.js` に `listUpcomingInterviewsForStudent()` を追加
  - 確定済みかつ **`booked_ends_at` が未来のものだけ**を開始時刻の昇順で返す
  - 終わった面接はフロー図と面接アンケート（S-11）が引き受けるので、ここに残すと「次に何があるか」が読み取れなくなる
  - 返すのは「いつ・誰と・どこで」だけ。候補期間・回答期限・面接官の外部IDは載せない（確定後の読者には不要）
- `GET /selection-flow/me` に `upcomingInterviews` を相乗り
  - マイページの往復を1回に保つため（`frontend.md` §7-3「データ」）
  - 対象は `req.user` から引く。クライアントの `userId` は受け取らない

### クライアント

- `BookedInterviewCard.vue`（新規）
  - 日時を主役にし、面接官・形式・場所は1行に流して差をつける
  - 残り日数は `本日` / `明日` / `あとN日` を**テキストで**併記（色だけで近さを伝えない・CLAUDE.md §6-13）
  - **当日・翌日のときだけ**左のオレンジ帯＋クリーム面。未読チャットカード・FBカードと同じ言語に揃え、学生が覚える約束事を1つに保つ
  - 会議室・URL 未設定は正常な状態（人事があとから決める：P4-5）。空欄で出さず「担当者からご連絡します」と書く
  - **予約・変更の操作は置かない。** 日程の相談はチャットの仕事で、置くと日程調整カードと役割が二重になる
- `StudentHomeView.vue` に組み込み。確定した面接が無ければ何も描画しない

### ドキュメント

- `.claude/api.md` … `upcomingInterviews` のレスポンス例と制約
- `.claude/frontend.md` §7-3 … レイアウト図・カードの表示ルール・コンポーネント一覧

## 動作確認

worktree 専用のポート（API 3100 / Vite 5273）でサーバを立てて確認（他の作業ツリーの 3000/5173 には触れていない）。

- 学生が実際に日程を予約 → マイページに「面接日程が確定しています／一次面接／8月9日(日) 14:00〜15:00／あと2日」が表示される
- 翌日開催に書き換え → 「明日」バッジ＋オレンジ帯に切り替わる。場所未設定のフォールバック文言も確認
- 終了済みに書き換え → カードが消え、レイアウトは崩れない
- ブラウザのコンソールエラーなし
- `npm run lint` / `npm run test:server`（142 pass）/ `npm run build` すべて通過

## 影響範囲

- `shared/constants.js` と `server/db/schema.sql` は**変更していない**（コンフリクトしやすい共有ファイルに触れていない）
- マイグレーション不要
- 人事側の画面に変更なし

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #63 feat(P3-1a): AI 起動ボタンをらくす君へ統合し、どの画面からでも ToDo を開けるようにする

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/P3-1a-rakusukun-ai-todo` → `master`
- 作成: 2026-08-07T04:00:20Z / マージ: 2026-08-07T04:01:12Z
- 変更: +526 -115 (11 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/63

<details><summary>本文</summary>

## 概要

ホーム（S-07）右下の円形 AI ボタンと右カラムの AI 現況サマリーを廃止し、**全画面に常駐するらくす君を AI の入口**にしました。

これまで AI サマリーはホームでしか開けませんでしたが、らくす君はどの画面にも居るため、**受信箱・トーク・ダッシュボード・通知どこからでも「今日の ToDo」を聞ける**ようになります。

らくす君のクリックで開くのは吹き出しまでで、そこから `通知を確認する` / `今日の ToDo を聞く` の2つに分岐します。通知を見たいだけのときにサマリーが開いて邪魔をしないようにするためです。

## 変更点

| ファイル | 内容 |
| --- | --- |
| `components/AiTodoPanel.vue` 🆕 | AppShell 直下の浮遊パネル。らくす君の隣に寄り添い、余白の大きい側へ左右・上下とも自動で回り込む |
| `composables/useAiTodo.js` 🆕 | 開閉ロジックの集約。入口が2つあるので「開くときに未生成なら取りに行く」を1か所に |
| `utils/petLayout.js` 🆕 | らくす君とパネルが共有する寸法・クランプ計算 |
| `components/RakusuKunPet.vue` | クリックで吹き出し。通知と ToDo の2本立てに。未読件数もボタンに表示 |
| `components/AiLauncherButton.vue` | 「らくす君を表示」を切っている間だけ出る代替ボタンへ降格 |
| `components/AppShell.vue` | AiTodoPanel と代替ボタンを設置 |
| `views/HomeView.vue` | 右カラムを廃止し、ボードが全幅を使う |
| `stores/ui.js` | `aiPanelOpen` の既定を `false` に（全画面に重なるため）、`petMinimized` を追加 |

## 判断したこと

- **学生には ToDo を出しません。** `GET /api/ai/summary` は人事のみ（403）なので、学生のらくす君は従来どおり挨拶と通知だけです。
- **らくす君を非表示にしても ToDo は使えます。** 設定で消すと機能ごと失われるのを避け、右下に円形ボタンが代わりに出ます。

## 受入条件（P3-1a）

- [x] ログイン後にホームを開くと、AI サマリーが生成済みで表示されている
  - ⚠️ **仕様変更**：常時表示ではなく、生成済みの状態でらくす君から開けるようになりました
- [ ] AI ボタンを押すと再生成され、`generatedAt` が更新される
  - ⚠️ **仕様変更**：ボタンを統合したため、**手動再生成はカードの「更新」のみ**になりました。要件文の追従が必要ならこの PR で直します
- [x] `GEMINI_API_KEY` を外すとカードが `unavailable` 表示になるだけで、ホームの一覧は通常どおり動作する
- [x] TODO をクリックすると該当学生のトークが開く（遷移時にパネルは自動で閉じる）

## Definition of Done

- [x] 列挙値を `shared/constants.js` から import している
- [x] `v-html` を使っていない
- [x] Socket イベントのハンドラは `useSocket.js` のまま（追加なし）
- [x] `npm run lint` / `npm run build` が通る
- [x] 人事（hr1）・学生（student1）の両方で実際に動作確認した
- [x] リロードしても壊れない

サーバ側は変更していません（認可・SQL の変更なし）。

## 動作確認

- らくす君クリック → 吹き出しのみ、サマリーは開かない
- 「今日の ToDo を聞く」→ 吹き出しが畳まれてサマリーが起動。再クリックで「閉じる」に変化
- ホーム／ダッシュボード／トークの各画面から開閉できる
- ToDo クリック → 該当ルームへ遷移し、パネルが自動で閉じる
- らくす君をドラッグ・最小化するとパネルが追従する
- らくす君を非表示にすると右下に代替ボタンが出て、同じパネルが開く
- student1 では通知ボタンのみで ToDo は出ない

## 併せて直したもの

画面寸法が取れないタイミング（レイアウト確定前に `innerWidth` が 0 になるケース）で、らくす君の保存位置が左上へ潰れる／画面外へ出る不具合を修正しました。寸法が測れるまで配置を保留します。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #64 feat(S-12): 人事FBアンケート（選考終了時の配信＋ダッシュボード集計）

- 状態: **merged** / 作成者: Kousuke-irie
- `feat/S-12-hr-feedback-survey` → `master`
- 作成: 2026-08-07T04:59:30Z / マージ: 2026-08-07T05:04:31Z
- 変更: +2908 -13 (30 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/64

<details><summary>本文</summary>

選考が終わった学生（内定・辞退）に、担当人事の対応についてのアンケートを配信し、監視ダッシュボード（`/dashboard`）で担当者別に読めるようにします。

**面接アンケート（S-11）とは別物**として作りました。あちらは面接官の「面接」、こちらは担当人事との「やり取り」が主語で、評価軸も母数も次に取る行動も違うため、テーブルも定数も共用していません。

---

## 受入条件

- [x] 選考ステータスが内定または辞退に変わると、学生本人にアンケート依頼の通知が1件届く
- [x] **辞退した学生のマイページにもアンケートカードが出る**（フロー図は消えるが、カードは出す）
- [x] 3軸すべてに答えるまで送信できない。送信は1人1回で、あとから直せない
- [x] `/dashboard` の全社タブに回答数・回答率・総合満足度・担当者別・評価軸別が出る
- [x] 回答が `HR_SURVEY_MIN_SAMPLE`(3) 件に満たない担当者は個別に表示されず、伏せた旨が画面に出る
- [x] 個人タブで自分への評価が読める（下限未満なら数字が出ず、理由が書かれている）
- [x] 回答者を特定できる情報（学生ID・氏名・ルームID・回答日時）が人事向けAPIに一切載らない
- [x] すべてのチャートに「表で見る」がある／ゼロ件でもレイアウトが崩れない

## 設計判断（レビューで見てほしいところ）

**① カードを選考フローの外側に置いた**
辞退すると `StudentHomeView` はフロー図ごと「またご縁がありましたら…」の1行に置き換わります。カードをフロー内（`SelectionStepDetail`）に入れると辞退者に出せず、**満足した人だけが答えたアンケート**になってしまうため、独立ブロックにしました。リード文も内定／辞退で分けています（辞退者に「選考お疲れさまでした」は失礼にあたるため）。

**② `/interviews` ではなく `/dashboard` に載せた**
`router/index.js` のコメントどおり、`/dashboard` の主語は「人事の対応品質」・`/interviews` は「面接官の面接品質」です。人事FBは前者なので `/dashboard` に置き、エスカレーション表の**下**にしました（上は「いま手を打つべき案件」、こちらは「振り返って直すところ」）。

**③ 匿名化は本人にも適用した**
個人タブで自分のぶんを見る場合も、下限未満なら数字を出しません。「自分ならよい」にすると、担当者は誰が答えたか分かる状態で読むことになり、学生への「特定されません」という約束が崩れます。担当学生は固定なので、S-11（面接官別）より特定リスクは高いと判断しました。

**④ 3軸を単一色の横棒2枚に分けた（グループ横棒にしなかった）**
3軸のグループ横棒は3本が必ず隣接するため全ペアの色覚検証が要るうえ、軸に「良し悪し」の色が付いて読み違えます。「担当者別 総合満足度」「評価軸別 平均」の2枚に分け、どちらも単一色にしました。3軸の内訳と選考結果（内定／辞退）別は「表で見る」に出ます。

## ⚠️ 共有ファイルを触っています（`workflow.md` §4）

`shared/constants.js` / `server/db/schema.sql` / `server/db/seed.js` を変更しています。**単独PRにする規約に反しています。** 機能と切り離すと「未使用のテーブルと定数だけを足すPR」になるため1本にまとめましたが、分割が必要なら言ってください。

- `shared/constants.js`：`HR_SURVEY_*` の追加、`ALERT_KIND.STUDENT_HR_SURVEY_REQUESTED` の追加
- `server/db/schema.sql`：`hr_surveys` テーブル・インデックスの追加、`alerts` の `kind` CHECK と部分UNIQUEに新 kind を追加（既存DBは `migrate.js` の `stashLegacyAlerts` が自動で作り直します）
- `server/db/seed.js`：後述

## シードデータを変更しています ★要確認

選考終了の学生が**3〜4名しかおらず**、匿名化の下限でダッシュボードが丸ごと伏せ字になってデモが成立しませんでした。生成分の学生を担当者ごとに4名ずつ内定・辞退へ倒しています（40名中16名＝40%）。

- 担当者ごとに最低3件は必ず入るようにしてあり、乱数の引き次第で伏せ字になることはありません
- 担当未割当のルームには配っていません（「誰も見ていない受信箱」の席なので選考が進んでいると筋が通らない）
- `student5`（内定）・`student6`（辞退）はその場で回答して見せるため未回答で残しています
- 副作用：**選考ステータス別のファネル**の形が変わります（内定12名・辞退4名）。S-11 面接アンケートは 39件・面接官5名で従来どおり成立しています

結果、`連絡の速さ 2.6 < 説明の分かりやすさ 2.9 < 対応の丁寧さ 3.9` と軸ごとに差が出ており、課題 C-1（合否連絡が1日遅れる）がデータ上に現れます。

## API

| メソッド | パス | 権限 |
| --- | --- | --- |
| POST | `/selection-flow/me/hr-survey` | 学生のみ |
| GET | `/hr-surveys` | 人事のみ。担当者別の★集計 |
| GET | `/hr-surveys/comments?assigneeId=` | 人事のみ。匿名化した自由記述 |
| GET | `/hr-surveys/ai-summary?assigneeId=` | 人事のみ。自由記述のAI要約 |

`GET /selection-flow/me` に `hrSurvey: { answerable, answered, outcome, outcomeLabel }` を追加しています。

## 動作確認

- `npm run lint` / `npm run build` OK
- `node --test "server/**/*.test.js"` → **152 pass / 0 fail**（`hrSurveys.test.js` を10件追加）
- 実機：辞退した学生（student6）でカードが出る → 送信 → お礼表示 → DBに担当人事のスナップショット付きで保存されることを確認（検証用の1件は削除済み）
- 実機：全社タブで担当者別3名が表示され、未割当1件は伏せられて注記が出る。AI要約も生成されました
- 実機：個人タブで3軸の横棒が描画される

## 確認のしかた

```bash
npm run db:migrate && npm run db:seed && npm run dev
```

1. `student6` / `password123` でログイン → マイページにアンケートカード（辞退向けの文面）
2. 3軸に答えて送信 → お礼表示に切り替わる
3. `hr1` / `password123` でログイン → `/dashboard` を最下部までスクロール → 回答数が1件増えている
4. 「個人」タブ → 「学生からの評価（選考終了後アンケート）」

## ドキュメント

`requirements.md`（S-12 追加）／`database.md`（`hr_surveys`）／`api.md`（エンドポイント）／`constants.md`（`HR_SURVEY_*`・`ALERT_KIND` の表を最新化）／`frontend.md`（カードとパネル）／`monitoring.md`（ダッシュボード）を更新しました。

## このPRに含めていないもの

`chatapp/vite.config.js` と `chatapp/.claude/launch.json` に作業開始前からの変更（開発環境のポート可変対応）がありますが、本件と無関係なので**含めていません**。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---

## #65 fix(P3-1a): らくす君の初期位置を画面の右下端に固定する

- 状態: **merged** / 作成者: Kousuke-irie
- `fix/P3-1a-pet-default-position` → `master`
- 作成: 2026-08-07T05:20:43Z / マージ: 2026-08-07T05:24:29Z
- 変更: +30 -10 (3 files, 1 commits)
- URL: https://github.com/rkclhack/hackathon-t1-A/pull/65

<details><summary>本文</summary>

## 概要

らくす君（RakusuKunPet）の初期位置が中途半端な場所に着地し、ウィンドウサイズによってもずれていた問題を修正しました。

## 原因

`defaultPetPosition` に **右端から `- 92`px** というマジックナンバーが入っており、右下端から常に 92px 内側に置かれていました。あわせて、位置がずれる要因が2つありました。

| # | 症状 | 原因 |
| --- | --- | --- |
| 1 | 初期位置が右下端でない | 初期位置の x に `- 92` のマジックナンバー |
| 2 | ウィンドウを縮めてから広げると右下に戻らない | リサイズ時は画面内へ clamp するだけで、縮めたときの座標に取り残されていた |
| 3 | しまった状態（52px の丸ボタン）が右端から 80px 浮く | 初期位置を展開時の幅 132px で計算していた |

## 変更内容

| ファイル | 内容 |
| --- | --- |
| `src/utils/petLayout.js` | `defaultPetPosition` を右下端（余白 8px）基準に変更。現在の当たり判定サイズを受け取れるようにし、しまっている間も丸ボタンの寸法で隅に揃える |
| `src/components/RakusuKunPet.vue` | `anchoredPosition()` を追加。**ドラッグで動かしていない間は常に右下端へ**戻す（リサイズ・最小化・復元・通知受信時）。ドラッグで移動した位置は従来どおり localStorage から復元する |
| `src/components/RakusuKunPet.vue` | 切り抜き画像は表情ごとに縦横比が違い `object-fit: contain` では右下に余白が残るため、`object-position: right bottom` で隅へ寄せた |
| `src/components/AiTodoPanel.vue` | らくす君と同じ寸法計算を共有するため、サイズを渡すよう追随 |

ドラッグで動かした位置の保存・復元は従来のまま変えていません。

## 確認したこと

- [x] 1280×720 / 1440×900 で、本体の矩形が右端・下端から**ちょうど 8px**
- [x] 縮小（900×600）→ 拡大（1440×900）で右下端（8px / 8px）に復帰する
- [x] しまった状態（52×52）でも右端・下端から 8px
- [x] ドラッグで移動した位置がリロード後も復元される（localStorage）
- [x] AI ToDo パネルがらくす君の左隣に画面内で収まって開く
- [x] 列挙値のハードコードなし・`v-html` 未使用（CLAUDE.md §6）
- [x] `npm run lint` が通る

> リサイズの検証は `resize` イベントを明示的に発火させて確認しています（プレビューの viewport 変更ではイベントが発火しないため。実ブラウザのウィンドウ操作では自動で発火します）。

## スコープ外

作業ツリーにあった `vite.config.js` / `.claude/launch.json` のローカル変更（開発ポート周り）はこの PR に含めていません。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

</details>

---
