# vuln-008: Rate Limit Bypass (レート制限バイパス)

## 脆弱性の詳細
`api/routes/ocr.js` において、Serverless環境（Vercelなど）でのレート制限の実装に懸念があります。
現在はRedisが設定されていない場合、`process.env.NODE_ENV === 'production'` であればローカルメモリ（インスタンスごとのメモリ）を使用して制限（1回/時間）をかけていますが、Serverless関数はリクエストごとにインスタンスが再作成される可能性があるため、メモリ上のレート制限情報は永続化されず、実質的にレート制限が機能しない（バイパスされる）可能性があります。

```javascript
const limitMax = store ? 100 : (process.env.NODE_ENV === 'production' ? 1 : 100);
```

## 修正対象ファイル
- `api/routes/ocr.js`

## 修正内容 (タスク)
1. `api/routes/ocr.js` を開く。
2. 本番環境 (`NODE_ENV === 'production'`) においては、Redis設定（`process.env.KV_URL` または `process.env.REDIS_URL`）を**必須**とするように変更する。
3. もしRedisのURLが設定されていない場合は、サーバー起動時（またはリクエスト処理時）にエラーをスローして停止させるか、あるいは「OCR機能自体を無効化（503 Service Unavailableを返す）」する安全なフェイルセーフモードにする。

   推奨アクション:
   > Production環境でRedisを必須化。Redis未設定時にエラーをスロー。

   修正案:
   ```javascript
   // Redisクライアントの初期化
   const redisUrl = process.env.KV_URL || process.env.REDIS_URL;
   let store;

   if (redisUrl) {
       // ... 既存の設定
   } else if (process.env.NODE_ENV === 'production') {
       // 修正: 警告だけでなく、OCR機能を無効化するか、起動を阻止する
       // ここでは、APIエンドポイントが呼ばれた際にエラーを返すように構成する方が
       // アプリ全体のクラッシュを防げるため安全かもしれないが、
       // セキュリティ要件としては「バイパスを防ぐ」ことが重要。

       console.error('CRITICAL SECURITY ERROR: Redis URL is missing in production. Rate limiting cannot be enforced.');

       // 強制的にエラーにするためのフラグ
       // または、ここで process.exit(1) するのも選択肢だが、VercelだとFunctionごとの起動なので
       // リクエストごとに落ちることになる。
   }

   // ...

   router.post('/', limiter, async (req, res, next) => {
       // Redis未設定の本番環境なら即拒否
       if (process.env.NODE_ENV === 'production' && !store) {
           return res.status(503).json({
               error: 'サーバー設定エラー: レート制限データベースが設定されていません。'
           });
       }

       // ...
   ```

   より厳格にするなら、`limiter` の定義自体を見直し、`store` がない場合は常に拒否するカスタムミドルウェアを挟む。

   ```javascript
   const limiter = store ? rateLimit({ ... }) : (req, res, next) => {
       if (process.env.NODE_ENV === 'production') {
           return res.status(503).json({ error: 'Service unavailable due to security configuration' });
       }
       next(); // 開発環境ならスルー（またはメモリ制限）
   };
   ```

   ただし、開発環境（`store`なし）では `rateLimit({ store: undefined })` (メモリ) を使いたいので、

   ```javascript
   let limiter;
   if (store) {
       limiter = rateLimit({ /* Redis store */ });
   } else if (process.env.NODE_ENV === 'production') {
       // 本番でRedisなし -> 全拒否
       limiter = (req, res) => res.status(503).json({ error: 'Rate limiting configuration missing' });
   } else {
       // 開発環境 -> メモリ
       limiter = rateLimit({ /* Memory store */ });
   }
   ```

## 検証方法
1. `NODE_ENV=production` かつ Redis URL未設定の状態で `api/routes/ocr.js` のエンドポイントを叩き、503エラー（または設定したエラー）が返ることを確認する。
2. Redis URLを設定した場合（モックなど）、正常にレート制限が機能することを確認する。
