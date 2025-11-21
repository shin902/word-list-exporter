# 🟡 VULN-008: レート制限バイパス - Redis設定の必須化

## 概要
Vercel等のServerless環境でRedisが未設定の場合、レート制限がインスタンスごとに独立して動作し、実質的にバイパス可能になります。

## 脆弱性情報
- **ID**: vuln-008
- **カテゴリ**: Rate Limit Bypass (CWE-770)
- **重大度**: 🟡 Medium (CVSS: 5.3)
- **優先度**: P2（1週間以内）
- **影響ファイル**: `api/routes/ocr.js:10-37`

## 実装タスク

### タスク1: 本番環境でのRedis必須化
- [ ] `api/routes/ocr.js`を修正
- [ ] 本番環境でRedisが未設定の場合、エラーをスロー
- [ ] 開発環境では警告を表示するが動作を継続

### タスク2: 環境変数バリデーションの実装
- [ ] 起動時に本番環境での環境変数確認を追加
- [ ] `KV_URL`または`REDIS_URL`の存在をチェック

### タスク3: Redisの設定（本番環境）
- [ ] Vercel KVまたは外部Redisサービスを設定
- [ ] 環境変数`KV_URL`または`REDIS_URL`を設定
- [ ] Vercelダッシュボードまたは`vercel env add`コマンドで設定

### タスク4: ドキュメントの更新
- [ ] README.mdに本番環境での必須設定としてRedisを明記
- [ ] `.env.example`に`KV_URL`または`REDIS_URL`の設定例を追加
- [ ] デプロイ手順にRedis設定を追加

### タスク5: テスト
- [ ] 開発環境でRedis未設定でサーバーが起動することを確認
- [ ] 本番環境（`NODE_ENV=production`）でRedis未設定の場合、エラーが発生することを確認
- [ ] Redis設定後、レート制限が正常に動作することを確認

## 修正コード例

### api/routes/ocr.js
```javascript
// ❌ Before (api/routes/ocr.js:10-37付近)
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
} else {
    console.warn('WARNING: Redis is not configured. Rate limiting will be ineffective in serverless environments.');
}
```

## Vercel KVの設定手順

### コマンドラインから
```bash
# Vercel KVストアを作成
vercel env add KV_URL

# または、既存のRedisサービスを使用
vercel env add REDIS_URL
```

### Vercelダッシュボードから
1. Vercelダッシュボードにアクセス
2. プロジェクトを選択
3. "Storage" タブに移動
4. "Create Database" → "KV Database" を選択
5. データベース名を入力して作成
6. 環境変数が自動的に設定される

## 代替Redisサービス
- **Vercel KV** (推奨): Vercel環境に最適化
- **Upstash Redis**: サーバーレス対応、従量課金
- **Redis Cloud**: Managed Redis サービス
- **AWS ElastiCache**: AWS環境の場合

## 成功基準
- [ ] 本番環境でRedis未設定の場合、サーバーが起動しない
- [ ] 開発環境では警告が表示されるが動作する
- [ ] Redis設定後、レート制限が正常に動作する
- [ ] 短時間に大量のリクエストを送信しても、レート制限が適用される
- [ ] Redisの設定方法がドキュメント化されている

## テスト手順

### レート制限のテスト
```bash
# 短時間に複数リクエストを送信
for i in {1..20}; do
  curl -X POST https://your-app.vercel.app/api/ocr \
    -H "Content-Type: application/json" \
    -d '{"image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}' &
done

# 期待される結果: 100リクエスト以降は429エラーが返される
```

## 参考資料
- [OWASP Unrestricted Resource Consumption](https://owasp.org/www-community/vulnerabilities/Unrestricted_Resource_Consumption)
- [CWE-770](https://cwe.mitre.org/data/definitions/770.html)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- [Serverless Rate Limiting Best Practices](https://www.serverless.com/blog/rate-limiting-serverless-functions)

## 関連ファイル
- `api/routes/ocr.js`
- `README.md`
- `.env.example`
- `vercel.json` (存在する場合)
