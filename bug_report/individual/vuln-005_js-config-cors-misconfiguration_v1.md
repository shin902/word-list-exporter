# 🟡 設定不備 - CORS設定の誤り

## メタデータ
```yaml
id: vuln-005
version: v1
iteration: 1
language: javascript
category: config
cwe_id: CWE-942
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2025-11-21 00:00
status: New
related_vulns: []
```

## 🎯 要約
CORS設定で`FRONTEND_URL`環境変数が未設定の場合、`origin: false`となり、すべてのクロスオリジンリクエストが拒否されます。開発環境や本番環境での運用に支障をきたす可能性があります。

## 📍 発生場所
- **ファイル**: `api/index.js`
- **行番号**: L13-18
- **関数**: `app.use(cors())`
- **エンドポイント**: すべてのAPIエンドポイント

## 💣 詳細

### 問題コード
```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL || false,
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));
```

### 根本原因
- `FRONTEND_URL`環境変数が未設定の場合、`origin: false`となる
- `origin: false`はすべてのオリジンからのリクエストを拒否する設定
- 開発環境で環境変数が未設定の場合、フロントエンドからAPIにアクセスできない
- エラーメッセージが不明瞭で、デバッグが困難

### 攻撃シナリオ
直接的な攻撃シナリオはありませんが、以下の問題が発生します：

1. **開発環境での問題**:
   - 開発者が環境変数を設定し忘れる
   - フロントエンドからAPIにアクセスできず、CORSエラーが発生
   - 原因の特定に時間がかかる

2. **本番環境での問題**:
   - デプロイ時に環境変数が設定されていない
   - サービスが完全に機能しない
   - ユーザーがアプリケーションを使用できない

3. **セキュリティ上の問題**:
   - 修正を急いで`origin: '*'`（すべてのオリジンを許可）に変更してしまう
   - CSRF攻撃のリスクが増大

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: High（環境変数未設定時にサービスが利用不可）
- **影響ユーザー**: すべてのユーザー（環境変数未設定の場合）

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- `FRONTEND_URL`環境変数が未設定
- フロントエンドとバックエンドが別のオリジンで動作

### 再現ステップ
```bash
# 1. FRONTEND_URL環境変数を削除
unset FRONTEND_URL

# 2. サーバーを起動
node api/index.js

# 3. ブラウザから別のオリジン（例: http://localhost:5500）でindex.htmlを開く

# 4. 画像インポート機能を使用してAPIにリクエスト

# 5. ブラウザコンソールでCORSエラーを確認:
# Access to fetch at 'http://localhost:3000/api/ocr' from origin 'http://localhost:5500'
# has been blocked by CORS policy: Response to preflight request doesn't pass access control check
```

## 🛡️ 推奨対策

### 短期
- [ ] デフォルト値を設定し、開発環境でも動作するようにする
- [ ] 以下のように修正：
  ```javascript
  // ❌ Before
  app.use(cors({
      origin: process.env.FRONTEND_URL || false,
      methods: ['POST', 'GET'],
      allowedHeaders: ['Content-Type'],
      credentials: false
  }));

  // ✅ After
  const allowedOrigin = process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === 'development' ? 'http://localhost:5500' : false);

  if (!allowedOrigin) {
      console.warn('WARNING: FRONTEND_URL is not set. CORS will block all requests.');
  }

  app.use(cors({
      origin: allowedOrigin,
      methods: ['POST', 'GET'],
      allowedHeaders: ['Content-Type'],
      credentials: false
  }));
  ```

### 長期
- [ ] 環境変数のバリデーションを起動時に実行
  ```javascript
  // 起動時のバリデーション
  function validateEnvironment() {
      if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
          throw new Error('FRONTEND_URL must be set in production environment');
      }
  }
  validateEnvironment();
  ```
- [ ] `.env.example`に`FRONTEND_URL`の設定例を追加（既に追加済み）
- [ ] README.mdに環境変数の設定方法を明記
- [ ] CI/CDパイプラインで環境変数の存在確認
- [ ] 本番環境では複数のオリジンをサポートする場合、配列で指定
  ```javascript
  const allowedOrigins = (process.env.FRONTEND_URLS || '').split(',').filter(Boolean);
  app.use(cors({
      origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
          } else {
              callback(new Error('Not allowed by CORS'));
          }
      },
      // ...
  }));
  ```

## 🔗 参考
- OWASP: https://owasp.org/www-community/attacks/csrf
- CWE: https://cwe.mitre.org/data/definitions/942.html
- Express CORS Middleware: https://expressjs.com/en/resources/middleware/cors.html
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

---
*Iteration 1 | 2025-11-21 00:00 JST*
