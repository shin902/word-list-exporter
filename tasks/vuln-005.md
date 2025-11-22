# vuln-005: CORS Misconfiguration (CORS設定不備)

## 脆弱性の詳細
`api/index.js` において、CORSの設定が `process.env.FRONTEND_URL || false` となっています。
`FRONTEND_URL` が設定されていない場合、`false` になり、CORSが無効化（または全てのオリジンがブロック）される可能性がありますが、開発環境などで不便が生じたり、設定ミスにより意図しない動作をする可能性があります。
また、推奨アクションとして「デフォルト値の追加」「環境変数バリデーション」が挙げられています。

## 修正対象ファイル
- `api/index.js`

## 修正内容 (タスク)
1. `api/index.js` を開く。
2. `cors` の設定部分を修正し、開発環境用のデフォルト値の設定や、より堅牢な設定を行う。

   ```javascript
   // api/index.js

   // 環境変数またはデフォルト値を使用
   const allowedOrigins = process.env.FRONTEND_URL
       ? [process.env.FRONTEND_URL]
       : ['http://localhost:3000']; // 開発用のデフォルト

   app.use(cors({
       origin: function (origin, callback) {
           // モバイルアプリやcurlからのリクエストなどでoriginがない場合を許可するかはポリシーによる
           // ここではセキュリティを重視しつつ、指定されたオリジンを許可する
           if (!origin || allowedOrigins.indexOf(origin) !== -1) {
               callback(null, true);
           } else {
               callback(new Error('Not allowed by CORS'));
           }
       },
       methods: ['POST', 'GET'],
       allowedHeaders: ['Content-Type'],
       credentials: false // 必要に応じてtrue
   }));
   ```

   または、推奨アクションに従い、環境変数のチェックを強化するだけでも良い。

   ```javascript
   // シンプルな修正案
   const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

   app.use(cors({
       origin: frontendUrl,
       // ...
   }));
   ```

## 検証方法
1. `FRONTEND_URL` を設定せずに起動し、`http://localhost:3000` からのアクセス（自身のフロントエンドなど）が許可されることを確認する。
2. 異なるオリジン（例: `http://example.com`）からAPIを叩いた場合にCORSエラーになることを確認する。
