# 🟢 CORS設定のセキュリティリスク - 開発環境でのデフォルトオリジン

## メタデータ
```yaml
id: vuln-008
version: v1
iteration: 2
language: javascript
category: cors
cwe_id: CWE-942
cvss_score: 3.1
severity: Low
priority: P3
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
開発環境でFRONTEND_URLが未設定の場合、デフォルトで`http://localhost:5500`がCORSオリジンとして許可される。ローカル開発環境で意図しないオリジンからのアクセスが可能になる潜在的リスクがある。

## 📍 発生場所
- **ファイル**: `api/index.js`
- **行番号**: L36-39
- **関数**: N/A (トップレベル設定)
- **エンドポイント**: 全APIエンドポイント

## 💣 詳細

### 問題コード
```javascript
// 本番環境では config.js で FRONTEND_URL が必須検証済み
const allowedOrigin = process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:5500' : false);

// 開発環境での情報表示
if (process.env.NODE_ENV === 'development' && !process.env.FRONTEND_URL) {
    console.log('INFO: Using default CORS origin http://localhost:5500. Set FRONTEND_URL to override.');
}
```

### 根本原因
- 開発環境でのデフォルトオリジン設定が固定値
- 開発者が別のポートやホストで開発する場合に設定ミスが起きやすい
- `NODE_ENV`が`development`以外（例：`staging`）の場合、`FRONTEND_URL`未設定でCORSがブロックする動作

### 攻撃シナリオ
1. 開発者がローカルでhttp://localhost:5500以外のオリジンから開発
2. CORSエラーが発生し、急いで設定を変更
3. 設定変更時にミスが発生する可能性
4. 本質的な脆弱性ではないが、設定ミスを誘発する設計

### 影響範囲
- **機密性**: Low
- **完全性**: None
- **可用性**: None
- **影響ユーザー**: 開発者のみ

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- ローカル開発環境

### 再現ステップ
```bash
# 環境変数未設定で起動
unset FRONTEND_URL
NODE_ENV=development npm run dev

# http://localhost:3000 から API にアクセス
# CORS エラーが発生することを確認
```

## 🛡️ 推奨対策

### 短期
- [ ] 開発環境でもFRONTEND_URLの明示的な設定を推奨するドキュメント追加
- [ ] `.env.example`に詳細なコメントを追加

### 長期
- [ ] 開発環境でのCORSオリジンを複数許可するオプション検討
- [ ] 環境変数の設定ミスを防ぐためのスタートアップチェック強化

## 🔗 参考
- OWASP CORS: https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny
- CWE: https://cwe.mitre.org/data/definitions/942.html

---
*Iteration 2 | 2025-11-26*
