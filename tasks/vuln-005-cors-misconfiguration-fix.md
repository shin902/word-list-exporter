# 🟡 VULN-005: CORS設定の誤り - デフォルト値の追加

## 概要
CORS設定で`FRONTEND_URL`環境変数が未設定の場合、`origin: false`となり、すべてのクロスオリジンリクエストが拒否されます。開発環境や本番環境での運用に支障をきたす可能性があります。

## 脆弱性情報
- **ID**: vuln-005
- **カテゴリ**: Configuration (CWE-942)
- **重大度**: 🟡 Medium (CVSS: 5.3)
- **優先度**: P2（1週間以内）
- **影響ファイル**: `api/index.js:13-18`

## 実装タスク

### タスク1: CORS設定にデフォルト値を追加
- [ ] `api/index.js`の13-18行目を修正
- [ ] 開発環境用のデフォルトオリジンを設定
- [ ] 本番環境で未設定の場合は警告を表示

### タスク2: 環境変数バリデーションの追加
- [ ] 起動時に本番環境での環境変数の存在確認を実装
- [ ] 本番環境で`FRONTEND_URL`が未設定の場合はエラーをスロー（オプション）

### タスク3: ドキュメントの更新
- [ ] `.env.example`に`FRONTEND_URL`の設定例を追加（既に存在する場合は確認）
- [ ] README.mdに環境変数の設定方法を明記

### タスク4: テスト
- [ ] `FRONTEND_URL`を設定した状態でサーバーを起動し、CORS が正常に動作することを確認
- [ ] `FRONTEND_URL`を未設定の状態で開発環境でサーバーを起動し、デフォルト値が使用されることを確認
- [ ] 異なるオリジンからAPIにリクエストを送信し、CORSヘッダーが正しく設定されることを確認

## 修正コード例

```javascript
// ❌ Before (api/index.js:13-18)
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

## 環境変数バリデーション例（オプション）

```javascript
// 起動時のバリデーション
function validateEnvironment() {
    if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
        throw new Error('FRONTEND_URL must be set in production environment');
    }
}

// サーバー起動前に実行
validateEnvironment();
```

## 成功基準
- [ ] 開発環境で`FRONTEND_URL`未設定でもサーバーが起動する
- [ ] 本番環境で`FRONTEND_URL`未設定の場合は警告が表示される
- [ ] CORS設定が正常に動作する
- [ ] 環境変数の設定方法がドキュメント化されている

## 参考資料
- [OWASP CSRF](https://owasp.org/www-community/attacks/csrf)
- [CWE-942](https://cwe.mitre.org/data/definitions/942.html)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## 関連ファイル
- `api/index.js`
- `.env.example`
- `README.md`
