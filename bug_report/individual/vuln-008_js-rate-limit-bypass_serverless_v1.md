# 🟡 レート制限バイパス - Serverless環境での無効化

## メタデータ
```yaml
id: vuln-008
version: v1
iteration: 2
language: javascript
category: rate-limit
cwe_id: CWE-770
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2025-11-21 00:00
status: New
related_vulns: []
```

## 🎯 要約
Vercel等のServerless環境でRedisが未設定の場合、レート制限がインスタンスごとに独立して動作し、実質的にバイパス可能になります。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L10-37
- **関数**: レート制限ミドルウェア設定
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```javascript
// Redisクライアントの初期化（環境変数が設定されている場合）
const redisUrl = process.env.KV_URL || process.env.REDIS_URL;
let store;

if (redisUrl) {
    const client = new Redis(redisUrl);
    store = new RedisStore({
        sendCommand: (...args) => client.call(...args),
    });
} else if (process.env.NODE_ENV === 'production') {
    console.warn('WARNING: Redis is not configured in production environment. Rate limiting will be ineffective across multiple instances (Serverless). Enforcing strict local limits.');
}

// レート制限の設定
// Redisが設定されている場合は外部ストアを使用し、標準的な制限（100リクエスト/時間）を適用
// Redisが設定されていない場合（特にProduction環境）、Serverless環境でのバイパスを防ぐため
// 極端に厳しい制限（1リクエスト/時間/インスタンス）を適用するか、管理者への警告とする。
const limitMax = store ? 100 : (process.env.NODE_ENV === 'production' ? 1 : 100);
const limitMessage = store
    ? 'レート制限に達しました。1時間後に再試行してください。'
    : 'Security Warning: Redis is not configured. Rate limit exceeded for this instance.';

const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: limitMax,
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: limitMessage }
});
```

### 根本原因
- Serverless環境（Vercel、AWS Lambda等）では、各リクエストが異なるインスタンス（コンテナ）で処理される可能性がある
- Redisが未設定の場合、`express-rate-limit`はメモリストアを使用
- メモリストアはインスタンスごとに独立しているため、攻撃者が複数回リクエストを送信すると、毎回異なるインスタンスが処理し、レート制限が適用されない
- コード内では`limitMax = 1`（Production環境）と厳しく設定しているが、Serverlessの特性により実質的に無効

### 攻撃シナリオ
1. 攻撃者がProduction環境のAPIエンドポイント`/api/ocr`を発見
2. 環境変数を確認し、Redisが設定されていないことを推測（エラーメッセージから）
3. 短時間に大量のリクエストを送信（例：100リクエスト/秒）
4. Serverless環境が各リクエストを別のインスタンスで処理
5. 各インスタンスのメモリストアは独立しているため、レート制限が適用されない
6. Gemini APIへの大量のリクエストが送信され、API料金が増大
7. または、Gemini APIのレート制限に達し、正規ユーザーがサービスを利用できなくなる

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: High（DoS攻撃、API料金の増大）
- **影響ユーザー**: すべてのユーザー（正規ユーザーもサービス利用不可）、運営者（コスト増大）

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- Production環境（Vercel等）にデプロイ済み
- Redisが未設定（KV_URL、REDIS_URLが未設定）
- 大量のリクエストを送信できるツール（curl, Apache Bench, wrkなど）

### 再現ステップ
```bash
# 1. 環境確認（Redisが未設定であることを確認）
# レスポンスヘッダーに "RateLimit-*" が含まれているか確認

# 2. 短時間に複数リクエストを送信
for i in {1..20}; do
  curl -X POST https://your-app.vercel.app/api/ocr \
    -H "Content-Type: application/json" \
    -d '{"image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}' &
done

# 3. すべてのリクエストが成功することを確認
# 通常、Redisがあれば100リクエスト以降は429エラーが返るはずだが、
# Serverless環境では各インスタンスが独立しているため、すべて成功する可能性がある

# 4. Gemini APIの使用量を確認し、大量のリクエストが送信されたことを確認
```

## 🛡️ 推奨対策

### 短期
- [ ] Production環境では必ずRedisを設定する
- [ ] Redisが未設定の場合、APIを起動しない（エラーをスロー）
- [ ] 以下のように修正：
  ```javascript
  // ❌ Before
  if (redisUrl) {
      const client = new Redis(redisUrl);
      store = new RedisStore({
          sendCommand: (...args) => client.call(...args),
      });
  } else if (process.env.NODE_ENV === 'production') {
      console.warn('WARNING: Redis is not configured...');
  }

  // ✅ After
  if (process.env.NODE_ENV === 'production' && !redisUrl) {
      throw new Error('FATAL: Redis (KV_URL or REDIS_URL) must be configured in production for rate limiting to work correctly in serverless environment.');
  }

  if (redisUrl) {
      const client = new Redis(redisUrl);
      store = new RedisStore({
          sendCommand: (...args) => client.call(...args),
      });
  }
  ```

### 長期
- [ ] Vercel KV（@vercel/kv）を使用してRedisストアを設定
  ```bash
  # Vercel KVの設定
  vercel env add KV_URL
  # または、Vercelダッシュボードから設定
  ```
- [ ] 環境変数バリデーションを起動時に実行（api/config.jsに追加）
  ```javascript
  // api/config.js
  function validateConfig() {
      if (process.env.NODE_ENV === 'production') {
          if (!process.env.KV_URL && !process.env.REDIS_URL) {
              throw new Error('Production環境ではKV_URLまたはREDIS_URLが必須です');
          }
      }
      // ...
  }
  ```
- [ ] CI/CDパイプラインで環境変数の存在確認
- [ ] README.mdに本番環境での必須設定としてRedisを明記
- [ ] 代替案として、Cloudflare Workers KV、Upstash Redis等のサーバーレス対応KVストアを検討
- [ ] モニタリングとアラート設定（異常なリクエスト数を検知）

## 🔗 参考
- OWASP: https://owasp.org/www-community/vulnerabilities/Unrestricted_Resource_Consumption
- CWE: https://cwe.mitre.org/data/definitions/770.html
- Express Rate Limit: https://github.com/express-rate-limit/express-rate-limit
- Vercel KV: https://vercel.com/docs/storage/vercel-kv
- Serverless Rate Limiting Best Practices: https://www.serverless.com/blog/rate-limiting-serverless-functions

---
*Iteration 2 | 2025-11-21 00:00 JST*
