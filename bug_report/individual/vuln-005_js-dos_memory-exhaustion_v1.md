# 🟡 DoS攻撃リスク - インメモリレート制限カウンターの枯渇

## メタデータ
```yaml
id: vuln-005
version: v1
iteration: 1
language: javascript
category: dos
cwe_id: CWE-770
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
`failedValidationCounter` Mapがメモリ内で無制限に成長する可能性があり、大量の異なるIPアドレスからの攻撃でメモリ枯渇によるDoSを引き起こす可能性がある。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L12-L14, L135-L142
- **関数**: `trackFailedValidation()`
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```javascript
// 不正リクエスト検出用カウンター（DoS攻撃の検出）
const failedValidationCounter = new Map();
const FAILED_VALIDATION_THRESHOLD = 10; // 10回の失敗でアラート
const COUNTER_RESET_INTERVAL = 15 * 60 * 1000; // 15分でリセット

// タイマー管理
let counterResetTimer = null;

function initializeTimer() {
    if (counterResetTimer) return;
    counterResetTimer = setInterval(() => {
        failedValidationCounter.clear();  // 15分ごとにクリア
    }, COUNTER_RESET_INTERVAL);
    // ...
}

function trackFailedValidation(ip) {
    const count = (failedValidationCounter.get(ip) || 0) + 1;
    failedValidationCounter.set(ip, count);  // ← Mapが無制限に成長
    // ...
}
```

### 根本原因
- `failedValidationCounter`のサイズに上限がない
- 15分間隔でクリアされるが、その間に大量のユニークIPからリクエストが来るとメモリが枯渇
- サーバーレス環境では各インスタンスが独立しており、分散攻撃に脆弱

### 攻撃シナリオ
1. 攻撃者がボットネットを使用して大量のユニークIPからリクエスト送信
2. 各IPに対してMapエントリが作成される
3. 15分以内に数百万のエントリが作成される可能性
4. Node.jsプロセスのメモリが枯渇してクラッシュ

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: High
- **影響ユーザー**: 全ユーザー（サービス停止）

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- 攻撃スクリプトの実行環境

### 再現ステップ
```bash
# 大量のユニークIPをシミュレート（X-Forwarded-Forを変更）
for i in {1..100000}; do
  curl -X POST http://localhost:3000/api/ocr \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 192.168.$((i/256)).$((i%256))" \
    -d '{"image": "invalid"}' &
done

# サーバーのメモリ使用量を監視
```

## 🛡️ 推奨対策

### 短期
- [ ] Mapのサイズ上限を設定し、超過時は古いエントリを削除

```javascript
const MAX_COUNTER_ENTRIES = 10000;

function trackFailedValidation(ip) {
    // サイズ制限
    if (failedValidationCounter.size >= MAX_COUNTER_ENTRIES) {
        // 最も古いエントリを削除（FIFOロジック必要）
        const firstKey = failedValidationCounter.keys().next().value;
        failedValidationCounter.delete(firstKey);
    }
    
    const count = (failedValidationCounter.get(ip) || 0) + 1;
    failedValidationCounter.set(ip, count);
    // ...
}
```

### 長期
- [ ] Redisベースのカウンターに移行（本番環境では既にRedisを使用）
- [ ] LRUキャッシュライブラリ（`lru-cache`など）の使用を検討

## 🔗 参考
- OWASP DoS: https://owasp.org/www-community/attacks/Denial_of_Service
- CWE: https://cwe.mitre.org/data/definitions/770.html

---
*Iteration 1 | 2025-11-26*
