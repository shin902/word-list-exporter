# 🟢 Rate Limit - ヘルスチェックエンドポイントのレート制限欠如

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: js
category: dos
cwe_id: CWE-770
cvss_score: 3.7
severity: Low
priority: P1
discovered: 2024-10-25 10:00
status: New
related_vulns: []
```

## 🎯 要約
`/api/health` エンドポイントに対してレート制限が適用されていません。このエンドポイントは軽量ですが、攻撃者が大量のリクエストを送信することで、サーバーレス関数の起動回数制限（Vercelの課金枠消費など）や、微小ながらリソース消費によるDoS攻撃に利用される可能性があります。

## 📍 発生場所
- **ファイル**: `api/index.js`
- **行番号**: L36
- **関数**: `app.get('/api/health', ...)`
- **エンドポイント**: `GET /api/health`

## 💣 詳細

### 問題コード
```javascript
// ルート
app.use('/api/ocr', ocrRouter); // こちらはocr.js内で制限あり

// ヘルスチェック
app.get('/api/health', (req, res) => { // 制限なし
    res.json({ status: 'ok' });
});
```

### 根本原因
- `ocrRouter` には `rate-limit-redis` を用いた制限があるが、メインの `app` レベルやヘルスチェックルートにはミドルウェアが適用されていない。

### 攻撃シナリオ
1. 攻撃者がスクリプトを用いて `/api/health` に毎秒数千回のリクエストを送信する。
2. アプリケーションサーバー（Vercel Functions）が起動し、リクエストを処理する。
3. 処理自体は軽量だが、インフラストラクチャのコストが増大したり、同時実行数制限を圧迫して正規のリクエスト（OCR処理など）が遅延・拒否される可能性がある。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Low (コスト増加、マイナーな遅延)
- **影響ユーザー**: 管理者（コスト）、全ユーザー（遅延）

## 🔗 関連脆弱性
- vuln-001 (Rate Limiting自体の信頼性)

## 🔬 検証手順 (PoC)

### 前提条件
- `wrk` や `ab` などの負荷テストツール。

### 再現ステップ
```bash
# 10スレッド、100コネクションで30秒間攻撃
wrk -t10 -c100 -d30s https://target-url/api/health
```

## 🛡️ 推奨対策

### 短期
- [ ] `express-rate-limit` を使用して、グローバルまたはヘルスチェック専用の軽量なレート制限を導入する。
```javascript
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
});
app.use('/api/health', globalLimiter);
```

### 長期
- [ ] インフラレベル（Vercel Firewall, AWS WAFなど）でのレート制限設定。

## 🔗 参考
- CWE-770: Allocation of Resources Without Limits or Throttling
