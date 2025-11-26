# 🟢 localStorageのクォータ攻撃リスク - saveCards関数の容量チェック不足

## メタデータ
```yaml
id: vuln-009
version: v1
iteration: 2
language: javascript
category: dos
cwe_id: CWE-400
cvss_score: 2.7
severity: Low
priority: P3
discovered: 2025-11-26 00:00
status: New
related_vulns: [vuln-001]
```

## 🎯 要約
`saveCards`関数はlocalStorageへの保存時にQuotaExceededErrorをキャッチしているが、保存前のサイズチェックがなく、大量のカードデータが蓄積した場合にユーザー体験が低下する可能性がある。

## 📍 発生場所
- **ファイル**: `public/app.js`
- **行番号**: L107-113
- **関数**: `saveCards()`
- **エンドポイント**: N/A (クライアントサイド)

## 💣 詳細

### 問題コード
```javascript
// ローカルストレージに単語カードを保存
function saveCards(cards) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (e) {
        handleStorageError(e, 'カードデータ');
    }
}
```

### 根本原因
- 保存前にデータサイズのチェックがない
- localStorageの典型的な制限（5-10MB）を超える場合の事前警告がない
- 大量のカードをインポートした場合にエラーが発生する可能性

### 攻撃シナリオ
1. ユーザーが大量の画像からカードをインポート
2. カードデータがlocalStorage制限に近づく
3. 次回保存時にQuotaExceededError発生
4. データが失われるリスク

### 影響範囲
- **機密性**: None
- **完全性**: Low
- **可用性**: Low
- **影響ユーザー**: 大量データを扱うユーザー

## 🔗 関連脆弱性
- vuln-001 (Prototype Pollution - 同じファイルの関連機能)

## 🔬 検証手順 (PoC)

### 前提条件
- ブラウザの開発者ツール

### 再現ステップ
```javascript
// 大量のカードデータを生成
const largeCards = [];
for (let i = 0; i < 100000; i++) {
    largeCards.push({
        id: `id-${i}`,
        category: 'Test',
        question: 'A'.repeat(1000),
        answer: 'B'.repeat(1000)
    });
}
// saveCards(largeCards) を呼び出し
// QuotaExceededError が発生
```

## 🛡️ 推奨対策

### 短期
- [ ] 保存前にデータサイズを概算チェック

```javascript
function saveCards(cards) {
    const dataStr = JSON.stringify(cards);
    const estimatedSize = dataStr.length * 2; // UTF-16エンコーディング
    const WARNING_THRESHOLD = 4 * 1024 * 1024; // 4MB警告
    
    if (estimatedSize > WARNING_THRESHOLD) {
        console.warn('カードデータのサイズが大きくなっています:', (estimatedSize / 1024 / 1024).toFixed(2) + 'MB');
    }
    
    try {
        localStorage.setItem(STORAGE_KEY, dataStr);
    } catch (e) {
        handleStorageError(e, 'カードデータ');
    }
}
```

### 長期
- [ ] IndexedDBへの移行検討（より大容量対応）
- [ ] クラウド同期機能の検討

## 🔗 参考
- MDN Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- CWE: https://cwe.mitre.org/data/definitions/400.html

---
*Iteration 2 | 2025-11-26*
