# 🟡 情報漏洩 - 詳細なエラーログの出力

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: javascript
category: info-disclosure
cwe_id: CWE-209
cvss_score: 4.3
severity: Medium
priority: P2
discovered: 2025-11-21 00:00
status: New
related_vulns: []
```

## 🎯 要約
エラーハンドリングミドルウェアで詳細なエラーオブジェクトをコンソールに出力しており、ログにアクセスできる攻撃者に内部実装の詳細が漏洩する可能性があります。

## 📍 発生場所
- **ファイル**: `api/middleware/errorHandler.js`
- **行番号**: L2
- **関数**: `errorHandler()`
- **エンドポイント**: すべてのAPIエンドポイント（エラー発生時）

## 💣 詳細

### 問題コード
```javascript
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Gemini APIエラーの処理
    if (err.message && err.message.includes('Gemini API error')) {
        const statusMatch = err.message.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;

        if (status === 429) {
            return res.status(429).json({
                error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。'
            });
        } else if (status === 401 || status === 403) {
            return res.status(500).json({
                error: 'サーバーの設定エラーです。管理者に連絡してください。'
            });
        }
    }

    // body-parserなどのステータスコード付きエラーの処理
    if (err.status || err.statusCode) {
        return res.status(err.status || err.statusCode).json({
            error: err.message || 'リクエストエラーが発生しました。'
        });
    }

    // デフォルトエラー
    res.status(500).json({
        error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
    });
}
```

### 根本原因
- `console.error('Error:', err)` でエラーオブジェクト全体を出力
- スタックトレース、内部パス、データベース情報などがログに記録される
- 本番環境でログにアクセスできる攻撃者（コンテナログ、クラウドログサービスなど）に情報が漏洩

### 攻撃シナリオ
1. 攻撃者が意図的にエラーを発生させる（無効なリクエスト、大きすぎるペイロードなど）
2. サーバーログにエラーの詳細が記録される
3. 攻撃者がログにアクセスできる場合（ログ収集サービスの脆弱性、内部犯など）、以下の情報を取得：
   - ファイルパス構造
   - 使用しているライブラリとバージョン
   - スタックトレース
   - 内部エラーメッセージ
4. 取得した情報を元に、より高度な攻撃を計画

### 影響範囲
- **機密性**: Medium（内部実装の詳細が漏洩）
- **完全性**: None
- **可用性**: None
- **影響ユーザー**: システム全体（間接的）

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- アプリケーションが稼働中
- サーバーログにアクセス可能

### 再現ステップ
```bash
# 1. 無効なリクエストを送信してエラーを発生させる
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "invalid_data"}'

# 2. サーバーログを確認
# サーバーコンソールに詳細なエラー情報が出力される

# 3. 大きすぎるペイロードを送信
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "'$(python3 -c 'print("A"*10000000)')'"}'

# 4. サーバーログに出力されたエラー詳細を確認
```

## 🛡️ 推奨対策

### 短期
- [ ] 本番環境では詳細なエラーログを出力しない
- [ ] 以下のように修正：
  ```javascript
  // ❌ Before
  console.error('Error:', err);

  // ✅ After
  if (process.env.NODE_ENV === 'development') {
      console.error('Error:', err);
  } else {
      // 本番環境では最小限の情報のみログ出力
      console.error('Error occurred:', {
          message: err.message,
          status: err.status || err.statusCode || 500,
          timestamp: new Date().toISOString()
      });
  }
  ```

### 長期
- [ ] 構造化ログライブラリ（winston、pino など）を導入し、ログレベルを適切に設定
- [ ] 本番環境ではINFO以上のレベルのみログ出力
- [ ] ログに含まれる機密情報（APIキー、個人情報など）をフィルタリング
- [ ] ログへのアクセス権限を適切に管理（最小権限の原則）
- [ ] ログ監視とアラート設定を導入し、異常なエラー発生を検知

## 🔗 参考
- OWASP: https://owasp.org/www-community/Improper_Error_Handling
- CWE: https://cwe.mitre.org/data/definitions/209.html
- Node.js Logging Best Practices: https://blog.logrocket.com/node-js-logging-best-practices/

---
*Iteration 1 | 2025-11-21 00:00 JST*
