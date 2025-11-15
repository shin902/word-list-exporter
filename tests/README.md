# Tests

このディレクトリには、My 暗記帳アプリケーションのユニットテストが含まれています。

## セットアップ

テストを実行するには、以下の手順に従ってください：

### 1. Node.jsのインストール

Node.jsがインストールされていない場合は、[公式サイト](https://nodejs.org/)からダウンロードしてインストールしてください。

### 2. 依存関係のインストール

プロジェクトのルートディレクトリで以下のコマンドを実行します：

```bash
npm install
```

## テストの実行

### すべてのテストを実行

```bash
npm test
```

### 特定のテストファイルを実行

```bash
npm test -- validation.test.js
```

### カバレッジレポートを生成

```bash
npm run test:coverage
```

## テスト構成

### Unit Tests (`tests/unit/`)

単体テスト - 個別の関数やメソッドの動作を検証

- **validation.test.js** (50+ テスト) - バリデーション関数のテスト
  - `validateApiKey()` - API Keyの検証
  - `sanitizeInput()` - 入力のサニタイゼーション
  - `escapeHtml()` - HTMLエスケープ
  - `generateUniqueId()` - ユニークID生成
  - `parseSubscriptSuperscript()` - 上付き・下付き文字変換
  - `debounce()` - デバウンス関数

- **parsing.test.js** (35+ テスト) - パース関数とデータ操作のテスト
  - `parseTextToCards()` - テキストからカードへの変換
  - `loadCards()` - カードの読み込みと移行
  - `deleteCard()` - カードの削除

### Integration Tests (`tests/integration/`)

統合テスト - 複数のコンポーネントが連携する動作を検証

- **ocr-workflow.test.js** (20+ テスト) - OCRワークフローの統合テスト
  - 画像からカード生成までの完全なフロー
  - Gemini API連携のテスト（モック使用）
  - エラーハンドリング（レート制限、認証エラー、ネットワークエラー）
  - APIレスポンス形式の詳細検証
  - リクエストフォーマットの検証

- **migration.test.js** (15+ テスト) - データ移行の統合テスト
  - レガシーカード（ID未設定）の自動移行
  - ID-based削除への移行
  - 混在データ（レガシー + 新形式）のハンドリング
  - データ破損時の復旧
  - 大規模データセットの移行性能テスト

## テスト実行環境

- **テストフレームワーク**: Jest
- **環境**: jsdom (ブラウザ環境のシミュレーション)

## テストの追加

新しいテストを追加する場合は、以下の手順に従ってください：

1. `tests/unit/` または `tests/integration/` に新しいテストファイルを作成
2. ファイル名は `*.test.js` の形式にする
3. `describe()` と `test()` を使用してテストケースを記述
4. `npm test` でテストが実行されることを確認

## 継続的インテグレーション

GitHub ActionsなどのCI/CDツールでテストを自動実行する場合は、以下の設定を参考にしてください：

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## トラブルシューティング

### テストが実行されない

- Node.jsがインストールされているか確認
- `npm install` を実行したか確認
- `package.json` が存在するか確認

### DOM関連のエラー

- Jestの設定で `testEnvironment: 'jsdom'` が指定されているか確認
- `jest-environment-jsdom` パッケージがインストールされているか確認

## 参考資料

- [Jest公式ドキュメント](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
