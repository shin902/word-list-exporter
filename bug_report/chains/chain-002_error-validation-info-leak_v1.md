# 🔗 組み合わせ攻撃チェーン - エラー露出 + バリデーション不足による情報漏洩

## メタデータ
```yaml
chain_id: chain-002
version: v1
cvss_score: 5.8
severity: Medium
attack_complexity: Low
discovered_iteration: 1
component_vulns: [vuln-001, vuln-003]
attack_path_length: 3 steps
exploit_time: 10-15 minutes
```

## 🎯 攻撃概要
開発環境での詳細エラー露出とBase64バリデーション不足を組み合わせることで、内部実装の詳細情報を効率的に収集できます。攻撃者は不正なデータを送信してエラーを誘発し、返されたエラーメッセージからGemini APIの構造、使用しているライブラリ、内部ロジックなどの機密情報を取得できます。

## 🔗 構成脆弱性

### Step 1: Base64バリデーション不足
- **ID**: vuln-003
- **種別**: Input Validation (CWE-20)
- **詳細**: [📄](../individual/vuln-003_js-validation_base64-incomplete_v1.md)
- **得られるもの**: 意図的なエラーを誘発可能

### Step 2: 開発環境でのエラー露出
- **ID**: vuln-001
- **種別**: Information Disclosure (CWE-200)
- **詳細**: [📄](../individual/vuln-001_js-info-disclosure_error-handler_v1.md)
- **得られるもの**: 詳細なエラーメッセージとスタックトレース

## 💣 完全な攻撃シナリオ

### 前提条件
- [ ] 開発環境のAPIエンドポイントへのアクセス（NODE_ENV=development）
- [ ] 基本的なHTTPクライアントツール
- [ ] エラーメッセージの分析能力

### 攻撃フロー
```
1️⃣ 攻撃者が開発環境のエンドポイントを特定
   - 開発サーバーのURL（例: http://dev.example.com）
   - またはlocalhostへのアクセス
   ↓
2️⃣ vuln-003: Base64バリデーション不足を悪用
   - 様々な不正なBase64データを送信
   - 例: 非Base64文字、切り詰められたデータ、巨大なデータ
   ↓
3️⃣ Gemini APIでエラーが発生
   - 400 Bad Request: 無効なデータ形式
   - 500 Internal Server Error: API処理エラー
   - タイムアウトエラー
   ↓
4️⃣ vuln-001: 開発環境でのエラー露出
   - サーバーが詳細なエラーメッセージを返す
   - 以下の情報が含まれる可能性:
     * Gemini APIのエンドポイントURL
     * APIリクエストの構造
     * 使用しているライブラリのバージョン
     * ファイルパスとディレクトリ構造
     * 内部ロジックの詳細
   ↓
5️⃣ 攻撃者が情報を分析
   - APIの仕様を理解
   - より高度な攻撃ベクターを特定
   - セキュリティ脆弱性を探索
   ↓
6️⃣ 結果: 情報漏洩と二次攻撃の準備
   - 内部実装の詳細が露出
   - 攻撃者がより効果的な攻撃を計画可能
```

### 所要時間
- **準備**: 5分（開発環境の特定）
- **情報収集**: 10-15分（様々なペイロードを試行）
- **分析**: 15-30分（エラーメッセージの解析）
- **合計**: 約30-50分で内部実装の詳細を取得可能

## 🎭 影響評価

### CVSS 3.1: 5.8 (Medium)
```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L
```

- **AV (Attack Vector)**: Network - ネットワーク経由で攻撃可能
- **AC (Attack Complexity)**: Low - 特別な準備不要
- **PR (Privileges Required)**: None - 認証不要
- **UI (User Interaction)**: None - ユーザー操作不要
- **S (Scope)**: Unchanged - 影響範囲は限定的
- **C (Confidentiality)**: Low - 一部の情報漏洩
- **I (Integrity)**: None - 完全性への影響なし
- **A (Availability)**: Low - 可用性への軽微な影響（リソース消費）

### ビジネスインパクト
- **直接影響**:
  - 内部実装の詳細が露出
  - Gemini APIの使用方法が判明
  - 使用しているライブラリやフレームワークのバージョンが露出
  - ファイルパスやディレクトリ構造の漏洩

- **二次影響**:
  - 露出した情報を元にした高度な攻撃（SQL Injection, RCE等）
  - APIキーやトークンの形式が判明し、ブルートフォース攻撃のリスク
  - セキュリティホールの特定と悪用
  - 競合他社への技術情報の漏洩

## 🛡️ 包括的対策

### 緊急対応（即時実施）
1. **vuln-001修正**: 開発環境でもエラー情報を最小化
   ```javascript
   // api/middleware/errorHandler.js
   function errorHandler(err, req, res, next) {
       const isDevelopment = process.env.NODE_ENV === 'development';
       const errorId = crypto.randomUUID();

       // すべての環境でエラーIDベースのログ記録
       console.error(`Error ID ${errorId}:`, {
           message: err?.message || 'Unknown error',
           stack: err?.stack,
           timestamp: new Date().toISOString()
       });

       // 開発環境でも一般的なエラーメッセージを返す
       // 詳細はサーバーログのみに記録
       const sendResponse = (status, message) => {
           const response = {
               error: message,
               errorId: errorId
           };
           return res.status(status).json(response);
       };

       // Gemini API error handling
       if (rawMessage.includes('Gemini API error')) {
           const statusMatch = rawMessage.match(/(\d{3})/);
           const status = statusMatch ? parseInt(statusMatch[1]) : 500;

           if (status === 429) {
               return sendResponse(429, 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。');
           } else if (status === 401 || status === 403) {
               return sendResponse(500, 'サーバーの設定エラーです。管理者に連絡してください。');
           }
       }

       // 一般的なエラーハンドリング
       const status = err.status || err.statusCode || 500;
       const messageForClient = getGenericMessageForStatus(status) ||
           'サーバーエラーが発生しました。しばらくしてから再試行してください。';

       return sendResponse(status, messageForClient);
   }
   ```

2. **vuln-003修正**: Base64バリデーションの実装
   ```javascript
   // api/routes/ocr.js
   function isValidBase64Sample(str) {
       if (!str || typeof str !== 'string' || str.length === 0) {
           return false;
       }

       const samples = [
           str.substring(0, 100),
           str.substring(Math.floor(str.length / 2) - 50, Math.floor(str.length / 2) + 50),
           str.substring(str.length - 100)
       ];

       const base64Regex = /^[A-Za-z0-9+/=]*$/;
       return samples.every(sample => base64Regex.test(sample));
   }

   // バリデーションを追加
   if (!isValidBase64Sample(cleanedBase64Data)) {
       return res.status(400).json({
           error: '無効な画像形式です',
           errorId: crypto.randomUUID()
       });
   }
   ```

### 長期対策
- [ ] **環境分離の徹底**: 開発環境を外部ネットワークから完全に分離
  ```bash
  # 開発環境はVPN経由でのみアクセス可能にする
  # または、ローカル環境でのみ起動
  ```

- [ ] **エラーログの集約とモニタリング**: 中央ログシステムの導入
  ```javascript
  // Sentry, Datadog, CloudWatch Logs等を使用
  import * as Sentry from '@sentry/node';

  Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV
  });

  // エラーハンドラー内で
  Sentry.captureException(err);
  ```

- [ ] **セキュリティヘッダーの追加**: 情報漏洩を防ぐ
  ```javascript
  // api/index.js
  app.use(helmet({
      contentSecurityPolicy: true,
      hsts: true,
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true // X-Powered-By ヘッダーを削除
  }));

  // カスタムヘッダーを削除
  app.disable('x-powered-by');
  ```

- [ ] **入力バリデーションの全体的な強化**: すべてのエンドポイントで実施
  ```javascript
  // バリデーションミドルウェアの導入
  const { body, validationResult } = require('express-validator');

  router.post('/',
      limiter,
      [
          body('image').isString().notEmpty(),
          body('image').custom(value => {
              if (!value.startsWith('data:image/')) {
                  throw new Error('Invalid image format');
              }
              return true;
          })
      ],
      (req, res, next) => {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
              return res.status(400).json({
                  error: 'リクエストが不正です',
                  errorId: crypto.randomUUID()
              });
          }
          next();
      },
      async (req, res, next) => {
          // OCR処理
      }
  );
  ```

## 🔬 検証PoC

**警告**: 教育目的のみ。許可なく実行しないこと。

```bash
#!/bin/bash

# 情報漏洩シミュレーションスクリプト
DEV_ENDPOINT="http://localhost:3000/api/ocr"

echo "Starting information disclosure test..."

# テストケース1: 非Base64文字を含むデータ
echo "Test 1: Invalid Base64 characters"
curl -X POST "$DEV_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,InvalidData!!!@@@"}' \
  -v 2>&1 | grep -A 20 "error"

# テストケース2: 切り詰められたBase64データ
echo "Test 2: Truncated Base64 data"
curl -X POST "$DEV_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,iVBORw0K"}' \
  -v 2>&1 | grep -A 20 "error"

# テストケース3: 空のBase64データ
echo "Test 3: Empty Base64 data"
curl -X POST "$DEV_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,"}' \
  -v 2>&1 | grep -A 20 "error"

echo "Information disclosure test completed"

# 期待される結果（修正前）:
# - 詳細なエラーメッセージとスタックトレース
# - Gemini APIのエンドポイントURL
# - 内部ファイルパス
#
# 期待される結果（修正後）:
# - 一般的なエラーメッセージのみ
# - エラーIDが含まれる
# - 詳細情報はサーバーログのみ
```

## 📊 検出コンテキスト

### 検出経緯
- **イテレーション1**: vuln-001（開発環境エラー露出）を検出
- **イテレーション1**: vuln-003（Base64バリデーション不足）を検出
- **イテレーション1**: 2つの脆弱性を組み合わせた情報漏洩チェーンを認識

### 関連する既知の攻撃
- Error-based SQL Injection（エラーメッセージを利用した攻撃）
- Stack Trace Exploitation（スタックトレースからの情報収集）
- API Fingerprinting（APIの指紋採取）

### 実際の事例
- 2019年: Capital One データ漏洩事件（詳細なエラーメッセージからAWSメタデータサービスへのアクセスが可能に）
- 2020年: 複数のNode.jsアプリケーションでスタックトレース露出による情報漏洩

---
*Chain Analysis | 2025-11-24 00:53:00 JST*
