# 🟠 Rate Limiting Bypass - Serverless環境でのレート制限不備

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: js
category: rce
cwe_id: CWE-770
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2024-05-21 10:10
status: New
related_vulns: []
```

## 🎯 要約
Serverless環境（Vercel）において、インメモリストアを使用したレート制限はインスタンスの再起動ごとにリセットされるため、攻撃者が制限を回避してAPIを乱用可能です。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L9-L14
- **関数**: `rateLimit({...})`
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```js
// レート制限: 1時間あたり100リクエスト
// 注意: VercelなどのServerless環境ではメモリ上のストアはリクエスト毎にリセットされる可能性があるため、
// 厳密な制限にはRedisなどの外部ストアが必要です。今回は簡易的な実装とします。
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: { error: 'レート制限に達しました。1時間後に再試行してください。' }
});
```

### 根本原因
- `express-rate-limit` のデフォルトのストア（メモリ）を使用している。
- VercelなどのFaaS（Function as a Service）環境では、リクエストごとまたは短時間でプロセスが破棄・再作成される。
- そのため、メモリ上のカウンターが永続化されず、攻撃者は並列リクエストやコールドスタートを誘発することで制限を無効化できる。

### 攻撃シナリオ
1. 攻撃者が `POST /api/ocr` に大量のリクエストを送信する。
2. Vercelが負荷に応じて複数のサーバーレス関数インスタンスを立ち上げる、またはインスタンスがリサイクルされる。
3. 各インスタンスでレート制限カウンターが `0` から始まる。
4. 結果として、意図した `100 req/hour` を大幅に超えるリクエストが処理され、バックエンドのGemini APIのコスト増大や枯渇（Quota Exceeded）を招く。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Medium (APIの枯渇、コスト増大)
- **影響ユーザー**: 全ユーザー（APIが停止する場合）

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- Vercel等のServerless環境にデプロイされていること。

### 再現ステップ
```bash
# 異なるインスタンスにヒットさせるため、並列で大量のリクエストを送信する（擬似コード）
for i in {1..200}; do
  curl -X POST https://target.vercel.app/api/ocr -H "Content-Type: application/json" -d '{"image": "..."}' &
done
# 理論上、100回を超えても成功するリクエストが多数発生する
```

## 🛡️ 推奨対策

### 短期
- [ ] Vercel KV (Redis) や Upstash などの外部ストアを `express-rate-limit` に設定する。

### 長期
- [ ] API Gateway レベル（Vercel Edge ConfigやWAF）でのレート制限を検討する。

## 🔗 参考
- OWASP: https://owasp.org/www-community/attacks/Denial_of_Service
- CWE: https://cwe.mitre.org/data/definitions/770.html
