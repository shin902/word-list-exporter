# 🟢 不適切なエラーハンドリング - JSON.parse例外の処理不足

## メタデータ
```yaml
id: vuln-006
version: v1
iteration: 1
language: javascript
category: error-handling
cwe_id: CWE-755
cvss_score: 3.1
severity: Low
priority: P3
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
`gemini.js`の`performOCR`関数でGemini APIからのJSONレスポンス解析時に、詳細なエラー情報をスローしており、パース失敗の具体的な内容が漏洩する可能性がある。

## 📍 発生場所
- **ファイル**: `api/utils/gemini.js`
- **行番号**: L77-L83
- **関数**: `performOCR()`
- **エンドポイント**: 内部関数

## 💣 詳細

### 問題コード
```javascript
// Parse and validate JSON response
try {
    const cards = JSON.parse(text);
    if (!Array.isArray(cards)) {
        throw new Error('Response is not an array');
    }
    return cards;
} catch (e) {
    throw new Error(`Failed to parse JSON response: ${e.message}`);  // ← エラー詳細が含まれる
}
```

### 根本原因
- JSON.parseのエラーメッセージには解析位置情報が含まれる
- これにより、APIレスポンスの一部が推測可能になる場合がある

### 攻撃シナリオ
1. 攻撃者が様々な画像を送信してAPIレスポンスを探索
2. エラーメッセージからレスポンス構造を推測
3. 将来的なAPI変更を検知するための情報収集に使用

### 影響範囲
- **機密性**: Low
- **完全性**: None
- **可用性**: None
- **影響ユーザー**: 間接的

## 🔗 関連脆弱性
- vuln-003 (Gemini APIエラー詳細の露出)

## 🔬 検証手順 (PoC)

### 前提条件
- APIエンドポイントへのアクセス

### 再現ステップ
```bash
# 不正な画像でリクエスト
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/..."}'

# エラーレスポンスを確認（サーバーログ）
```

## 🛡️ 推奨対策

### 短期
- [ ] 一般的なエラーメッセージを使用

```javascript
try {
    const cards = JSON.parse(text);
    if (!Array.isArray(cards)) {
        console.error('Gemini response is not an array:', text);
        throw new Error('Invalid response format from Gemini API');
    }
    return cards;
} catch (e) {
    console.error('Failed to parse Gemini response:', e.message, text);
    throw new Error('Invalid response format from Gemini API');
}
```

### 長期
- [ ] 構造化されたエラーコードシステムの導入
- [ ] ログレベルの細分化

## 🔗 参考
- CWE: https://cwe.mitre.org/data/definitions/755.html

---
*Iteration 1 | 2025-11-26*
