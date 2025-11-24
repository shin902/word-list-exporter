# 🟠 Configuration - Express Trust Proxy設定の欠如

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: js
category: config
cwe_id: CWE-488
cvss_score: 7.5
severity: High
priority: P0
discovered: 2024-10-25 10:00
status: New
related_vulns: []
```

## 🎯 要約
Expressアプリケーションにおいて `trust proxy` 設定が欠如しているため、プロキシ環境下（Vercelなど）でクライアントの正しいIPアドレスを取得できず、レート制限が意図した通りに機能しません。これにより、全ユーザーがプロキシのIPアドレスを共有することになり、一人のユーザーによるアクセス過多が全ユーザーへのDoS攻撃（巻き添え規制）につながる可能性があります。

## 📍 発生場所
- **ファイル**: `api/index.js`
- **行番号**: L13付近 (設定欠如)
- **関数**: グローバル設定
- **エンドポイント**: すべて

## 💣 詳細

### 問題コード
```javascript
const app = express();

// セキュリティ
app.use(helmet());
const allowedOrigin = process.env.FRONTEND_URL || ...
```

### 根本原因
- `express-rate-limit` はデフォルトで `req.ip` を使用してリクエスト元を識別します。
- Vercelなどのロードバランサー/プロキシ背後では、`req.ip` はロードバランサーのIPになります。
- Expressの `app.set('trust proxy', 1)` (または適切な値) が設定されていないため、`X-Forwarded-For` ヘッダーが信頼されず、本来のクライアントIPが取得されません。

### 攻撃シナリオ
1. 攻撃者が `POST /api/ocr` に対してレート制限（例: 100回/時間）に達するまでリクエストを送信する。
2. アプリケーションは攻撃者のIPを「ロードバランサーのIP」として記録し、そのIPをブロックする。
3. 同じロードバランサーを経由する**全ての正規ユーザー**のリクエストも、同じIPとみなされブロックされる。
4. 結果として、サービス拒否（DoS）状態が発生する。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: High
- **影響ユーザー**: 全ユーザー

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- Vercelなどのプロキシ環境下にデプロイされていること。

### 再現ステップ
1. 異なる2つのクライアント（IP AとIP B）を用意する。
2. クライアントAから `POST /api/ocr` をレート制限上限まで連打する。
3. クライアントAが429エラーを受け取ることを確認する。
4. クライアントBから正常なリクエストを送信する。
5. **期待される動作**: クライアントBは成功する。
6. **実際の動作**: クライアントBも429エラー（またはプロキシIPの共有による制限）を受ける可能性がある。

## 🛡️ 推奨対策

### 短期
- [ ] `api/index.js` の `app = express()` 直後に以下を追加する：
```javascript
app.set('trust proxy', 1); // Vercel等の場合、1段目のプロキシを信頼
```

### 長期
- [ ] 環境変数で信頼するプロキシのホップ数を設定できるようにする。

## 🔗 参考
- Express Guide: [Behind Proxies](https://expressjs.com/en/guide/behind-proxies.html)
- CWE-488: Exposure of Data Element to Wrong Session
