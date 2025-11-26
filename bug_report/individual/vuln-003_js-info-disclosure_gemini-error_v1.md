# 🟢 情報漏洩リスク - Gemini APIエラー詳細の露出

## メタデータ
```yaml
id: vuln-003
version: v1
iteration: 1
language: javascript
category: info-disclosure
cwe_id: CWE-209
cvss_score: 3.7
severity: Low
priority: P3
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
Gemini API呼び出し時のエラーハンドリングで、APIからのエラー詳細をそのままエラーメッセージに含めており、内部実装の情報が漏洩する可能性がある。

## 📍 発生場所
- **ファイル**: `api/utils/gemini.js`
- **行番号**: L50-L66
- **関数**: `performOCR()`
- **エンドポイント**: 内部関数（`/api/ocr`経由）

## 💣 詳細

### 問題コード
```javascript
if (!response.ok) {
    let errorDetail = 'Unknown error';
    try {
        const error = await response.json();
        errorDetail = JSON.stringify(error);  // ← APIエラー詳細をそのまま含める
    } catch (e) {
        try {
            errorDetail = await response.text();  // ← テキストエラーも含める
        } catch (e2) {
            errorDetail = 'Could not read response body';
        }
    }
    throw new Error(`Gemini API error: ${response.status} - ${errorDetail}`);
}
```

### 根本原因
- 外部APIからのエラーレスポンスをフィルタリングせずにエラーメッセージに含めている
- `errorHandler.js`でサニタイズされるが、サーバーログには詳細が残る
- 将来的にエラーハンドリングが変更された場合、クライアントに漏洩するリスク

### 攻撃シナリオ
1. 攻撃者が不正な画像データを送信
2. Gemini APIがエラーを返す
3. エラー詳細にAPI構造や内部パス情報が含まれる可能性
4. ログが漏洩した場合、この情報が攻撃に利用される

### 影響範囲
- **機密性**: Low
- **完全性**: None
- **可用性**: None
- **影響ユーザー**: 間接的（ログ漏洩時）

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- サーバーログへのアクセス

### 再現ステップ
```bash
# 不正な画像データでリクエスト
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,INVALID_DATA"}'

# サーバーログでGemini APIのエラー詳細を確認
```

## 🛡️ 推奨対策

### 短期
- [ ] エラーメッセージからAPI詳細を除去し、内部ログのみに記録

```javascript
if (!response.ok) {
    let errorDetail = 'Unknown error';
    try {
        const error = await response.json();
        // ログには詳細を記録
        console.error('Gemini API error details:', error);
        errorDetail = 'API request failed';
    } catch (e) {
        errorDetail = 'API request failed';
    }
    throw new Error(`Gemini API error: ${response.status} - ${errorDetail}`);
}
```

### 長期
- [ ] 構造化されたエラーハンドリングクラスの導入
- [ ] エラーコードの標準化

## 🔗 参考
- OWASP: https://owasp.org/www-community/Improper_Error_Handling
- CWE: https://cwe.mitre.org/data/definitions/209.html

---
*Iteration 1 | 2025-11-26*
