# 🟡 DoS via Large Payload - 大容量ペイロードによるサービス妨害の可能性

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: js
category: rce
cwe_id: CWE-400
cvss_score: 4.3
severity: Medium
priority: P2
discovered: 2024-05-21 10:15
status: New
related_vulns: [vuln-001]
```

## 🎯 要約
APIが最大10MBの画像ペイロードを許可しており、Regex処理やJSONパース時のメモリ消費により、リソース枯渇（DoS）を引き起こす可能性があります。

## 📍 発生場所
- **ファイル**: `api/index.js`, `api/routes/ocr.js`
- **行番号**: `api/index.js`: L22, `api/routes/ocr.js`: L37
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```js
// api/index.js
app.use(express.json({ limit: '10mb' }));

// api/routes/ocr.js
// Base64データサイズの制限（例: 10MB）
const MAX_BASE64_SIZE = 10 * 1024 * 1024;
if (base64Data.length > MAX_BASE64_SIZE) { ... }

// Base64形式の検証 (正規表現)
if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) { ... }
```

### 根本原因
- 1リクエストあたり10MBという比較的大きなサイズを許可している。
- VercelのFunctionメモリ制限（デフォルト1024MB）に対して、Node.jsの文字列表現（UTF-16）やBase64処理のオーバーヘッドを考慮すると、並列リクエスト時にメモリ不足（OOM）になりやすい。
- 正規表現 `^[A-Za-z0-9+/]*={0,2}$` は10MBの文字列に対してスキャンを行うため、CPU時間を消費する。

### 攻撃シナリオ
1. 攻撃者が制限サイズ一杯（10MB）のペイロードを含むリクエストを多重送信する。
2. サーバーはJSONパース、Base64抽出、正規表現チェックのためにメモリとCPUを大量に消費する。
3. `vuln-001`（レート制限回避）と組み合わせることで、サーバーレス関数の実行時間制限（タイムアウト）やメモリ制限超過を引き起こし、サービスを停止させる。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Medium (サービス低下・停止)

## 🔗 関連脆弱性
- vuln-001: レート制限が機能しないため、この攻撃が成立しやすい。

## 🔬 検証手順 (PoC)

### 再現ステップ
```bash
# 10MBのダミーデータを作成して送信
dd if=/dev/urandom bs=1M count=10 | base64 > large_payload.txt
PAYLOAD=$(cat large_payload.txt)
curl -X POST https://target.vercel.app/api/ocr \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"data:image/png;base64,${PAYLOAD}\"}"
```

## 🛡️ 推奨対策

### 短期
- [ ] `api/index.js` の `limit` を必要最小限（例: 5MB）に下げる。
- [ ] 画像処理を同期的に行わず、非同期キューやストリーム処理を検討する（ただしVercelなどでは難しい場合がある）。

### 長期
- [ ] クライアントサイドで画像をリサイズ・圧縮してから送信するように強制する（`app.js`では既に `maxImageSize: 1024` でリサイズしているが、API側でも強制力を持たせるべき）。

## 🔗 参考
- CWE: https://cwe.mitre.org/data/definitions/400.html
