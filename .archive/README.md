# アーカイブ

このリポジトリは、閉鎖予定の private リポジトリ **`rkclhack/hackathon-t1-A`** から
`chatapp/` ディレクトリのみを切り出して保存したコピーです。

## 切り出し方法

元リポジトリの `master`（`0633e84`）を基点に、`git subtree split -P chatapp` で
`chatapp/` 配下だけの履歴に書き換え、`chatapp/` をリポジトリのルートに昇格させました。

- 引き継いだコミット数: **156**（元 `master` の全211コミットのうち `chatapp/` を変更したもの）
- 最古のコミット: 2026-07-09 `create repository`
- 検証: 切り出し後のルートツリーハッシュが元の `master:chatapp` と一致（`3fd88bf203eacbb383de632f65f51bfdc76d36dd`）

## 引き継がれていないもの

- 元リポジトリのルート直下にあった `01_Claude_Code導入マニュアル.md` /
  `02_Claude_Codeクイックスタートガイド.md` / `tutorial/`
- `master` 以外の作業ブランチ（元リポジトリに66本存在）
- GitHub 上の Pull Request そのもの（下記の通りデータのみ退避）

## Pull Request の記録

元リポジトリの PR 全65件（すべて merged）を閉鎖前に取得したものです。

| ファイル | 内容 |
| --- | --- |
| `pull-requests.json` | 構造化データ。PR 本文・会話コメント・レビュー・行コメント・コミット一覧 |
| `PULL_REQUESTS.md` | 上記を人が読める形に整形したもの |

取得時点の件数: PR 65件（本文あり53件）／会話コメント 1件／レビュー 0件／行コメント 0件。
PR の内容は `git log` のマージコミットからも追えます。
