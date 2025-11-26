# 🟡 クライアントIPスプーフィング - X-Forwarded-Forヘッダーの信頼

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: javascript
category: auth
cwe_id: CWE-290
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
OCRルートでクライアントIPアドレスを`X-Forwarded-For`ヘッダーから直接取得しており、プロキシ設定によってはIPスプーフィングが可能。レート制限のバイパスやログ偽装に悪用される可能性がある。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L159-L163
- **関数**: `router.post('/', ...)`
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```javascript
router.post('/', strictLimiter, async (req, res, next) => {
    // リクエスト元IPを取得（ログ用）
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.ip || 
                     'unknown';
    // ... 以下、clientIpをログに使用
});
```

### 根本原因
- `X-Forwarded-For`ヘッダーはクライアントが自由に設定可能
- Vercel等のプロキシ環境では通常上書きされるが、設定ミスがあると偽装可能
- `trust proxy`の設定と`req.ip`の使用に一貫性がない

### 攻撃シナリオ
1. 攻撃者がリクエストに`X-Forwarded-For: 1.2.3.4`ヘッダーを付与
2. サーバーが偽のIPをログに記録
3. セキュリティ監査やフォレンジック時に誤った情報を提供
4. レート制限がIPベースの場合、バイパスの可能性

### 影響範囲
- **機密性**: Low
- **完全性**: Medium（ログの完全性）
- **可用性**: Low
- **影響ユーザー**: 全ユーザー（ログ追跡に影響）

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- curlまたは同等のHTTPクライアント

### 再現ステップ
```bash
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.1" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ"}'

# サーバーログで192.168.1.1が記録されているか確認
```

## 🛡️ 推奨対策

### 短期
- [ ] Express の `trust proxy` 設定を適切に構成
- [ ] `req.ip` を一貫して使用し、生のヘッダーアクセスを避ける

```javascript
// api/index.js に追加
app.set('trust proxy', 1); // プロキシを1ホップだけ信頼

// api/routes/ocr.js を修正
const clientIp = req.ip || 'unknown';
```

### 長期
- [ ] Vercel等のデプロイ環境に応じた適切な`trust proxy`設定の検証
- [ ] IPアドレス取得ロジックを`network.js`に集約

## 🔗 参考
- Express trust proxy: https://expressjs.com/en/guide/behind-proxies.html
- CWE: https://cwe.mitre.org/data/definitions/290.html

---
*Iteration 1 | 2025-11-26*
