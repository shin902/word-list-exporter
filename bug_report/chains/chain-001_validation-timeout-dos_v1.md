# 🔗 組み合わせ攻撃チェーン - バリデーション不足 + タイムアウト制限によるDoS攻撃

## メタデータ
```yaml
chain_id: chain-001
version: v1
cvss_score: 6.5
severity: Medium
attack_complexity: Low
discovered_iteration: 1
component_vulns: [vuln-003, vuln-004]
attack_path_length: 3 steps
exploit_time: 5-10 minutes
```

## 🎯 攻撃概要
Base64バリデーション不足とVercel関数のタイムアウト制限を組み合わせることで、効率的なDoS攻撃が可能です。攻撃者は不正なデータを大量に送信し、サーバーリソースとGemini APIのクォータを消費させ、正当なユーザーのサービス利用を妨害できます。

## 🔗 構成脆弱性

### Step 1: Base64バリデーション不足
- **ID**: vuln-003
- **種別**: Input Validation (CWE-20)
- **詳細**: [📄](../individual/vuln-003_js-validation_base64-incomplete_v1.md)
- **得られるもの**: 不正なデータをGemini APIに送信可能

### Step 2: タイムアウト制限
- **ID**: vuln-004
- **種別**: Denial of Service (CWE-770)
- **詳細**: [📄](../individual/vuln-004_config-dos_timeout-limit_v1.md)
- **得られるもの**: タイムアウトによるリソース消費とレート制限到達

## 💣 完全な攻撃シナリオ

### 前提条件
- [ ] APIエンドポイントへのアクセス権限
- [ ] レート制限の存在を把握（100リクエスト/時間）
- [ ] 基本的なHTTPクライアントツール（curl, Postman等）

### 攻撃フロー
```
1️⃣ 攻撃者が不正なBase64データを含む大量のリクエストを準備
   - 無効な文字を含むBase64文字列
   - または非常に大きなデータ（5MB上限ギリギリ）
   ↓
2️⃣ vuln-003: Base64バリデーション不足
   - サーバー側でのバリデーションをバイパス
   - Gemini APIにリクエストが送信される
   ↓
3️⃣ Gemini APIでエラーまたはタイムアウトが発生
   - 不正なデータのため、処理に時間がかかる
   - または、APIがエラーを返す
   ↓
4️⃣ vuln-004: タイムアウト制限
   - Vercel関数が10秒でタイムアウト
   - しかし、Gemini APIへのリクエストは既に送信済み
   - APIクォータとコストが消費される
   ↓
5️⃣ 攻撃者が大量のリクエストを送信
   - レート制限（100リクエスト/時間）に達する
   - 正当なユーザーのリクエストがブロックされる
   ↓
6️⃣ 結果: サービス拒否
   - 正当なユーザーが「レート制限に達しました」エラーを受け取る
   - サーバー運営者のGemini APIコストが増大
```

### 所要時間
- **準備**: 5分（スクリプト作成）
- **実行**: 5-10分（100リクエスト送信）
- **影響継続**: 1時間（レート制限リセットまで）
- **合計**: 約15分で1時間のサービス拒否が可能

## 🎭 影響評価

### CVSS 3.1: 6.5 (Medium)
```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H
```

- **AV (Attack Vector)**: Network - ネットワーク経由で攻撃可能
- **AC (Attack Complexity)**: Low - 特別な準備不要
- **PR (Privileges Required)**: None - 認証不要
- **UI (User Interaction)**: None - ユーザー操作不要
- **S (Scope)**: Unchanged - 影響範囲は限定的
- **C (Confidentiality)**: None - 機密性への影響なし
- **I (Integrity)**: None - 完全性への影響なし
- **A (Availability)**: High - 可用性に重大な影響

### ビジネスインパクト
- **直接影響**:
  - Gemini APIコストの増大（不正なリクエストによる無駄な消費）
  - 正当なユーザーのサービス利用不可（1時間）
  - レピュテーションの低下

- **二次影響**:
  - カスタマーサポートの負荷増加
  - ユーザー離れ
  - 緊急対応によるエンジニアリングコスト

## 🛡️ 包括的対策

### 緊急対応（即時実施）
1. **vuln-003修正**: 軽量なBase64バリデーションを実装
   ```javascript
   // api/routes/ocr.js
   function isValidBase64Sample(str) {
       if (!str || typeof str !== 'string' || str.length === 0) {
           return false;
       }

       // サンプリングベースの検証（ReDoS回避）
       const samples = [
           str.substring(0, 100),
           str.substring(Math.floor(str.length / 2) - 50, Math.floor(str.length / 2) + 50),
           str.substring(str.length - 100)
       ];

       const base64Regex = /^[A-Za-z0-9+/=]*$/;
       return samples.every(sample => base64Regex.test(sample));
   }

   // バリデーションを追加
   if (!isValidBase64Sample(cleanedBase64Data)) {
       return res.status(400).json({ error: '無効なBase64形式です' });
   }
   ```

2. **レート制限の強化**: より細かい制御を実装
   ```javascript
   // 異なるエンドポイントに異なるレート制限を適用
   const strictLimiter = rateLimit({
       windowMs: 60 * 60 * 1000, // 1時間
       max: 20, // OCRエンドポイントはより厳しく制限
       standardHeaders: true,
       legacyHeaders: false,
       store: store,
       message: { error: 'レート制限に達しました。1時間後に再試行してください。' }
   });

   router.post('/', strictLimiter, async (req, res, next) => {
       // ...
   });
   ```

### 長期対策
- [ ] **非同期処理の導入**: 長時間の処理をバックグラウンドで実行
  ```javascript
  // ジョブキューシステムを導入（BullMQ, Celery等）
  const jobId = await ocrQueue.add({ imageData: base64Data });
  res.json({ jobId, status: 'processing' });
  ```

- [ ] **画像前処理の強化**: クライアントサイドでリサイズ
  ```javascript
  // public/app.js
  async function resizeImageBeforeUpload(canvas, maxSize = 1024) {
      // リサイズロジック
  }
  ```

- [ ] **モニタリングとアラート**: 異常なトラフィックを検出
  ```javascript
  // 不正なリクエストの検出
  if (failedValidationCount > THRESHOLD) {
      alertAdmin('Possible DoS attack detected');
  }
  ```

- [ ] **IPベースのレート制限**: 攻撃元を特定してブロック
  ```javascript
  // より高度なレート制限
  const ipLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  });
  ```

## 🔬 検証PoC

**警告**: 教育目的のみ。本番環境での実行は厳禁。

```bash
#!/bin/bash

# 攻撃シミュレーションスクリプト
API_ENDPOINT="http://localhost:3000/api/ocr"
INVALID_BASE64="ThisIsNotValidBase64Data!!!@@@###"

echo "Starting DoS simulation..."

for i in {1..100}; do
    echo "Request $i/100"

    curl -X POST "$API_ENDPOINT" \
      -H "Content-Type: application/json" \
      -d "{\"image\": \"data:image/jpeg;base64,$INVALID_BASE64\"}" \
      --max-time 15 \
      &

    # 並列実行を制限（サーバー負荷調整）
    if [ $((i % 10)) -eq 0 ]; then
        wait
    fi
done

wait
echo "DoS simulation completed"

# 期待される結果:
# - 最初の100リクエストは処理される
# - その後のリクエストはレート制限でブロックされる
# - 正当なユーザーのリクエストも1時間ブロックされる
```

## 📊 検出コンテキスト

### 検出経緯
- **イテレーション1**: vuln-003（Base64バリデーション不足）を検出
- **イテレーション1**: vuln-004（タイムアウト制限）を検出
- **イテレーション1**: 2つの脆弱性を組み合わせた攻撃チェーンを認識

### 関連する既知の攻撃
- Slowloris攻撃（低速HTTP DoS）
- API Rate Limit Bypass攻撃
- Resource Exhaustion攻撃

---
*Chain Analysis | 2025-11-24 00:52:00 JST*
