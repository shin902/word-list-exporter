# 🟡 設定の誤り - CORS設定の誤設定リスク

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: javascript
category: config
cwe_id: CWE-16
cvss_score: 5.3
severity: Medium
priority: P1
discovered: 2025-11-24 00:46
status: New
related_vulns: []
```

## 🎯 要約
FRONTEND_URL環境変数が未設定の場合、開発環境では固定のオリジン（http://localhost:5500）にフォールバックしますが、本番環境では警告のみでCORSがすべてのリクエストをブロックします。誤設定によるセキュリティリスクまたは可用性の問題が発生する可能性があります。

## 📍 発生場所
- **ファイル**: `api/index.js`
- **行番号**: L14-26
- **関数**: N/A（トップレベル設定）
- **エンドポイント**: すべてのAPIエンドポイント

## 💣 詳細

### 問題コード
```javascript
// L14-26
const allowedOrigin = process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:5500' : false);

if (!allowedOrigin && process.env.NODE_ENV !== 'test') {
    console.warn('WARNING: FRONTEND_URL is not set. CORS will block all requests.');
}

app.use(cors({
    origin: allowedOrigin,
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));
```

### 根本原因
- FRONTEND_URL環境変数が未設定の場合のフォールバック処理が環境依存
- 本番環境で`allowedOrigin = false`の場合、CORSがすべてのリクエストを拒否
- 開発環境では固定のオリジン（localhost:5500）が使用され、異なるポートからのアクセスが拒否される

### 攻撃シナリオ

#### シナリオ1: 本番環境での可用性の問題
1. 管理者が FRONTEND_URL を設定し忘れる
2. 本番環境でデプロイ
3. すべてのCORSリクエストが拒否される
4. フロントエンドがAPIにアクセスできず、サービスが利用不可能に

#### シナリオ2: 開発環境での意図しないアクセス拒否
1. 開発者が異なるポート（例: 3000, 8080）でフロントエンドを起動
2. FRONTEND_URLが未設定
3. `http://localhost:5500` 以外からのリクエストがすべて拒否される
4. 開発作業が妨げられる

#### シナリオ3: セキュリティ設定の見落とし
1. 開発環境から本番環境への移行時に FRONTEND_URL を適切に設定しない
2. 本番環境で予期しない動作が発生
3. 緊急対応として CORS を完全にオープンにする（`origin: '*'`）などの誤った修正を実施
4. セキュリティリスクが増大

### 影響範囲
- **機密性**: Low - 適切な CORS 設定がない場合、意図しないオリジンからのアクセスを許可する可能性
- **完全性**: None
- **可用性**: Medium - 誤設定により API が利用不可能になる
- **影響ユーザー**: すべてのユーザー

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- FRONTEND_URL環境変数が未設定
- 本番環境またはテスト環境でサーバーを起動

### 再現ステップ
```bash
# ケース1: FRONTEND_URLが未設定で本番環境として起動
NODE_ENV=production node api/index.js

# コンソールに警告が表示される：
# WARNING: FRONTEND_URL is not set. CORS will block all requests.

# 別のターミナルからリクエスト
curl -X POST http://localhost:3000/api/ocr \
  -H "Origin: http://example.com" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'

# 期待される結果: CORS エラー
# Access to XMLHttpRequest at 'http://localhost:3000/api/ocr' from origin 'http://example.com' has been blocked by CORS policy

# ケース2: 開発環境で異なるポートから接続
NODE_ENV=development node api/index.js

curl -X POST http://localhost:3000/api/ocr \
  -H "Origin: http://localhost:8080" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'

# 期待される結果: CORS エラー（localhost:5500 のみ許可されているため）
```

## 🛡️ 推奨対策

### 短期
- [ ] FRONTEND_URL の必須化: 本番環境では FRONTEND_URL が未設定の場合、サーバー起動を拒否する
  ```javascript
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
      throw new Error('FATAL: FRONTEND_URL must be configured in production');
  }
  ```
- [ ] 起動時のバリデーション強化: 環境変数の検証を `api/config.js` に追加
- [ ] 開発環境でのフォールバック値をドキュメント化

### 長期
- [ ] 環境変数チェックリストの作成: デプロイ前に必須の環境変数を確認
- [ ] 自動テストの追加: 本番環境相当の設定でCORSが正しく動作するかを検証
- [ ] マルチオリジンサポート: 複数の許可されたオリジンをサポート
  ```javascript
  const allowedOrigins = (process.env.FRONTEND_URLS || '').split(',').filter(Boolean);
  app.use(cors({
      origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
          } else {
              callback(new Error('Not allowed by CORS'));
          }
      }
  }));
  ```

## 🔗 参考
- OWASP: https://owasp.org/www-community/attacks/cors-OriginHeaderScrutiny
- CWE: https://cwe.mitre.org/data/definitions/16.html
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

---
*Iteration 1 | 2025-11-24 00:46:00 JST*
