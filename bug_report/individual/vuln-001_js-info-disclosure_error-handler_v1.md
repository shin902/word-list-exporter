# 🟡 情報漏洩 - 開発環境での詳細エラー情報露出

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: javascript
category: info-disclosure
cwe_id: CWE-200
cvss_score: 5.3
severity: Medium
priority: P1
discovered: 2025-11-24 00:45
status: New
related_vulns: []
```

## 🎯 要約
開発環境（NODE_ENV === 'development'）において、詳細なエラーメッセージとスタックトレースがクライアントに露出され、内部実装の情報漏洩リスクがあります。

## 📍 発生場所
- **ファイル**: `api/middleware/errorHandler.js`
- **行番号**: L102-107, L130-148
- **関数**: `errorHandler()`
- **エンドポイント**: すべてのAPIエンドポイント

## 💣 詳細

### 問題コード
```javascript
// L102-107: 開発環境での詳細ログ
if (isDevelopment) {
    console.error('Error:', err);
} else {
    // In production, log with error ID for correlation
    console.error(`Error ID ${errorId}:`, err?.message || 'Unknown error');
}

const rawMessage = err.message || 'Unknown error';

// L130-148: 開発環境での詳細メッセージ返却
if (isDevelopment) {
    messageForClient = rawMessage;
} else {
    // For non-500 errors, try to use generic message first
    messageForClient = getGenericMessageForStatus(status) || sanitizeMessage(rawMessage);
}

return sendResponse(status, messageForClient);

// L143-148: デフォルト500エラーハンドリング
if (isDevelopment) {
    return sendResponse(500, rawMessage);
} else {
    // Sanitized messages are good for debugging without exposing paths
    return sendResponse(500, 'サーバーエラーが発生しました。しばらくしてから再試行してください。');
}
```

### 根本原因
- 開発環境と本番環境で異なるエラーハンドリングロジックを実装している
- 開発環境では、`rawMessage`がそのままクライアントに返される
- スタックトレースやファイルパス、内部実装の詳細が露出する可能性

### 攻撃シナリオ
1. 攻撃者が開発環境のエンドポイントを特定
2. 意図的に不正なリクエストを送信してエラーを誘発
3. 返されたエラーメッセージから以下の情報を取得：
   - ファイルパス、ディレクトリ構造
   - 使用しているライブラリやフレームワークのバージョン
   - データベーススキーマやSQL クエリの構造
   - APIキーやトークンの形式
4. 取得した情報を元に、より高度な攻撃を計画

### 影響範囲
- **機密性**: Medium - 内部実装の詳細が露出
- **完全性**: None
- **可用性**: None
- **影響ユーザー**: 開発環境にアクセス可能なすべてのユーザー

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- NODE_ENV=development で起動されたサーバー
- アクセス可能なAPIエンドポイント

### 再現ステップ
```bash
# 不正なリクエストを送信
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "invalid_data"}'

# 期待される応答: 詳細なエラーメッセージ
# {
#   "error": "Invalid response format from Gemini API: missing text"
# }

# または、存在しないエンドポイントへのアクセス
curl http://localhost:3000/api/invalid_endpoint
```

## 🛡️ 推奨対策

### 短期
- [ ] 開発環境でも最小限のエラー情報のみをクライアントに返す
- [ ] 詳細なエラー情報はサーバーサイドのログのみに記録
- [ ] 環境変数の誤設定を検出する仕組みを導入

### 長期
- [ ] すべての環境で統一されたエラーハンドリングポリシーを適用
- [ ] エラーIDベースのログ追跡システムを開発環境にも導入
- [ ] セキュリティヘッダーの追加（X-Content-Type-Options, X-Frame-Options など）
- [ ] 開発環境と本番環境の分離を徹底（異なるドメイン、ネットワーク分離）

## 🔗 参考
- OWASP: https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure
- CWE: https://cwe.mitre.org/data/definitions/200.html
- OWASP Error Handling: https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

---
*Iteration 1 | 2025-11-24 00:45:00 JST*
