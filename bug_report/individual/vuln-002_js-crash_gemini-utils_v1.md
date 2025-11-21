# 🔴 Unhandled Exception - APIレスポンス処理の不備によるクラッシュ

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: javascript
category: rce
cwe_id: CWE-248
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2024-10-27 12:20
status: New
related_vulns: []
```

## 🎯 要約
Gemini APIからのレスポンス構造の検証が不十分なため、予期しないレスポンス形式（`parts`配列が空など）の場合にプロパティアクセスで例外が発生し、サーバー（関数）がクラッシュします。

## 📍 発生場所
- **ファイル**: `api/utils/gemini.js`
- **行番号**: L77
- **関数**: `performOCR`

## 💣 詳細

### 問題コード
```javascript
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
    }

    // ここで parts[0] の存在チェックがない
    const text = data.candidates[0].content.parts[0].text;
```

### 根本原因
- `data.candidates[0].content` の存在確認は行われているが、その中の `parts` 配列が存在するか、また空でないか（`parts[0]`があるか）の確認が行われていない。
- Gemini APIがエラー以外の理由で空のコンテンツを返した場合（フィルタリングなど）、`undefined` のプロパティ `text` を読もうとして `TypeError` が発生する。

### 攻撃シナリオ
1. 攻撃者が、Gemini APIの安全フィルター（Safety Filter）に引っかかるような特定の画像（またはノイズ画像）を送信する。
2. Gemini APIは `finishReason: SAFETY` などを返し、`content` 内の `parts` が空または省略される場合がある。
3. コードが `parts[0].text` にアクセスしようとして例外発生。
4. エラーハンドリングが不十分な場合、プロセスが終了するか、予期せぬ500エラーとなる。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Medium (特定のリクエストでのサービス中断)

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- Gemini APIのモック、または特定の入力。

### 再現ステップ
特定のレスポンスを返すようにAPIをモックするテストコードを作成する。

```javascript
// モックレスポンス
const mockResponse = {
  candidates: [{
    content: {
      // parts がない、または空
    }
  }]
};
// コード実行で TypeError: Cannot read properties of undefined (reading 'text') が発生
```

## 🛡️ 推奨対策

### 短期
- [ ] オプショナルチェーン (`?.`) を使用し、存在確認を追加する。
  ```javascript
  const text = data.candidates[0].content.parts?.[0]?.text;
  if (!text) throw new Error('No text found in response');
  ```

### 長期
- [ ] Gemini APIのレスポンススキーマに対する厳密なバリデーション（Zodなど）を導入する。

## 🔗 参考
- CWE: https://cwe.mitre.org/data/definitions/248.html

---
*Iteration 1 | 2024-10-27 12:20*
