# 🔗 組み合わせ攻撃チェーン - Wallet DoS (Financial Exhaustion)

## メタデータ
```yaml
chain_id: chain-001
version: v1
cvss_score: 6.5
severity: High
attack_complexity: Low
discovered_iteration: 1
component_vulns: [vuln-001]
attack_path_length: 2 steps
exploit_time: 5 minutes
```

## 🎯 攻撃概要
Serverless環境でのレート制限回避（vuln-001）を悪用し、高価なGemini API（OCR）に対して無制限にリクエストを送信することで、短時間でAPI利用枠を枯渇させたり、高額な利用料を発生させたりする「Wallet DoS」攻撃。

## 🔗 構成脆弱性

### Step 1: Rate Limit Bypass
- **ID**: vuln-001
- **種別**: DoS / Rate Limit
- **詳細**: [📄](../individual/vuln-001_js-ratelimit_api-ocr_v1.md)
- **得られるもの**: APIへの無制限アクセス権

### Step 2: Expensive API Invocation (Feature Abuse)
- **機能**: `api/routes/ocr.js` -> `performOCR`
- **詳細**: ユーザーからの画像をGemini APIに送信する正規の機能。
- **コスト**: Gemini APIの画像処理はトークン消費やリクエスト単価が高い。

## 💣 完全な攻撃シナリオ

### 前提条件
- [ ] Redisが未設定のVercel環境（デフォルト）。
- [ ] 攻撃者が有効な画像データ（またはAPIが受け入れるデータ）を持っている。

### 攻撃フロー
```
1️⃣ 攻撃者がスクリプトを用意
   並列処理で POST /api/ocr を実行するループを作成。
   ↓
2️⃣ レート制限の突破 (vuln-001)
   Serverless関数の特性（メモリ非共有）により、100req/hrの制限を無視して数千リクエストを送信。
   ↓
3️⃣ 課金攻撃 (Wallet DoS)
   バックエンドは全てのリクエストに対してGemini APIをコール。
   1リクエストあたり数円〜数十円のコストが発生し、数分で数万円の損害、またはAPI Quota上限によるサービス全停止（正当なユーザーが使えなくなる）。
```

### 所要時間
- スクリプト作成: 5分
- 実行: 数秒
- **合計**: 5分強

## 🎭 影響評価

### CVSS 3.1: 6.5
```
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H
(可用性と経済的影響を考慮)
```

### ビジネスインパクト
- **直接**: API利用料の急増（従量課金の場合）。
- **二次**: APIクォータ到達による、サービスの長時間停止。

## 🛡️ 包括的対策

### 緊急対応
1. **Redisの導入**: Vercel KVなどを接続し、ステートフルなレート制限を有効化する。
2. **Gemini APIの予算アラート**: Google Cloud側で予算制限を設定する。

### 長期対策
- [ ] **Cloudflare等のWAF導入**: アプリケーションに到達する前にIPベースでレート制限をかける。
- [ ] **認証の導入**: OCR機能を利用する前にログインを必須にする（攻撃のハードルを上げる）。

## 🔬 検証PoC

**警告**: 教育目的のみ。実際の環境で実行しないこと。

```bash
#!/bin/bash
# Wallet DoS PoC
# 並列実行によりレート制限を回避し、大量のAPIコールを誘発

TARGET="https://target.vercel.app/api/ocr"
IMAGE_DATA='{"image":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}'

echo "Starting Wallet DoS..."

# 100並列で攻撃（実際にはもっと増やせる）
for i in {1..200}; do
   curl -s -X POST $TARGET \
        -H "Content-Type: application/json" \
        -d "$IMAGE_DATA" > /dev/null &
done

echo "Requests sent."
```

## 📊 検出コンテキスト

### 検出経緯
- **イテレーション1**: vuln-001 (Rate Limit Bypass) を検出。
- **イテレーション1**: 外部API (Gemini) の使用を確認。
- **チェーン認識**: Serverless環境特有の制限回避と高コストAPIの組み合わせを特定。

---
*Chain Analysis | 2024-10-27 12:30*
