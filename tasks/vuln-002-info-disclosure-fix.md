# 🟡 VULN-002: 情報漏洩 - 詳細なエラーログの修正

## 概要
エラーハンドリングミドルウェアで詳細なエラーオブジェクトをコンソールに出力しており、ログにアクセスできる攻撃者に内部実装の詳細が漏洩する可能性があります。

## 脆弱性情報
- **ID**: vuln-002
- **カテゴリ**: Information Disclosure (CWE-209)
- **重大度**: 🟡 Medium (CVSS: 4.3)
- **優先度**: P2（1週間以内）
- **影響ファイル**: `api/middleware/errorHandler.js:2`

## 実装タスク

### タスク1: 環境別エラーログの実装
- [ ] `api/middleware/errorHandler.js`の2行目付近を修正
- [ ] `NODE_ENV`環境変数による条件分岐を追加
- [ ] 開発環境では詳細なエラー、本番環境では最小限の情報のみログ出力

### タスク2: 構造化ログの実装
- [ ] 本番環境では以下の情報のみをログ出力
  - エラーメッセージ（一般的な内容のみ）
  - ステータスコード
  - タイムスタンプ
  - リクエストID（存在する場合）
- [ ] スタックトレースや内部パスは本番環境では出力しない

### タスク3: テスト
- [ ] `NODE_ENV=development`でサーバーを起動し、エラー時に詳細情報が出力されることを確認
- [ ] `NODE_ENV=production`でサーバーを起動し、最小限の情報のみが出力されることを確認
- [ ] 以下のテストケースを実行
  ```bash
  # 無効なリクエストを送信
  curl -X POST http://localhost:3000/api/ocr \
    -H "Content-Type: application/json" \
    -d '{"image": "invalid_data"}'
  ```

## 修正コード例

```javascript
// ❌ Before (api/middleware/errorHandler.js:2)
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    // ... rest of code
}

// ✅ After
function errorHandler(err, req, res, next) {
    if (process.env.NODE_ENV === 'development') {
        // 開発環境では詳細なエラー情報を出力
        console.error('Error:', err);
    } else {
        // 本番環境では最小限の情報のみログ出力
        console.error('Error occurred:', {
            message: err.message,
            status: err.status || err.statusCode || 500,
            timestamp: new Date().toISOString()
        });
    }

    // ... rest of code
}
```

## 成功基準
- [ ] 開発環境で詳細なエラー情報が出力される
- [ ] 本番環境でスタックトレースやファイルパスが出力されない
- [ ] 本番環境でエラーログに機密情報が含まれない
- [ ] エラーハンドリング機能が正常に動作する

## 将来の改善（オプション）
- [ ] winston、pinoなどの構造化ログライブラリの導入
- [ ] ログレベルの適切な設定（ERROR、WARN、INFO、DEBUG）
- [ ] ログ監視とアラート設定

## 参考資料
- [OWASP Improper Error Handling](https://owasp.org/www-community/Improper_Error_Handling)
- [CWE-209](https://cwe.mitre.org/data/definitions/209.html)
- [Node.js Logging Best Practices](https://blog.logrocket.com/node-js-logging-best-practices/)

## 関連ファイル
- `api/middleware/errorHandler.js`
