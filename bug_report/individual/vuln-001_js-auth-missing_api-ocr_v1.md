# 🔴 認証の欠如および不十分なレート制限によるリソース枯渇のリスク - OCR API

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: js
category: auth
cwe_id: CWE-306
cvss_score: 7.5
severity: High
priority: P1
discovered: 2024-05-22 10:00
status: New
related_vulns: [vuln-002]
```

## 🎯 要約
認証なしで公開されているOCR APIエンドポイントにおいて、レート制限が回避可能または不十分であるため、攻撃者によるGemini APIクォータの枯渇（金銭的損害）やサービス拒否（DoS）を引き起こすリスクがあります。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L40 (ルート定義)
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```javascript
// api/routes/ocr.js

// 認証ミドルウェアが存在しない
router.post('/', limiter, async (req, res, next) => {
    try {
        const { image } = req.body;
        // ...
        // 外部有料API（Gemini）を実行
        const result = await performOCR(cleanedBase64Data);
        // ...
    } catch (error) {
        next(error);
    }
});
```

### 根本原因
1.  **認証の欠如**: APIエンドポイントがパブリックに公開されており、APIキーやユーザー認証（JWT等）によるアクセス制御が行われていません。
2.  **不完全なレート制限**: IPアドレスベースのレート制限に依存していますが、分散型攻撃（Botnet）やサーバーレス環境でのインスタンス再利用に伴う制限回避に対して脆弱です。

### 攻撃シナリオ
1.  攻撃者はスクリプトを作成し、`POST /api/ocr` に対して大量の画像処理リクエストを送信します。
2.  IPアドレスをローテーションさせるか、多数のプロキシを使用することで、IPベースのレート制限を回避します。
3.  サーバーは各リクエストに対してGoogle Gemini APIを呼び出します。
4.  API利用枠（Quota）が枯渇し、正当なユーザーが機能を利用できなくなるか、従量課金による高額な請求が発生します。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: High (APIクォータ枯渇によるサービス停止)
- **影響ユーザー**: 全ユーザーおよびサービス運営者

## 🔗 関連脆弱性
- vuln-002: Serverless環境におけるレート制限の構成不備

## 🔬 検証手順 (PoC)

### 前提条件
- ターゲットサーバーが稼働中であること。

### 再現ステップ
```bash
#!/bin/bash
# 注意: 許可された環境でのみ実行してください

TARGET_URL="http://localhost:3000/api/ocr"
# ダミーのBase64画像データ
IMAGE_DATA="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

for i in {1..20}; do
  curl -X POST $TARGET_URL \
       -H "Content-Type: application/json" \
       -d "{\"image\": \"$IMAGE_DATA\"}" &
done
wait
echo "Requests sent."
```

## 🛡️ 推奨対策

### 短期
- [ ] `express-rate-limit` の設定を見直し、Redis (`rate-limit-redis`) を必須化して、複数インスタンス間での正確なレート制限を強制する。
- [ ] リクエストサイズや頻度の監視アラートを設定する。

### 長期
- [ ] ユーザー認証機能（ログイン）を実装し、APIエンドポイントを認証済みユーザーのみに制限する。
- [ ] ユーザーごとの使用量クォータ（例: 1日あたり50回まで）を実装する。

## 🔗 参考
- OWASP API Security Top 10 2023: API2:2023 Broken Authentication
- CWE-306: Missing Authentication for Critical Function
