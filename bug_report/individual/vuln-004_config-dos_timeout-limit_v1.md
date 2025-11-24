# 🟢 サービス拒否 - Vercel関数のタイムアウト制限によるDoSリスク

## メタデータ
```yaml
id: vuln-004
version: v1
iteration: 1
language: config
category: dos
cwe_id: CWE-770
cvss_score: 3.1
severity: Low
priority: P3
discovered: 2025-11-24 00:48
status: New
related_vulns: []
```

## 🎯 要約
Vercel関数のタイムアウトが10秒に設定されており、大きな画像の処理時にタイムアウトが発生し、リソースが無駄に消費される可能性があります。また、意図的に処理が重い画像を送信することでDoS攻撃が可能です。

## 📍 発生場所
- **ファイル**: `vercel.json`
- **行番号**: L5-7
- **関数**: N/A（設定ファイル）
- **エンドポイント**: すべてのAPIエンドポイント (`/api/**`)

## 💣 詳細

### 問題コード
```json
// vercel.json L3-8
"functions": {
  "api/**/*.js": {
    "maxDuration": 10,
    "memory": 1024
  }
}
```

### 根本原因
- Vercel関数のタイムアウトが10秒に固定されている
- 大きな画像や複雑な画像の処理には10秒以上かかる場合がある
- タイムアウト発生時、処理は中断されるが、Gemini APIへのリクエストが既に送信されている場合、APIコストが発生
- メモリ制限（1024MB）も、非常に大きな画像の処理には不足する可能性

### 攻撃シナリオ

#### シナリオ1: 意図的なタイムアウト誘発
1. 攻撃者が非常に大きな画像（5MB上限ギリギリ）を送信
2. Gemini APIへのリクエストが送信される
3. 処理が10秒以内に完了しない
4. Vercel関数がタイムアウト
5. クライアントにエラーが返されるが、Gemini APIコストは発生済み
6. 攻撃者が大量のリクエストを送信し、APIコストを増大させる

#### シナリオ2: 正当なユーザーの利用障害
1. ユーザーが高解像度の画像をアップロード
2. 処理が10秒を超える
3. タイムアウトエラーが発生
4. ユーザーがリトライを試みる
5. 再度タイムアウト
6. ユーザーエクスペリエンスが低下

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Low - タイムアウトによるサービス利用不可
- **影響ユーザー**: 高解像度画像をアップロードするユーザー、サーバー運営者

## 🔗 関連脆弱性
- vuln-003: Base64バリデーション不足（関連）

## 🔬 検証手順 (PoC)

### 前提条件
- Vercelにデプロイされた環境
- 大きな画像ファイル（5MB近く）

### 再現ステップ
```bash
# 大きな画像を生成（例: 5MB）
# ImageMagickを使用
convert -size 4000x4000 xc:white -fill red -pointsize 100 \
  -annotate +100+100 'Test Image' large_image.jpg

# Base64エンコード
base64 large_image.jpg > large_image_base64.txt

# APIにリクエスト送信
curl -X POST https://your-vercel-app.vercel.app/api/ocr \
  -H "Content-Type: application/json" \
  -d "{
    \"image\": \"data:image/jpeg;base64,$(cat large_image_base64.txt)\"
  }" \
  --max-time 15

# 期待される結果: 10秒後にタイムアウトエラー
# Error: Function execution timed out
```

## 🛡️ 推奨対策

### 短期
- [ ] タイムアウト時間の延長: Vercelのプランに応じて最大60秒まで延長可能
  ```json
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
  ```
- [ ] 画像サイズの制限強化: 実用的な範囲（例: 2MB）に制限
  ```javascript
  const MAX_BASE64_SIZE = 2 * 1024 * 1024; // 2MB
  ```

### 長期
- [ ] 非同期処理の導入: 長時間の処理をバックグラウンドで実行し、結果をポーリングまたはWebhookで通知
  ```javascript
  // 処理をキューに追加
  const jobId = await queue.add({ imageData: base64Data });
  res.json({ jobId, status: 'processing' });

  // クライアントはポーリングで結果を取得
  // GET /api/ocr/status/:jobId
  ```
- [ ] 画像の前処理: クライアントサイドで画像をリサイズしてから送信
- [ ] モニタリングとアラート: タイムアウトの頻度を監視し、閾値を超えた場合にアラート
- [ ] レート制限の見直し: 大きな画像のリクエストに対してより厳しいレート制限を適用

## 🔗 参考
- OWASP: https://owasp.org/www-community/attacks/Denial_of_Service
- CWE: https://cwe.mitre.org/data/definitions/770.html
- Vercel Functions: https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration

---
*Iteration 1 | 2025-11-24 00:48:00 JST*
