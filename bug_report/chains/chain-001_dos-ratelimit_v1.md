# 🔗 組み合わせ攻撃チェーン - Resource Exhaustion & Financial Damage

## メタデータ
```yaml
chain_id: chain-001
version: v1
cvss_score: 6.5
severity: High
attack_complexity: Low
discovered_iteration: 2
component_vulns: [vuln-001, vuln-002]
attack_path_length: 2 steps
exploit_time: 5 minutes
```

## 🎯 攻撃概要
レート制限の不備と大容量ペイロードの許容を組み合わせることで、攻撃者はAPIを過負荷状態にし、サーバーリソースの枯渇またはGemini APIの利用料高騰を引き起こすことができます。

## 🔗 構成脆弱性

### Step 1: Rate Limit Bypass
- **ID**: vuln-001
- **種別**: Rate Limit Bypass
- **詳細**: [📄](../individual/vuln-001_js-ratelimit_ocr-route_v1.md)
- **得られるもの**: 無制限のAPIリクエスト実行能力

### Step 2: DoS via Large Payload
- **ID**: vuln-002
- **種別**: Resource Consumption
- **詳細**: [📄](../individual/vuln-002_js-dos_ocr-payload_v1.md)
- **得られるもの**: サーバーメモリ/CPUの大量消費、有料APIのクォータ消費

## 💣 完全な攻撃シナリオ

### 前提条件
- [ ] 攻撃者はインターネットからAPIにアクセス可能である
- [ ] VercelなどのServerless環境で動作している（レート制限がリセットされるため）

### 攻撃フロー
```
1️⃣ 攻撃者が10MBの画像データ（最大サイズ）を用意する
   ↓
2️⃣ 並列スクリプトを使用して、/api/ocr エンドポイントに大量のリクエストを送信
   （vuln-001により、新しいインスタンスが立ち上がるたびにレート制限がリセットされ、リクエストが通る）
   ↓
3️⃣ バックエンドサーバーは各リクエストで10MBのデータを処理し、Gemini APIを呼び出す
   ↓
4️⃣ 結果として、サーバーのメモリ枯渇（DoS）またはGemini APIの課金急増（Financial DoS）が発生する
```

### 所要時間
- 攻撃準備: 5分
- 攻撃実行: 数秒
- **合計**: 5分強

## 🎭 影響評価

### CVSS 3.1: 6.5
```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H
```
(Availabilityへの影響が大きい)

### ビジネスインパクト
- **直接**: サービスの停止、ユーザーが利用できない
- **二次**: クラウド破産（API利用料の予期せぬ請求）、プラットフォーム（Vercel/Google）からのアカウント停止措置

## 🛡️ 包括的対策

### 緊急対応
1. **レート制限の強化**: Vercel KV (Redis) 等を使用した永続的なレート制限の実装
2. **ペイロード制限**: `10mb` を `4mb` 程度に縮小（Gemini APIの制限や実用性を考慮）

### 長期対策
- [ ] 請求アラートの設定（Google Cloud Console）
- [ ] API GatewayまたはWAFでのDDoS対策導入

## 🔬 検証PoC

**警告**: 教育目的のみ

```bash
#!/bin/bash
# 簡易的な負荷テストスクリプト
PAYLOAD=$(dd if=/dev/urandom bs=1M count=9 | base64)
JSON="{\"image\": \"data:image/png;base64,${PAYLOAD}\"}"

# 50並列でリクエスト
for i in {1..50}; do
   curl -X POST https://target.app/api/ocr \
     -H "Content-Type: application/json" \
     -d "$JSON" &
done
wait
```

## 📊 検出コンテキスト

### 検出経緯
- **イテレーション1**: vuln-001（レート制限不備）検出
- **イテレーション1**: vuln-002（大容量ペイロード）検出
- **イテレーション2**: 両者が同一エンドポイントに存在し、相乗効果があるためチェーンとして認識

---
*Chain Analysis | 2024-05-21*
