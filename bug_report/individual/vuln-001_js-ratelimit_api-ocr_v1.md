# 🔴 DoS - Serverless環境でのレート制限回避

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: javascript
category: rate-limit
cwe_id: CWE-770
cvss_score: 5.3
severity: Medium
priority: P1
discovered: 2024-10-27 12:15
status: New
related_vulns: []
```

## 🎯 要約
Redisが未設定の場合、インメモリのレート制限が使用されますが、VercelなどのServerless環境ではプロセス間でメモリが共有されないため、レート制限が機能せず、高価なGemini APIへのDoS攻撃や課金攻撃が可能になります。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L14-L28
- **関数**: (Top level execution)
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
}

// レート制限: 1時間あたり100リクエスト
// Redisが設定されている場合は外部ストアを使用し、そうでない場合はメモリ（デフォルト）を使用
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: store, // storeがundefinedの場合、MemoryStoreが使われる
    message: { error: 'レート制限に達しました。1時間後に再試行してください。' }
});
```

### 根本原因
- `express-rate-limit` のデフォルトである `MemoryStore` は、単一プロセス内でのみ状態を保持します。
- `vercel.json` によると、このアプリは Vercel Functions (AWS Lambda) 上で動作します。
- Serverless関数はリクエストごとに新しいインスタンスが起動する可能性があり、また複数のインスタンスが並列稼働するため、メモリ上のカウンタは共有されません。
- 攻撃者は並列リクエストを送ることで、容易に制限（1時間100回）を突破できます。

### 攻撃シナリオ
1. 攻撃者が `POST /api/ocr` に対してスクリプトを用いて大量のリクエストを送信する。
2. 各リクエストが異なる（または再起動した）Serverlessインスタンスで処理される場合、カウントは常に「1」または低い値となる。
3. レート制限エラーが発生せず、全てのリクエストがGemini APIに転送される。
4. Google Gemini APIの利用枠（Quota）を枯渇させるか、従量課金の場合は高額な請求が発生する。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Medium (API枯渇によるサービス停止)
- **経済的損失**: High (高価なLLM API呼び出し)

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- Redis環境変数が設定されていない環境（デフォルトのVercelデプロイなど）。

### 再現ステップ
```bash
# 並列リクエストを送信してレート制限が機能していないことを確認する概念実証
for i in {1..105}; do
  curl -X POST https://target-url/api/ocr \
       -H "Content-Type: application/json" \
       -d '{"image": "data:image/png;base64,..."}' &
done
```
期待される挙動：101回目以降は429エラーになるべきだが、Serverless環境では全て200 OK（またはGeminiエラー）となる。

## 🛡️ 推奨対策

### 短期
- [ ] Vercel KV (Redis) などの永続ストアを必須化し、Redis接続がない場合は起動しない、または極端に厳しい制限をかけるように変更する。

### 長期
- [ ] アプリケーションレベルではなく、インフラレベル（Vercel Edge Middleware, WAF, API Gateway）でのレート制限を導入する。

## 🔗 参考
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html
- CWE: https://cwe.mitre.org/data/definitions/770.html

---
*Iteration 1 | 2024-10-27 12:15*
