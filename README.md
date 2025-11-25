# My 暗記帳

フラッシュカード形式で学習できるWebアプリケーション

## 使い方

1. `index.html` をブラウザで開く（またはデプロイされたURLにアクセス）
2. 「一覧表示」→「追加」から単語カードを手動登録、または「インポート」から画像をアップロード
3. 「学習開始」でランダムに出題される問題を学習

## 機能

- ✅ ホーム画面
- ✅ 単語カード追加機能
- ✅ 単語カード一覧表示（カテゴリ別）
- ✅ 単語カード削除機能
- ✅ ランダム出題による学習モード
- ✅ 上付き・下付き文字サポート（例: `x^2`, `H_2O`）
- ✅ ローカルストレージでのデータ永続化
- ✅ 画像からの赤字抽出インポート機能（Gemini Vision API使用）

## 動作環境

本アプリケーションは、安全な乱数生成（Web Crypto API）をサポートする以下のモダンブラウザで動作します。

- Google Chrome (最新版)
- Mozilla Firefox (最新版)
- Safari (最新版)
- Microsoft Edge (最新版)

※ Internet Explorer などの古いブラウザでは動作しません。

## 画像インポート機能

画像から単語カードをインポートする機能は、バックエンドAPIを経由してGemini APIを利用します。
ユーザー側でのAPI Keyの設定は不要です。

### 画像のインポート手順

1. 「一覧表示」→「インポート」をクリック
2. カテゴリ名を入力（デフォルトは「英単語」）
3. 赤字が含まれる画像を選択
4. 「赤字を抽出してインポート」ボタンをクリック
5. 認識されたカードを確認・編集して保存

## 開発者向け情報

### バックエンドのセットアップ

このアプリケーションはNode.js/Expressバックエンドを使用しています。

1. 依存関係のインストール
   ```bash
   npm install
   ```
   > **注意**: `npm install` 実行時に Gitフック（husky）が自動的にセットアップされます。

2. 環境変数の設定
   `.env.example` をコピーして `.env` を作成し、必要な環境変数を設定してください。
   ```bash
   cp .env.example .env
   ```

   **環境変数一覧:**
   - `GEMINI_API_KEY`: Google Gemini APIのキー（必須）
   - `FRONTEND_URL`: フロントエンドのURL（CORS設定用）。開発環境では `http://localhost:5500` など、本番環境ではデプロイ先のURLを指定します。
   - `PORT`: サーバーのポート番号（デフォルト: 3000）
   - `NODE_ENV`: 環境設定（`development` または `production`）
   - `KV_URL` または `REDIS_URL`: Redis接続URL（**本番環境では必須**）。レート制限の管理に使用されます。

3. サーバーの起動（ローカル開発）
   ```bash
   node api/index.js
   ```
   または
   ```bash
   npm run dev
   ```

### Gitフック

コードの品質と安全性を保つため、`husky` を使用して以下のGitフックを設定しています：

- **pre-commit**: コミット前に `.env.example` に機密情報が含まれていないかチェックし、`.env` ファイルのコミットを阻止します。
- **pre-push**: プッシュする前に `npm test` を実行し、テストが通過することを確認します。

手動でフックをセットアップする場合（`npm install` が機能しなかった場合など）:
```bash
npm run prepare
```

緊急時など、Gitフックをスキップしたい場合は `--no-verify` (または `-n`) オプションを使用してください：
```bash
git commit -m "WIP" --no-verify
```

> **注意**: このフックは将来のコミットでの漏洩を防ぎますが、過去の履歴はチェックしません。過去にシークレットをコミットしていないか確認するには、Git履歴を調査してください（例: `git log -S AIza`）。

### デプロイ

Vercelへのデプロイに対応しています。
`vercel.json` が設定済みです。

## データ形式

```javascript
{
  id: String,        // ユニークID（自動生成）
  category: String,  // カテゴリ名
  question: String,  // 問題文
  answer: String     // 解答文
}
```

## テスト

このプロジェクトには基本的なユニットテストが含まれています。

### テストのセットアップ

```bash
# 依存関係のインストール
npm install

# テストの実行
npm test

# カバレッジレポートの生成
npm run test:coverage
```

詳細については [tests/README.md](tests/README.md) を参照してください。

## 詳細仕様

詳細な仕様については [docs/wordlist-specification.md](docs/wordlist-specification.md) を参照してください。
