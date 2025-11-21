# 🟢 弱い乱数生成 - カードシャッフルの予測可能性

## メタデータ
```yaml
id: vuln-004
version: v1
iteration: 1
language: javascript
category: weak-random
cwe_id: CWE-330
cvss_score: 2.3
severity: Low
priority: P3
discovered: 2025-11-21 00:00
status: New
related_vulns: [vuln-003]
```

## 🎯 要約
学習モードでのカードシャッフルに`Math.random()`を使用しており、カードの出題順序が予測可能になる可能性があります。

## 📍 発生場所
- **ファイル**: `app.js`
- **行番号**: L170-178
- **関数**: `shuffleCards()`
- **エンドポイント**: なし（クライアント側）

## 💣 詳細

### 問題コード
```javascript
// カード配列をシャッフル
function shuffleCards(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
```

### 根本原因
- Fisher-Yatesシャッフルアルゴリズムを使用しているが、乱数生成に`Math.random()`を使用
- `Math.random()`は暗号学的に安全ではなく、予測可能
- ブラウザによってはシード値が推測可能
- 攻撃者がカードの出題順序を事前に知ることができる可能性

### 攻撃シナリオ
1. 攻撃者がアプリケーションを開き、学習モードを開始
2. 複数回シャッフルを実行し、出題順序のパターンを観察
3. `Math.random()`のシード値を統計的に推測
4. 次回のシャッフル結果を予測
5. 学習効果を不正に向上させる（カンニング）

**注意**: このアプリケーションは個人用の暗記カードアプリであり、他のユーザーとの競争要素はないため、実際の影響は極めて低い。しかし、将来的にゲーム要素やスコア機能を追加する場合は問題となる。

### 影響範囲
- **機密性**: Low（出題順序の予測）
- **完全性**: Low（学習効果の不正な向上）
- **可用性**: None
- **影響ユーザー**: すべてのユーザー（ただし、影響は個人内に限定）

## 🔗 関連脆弱性
- vuln-003: ID生成での`Math.random()`使用

## 🔬 検証手順 (PoC)

### 前提条件
- ブラウザの開発者ツールでJavaScript実行可能
- 複数のカードが登録済み

### 再現ステップ
```javascript
// 1. Math.random()の出力を記録
const originalRandom = Math.random;
const randomValues = [];
Math.random = function() {
    const value = originalRandom.call(Math);
    randomValues.push(value);
    return value;
};

// 2. カードをシャッフル
const cards = loadCards();
const shuffled1 = shuffleCards(cards);
console.log('Shuffle 1:', shuffled1.map(c => c.question));
console.log('Random values:', randomValues);

// 3. 同じカードを再度シャッフル
randomValues.length = 0;
const shuffled2 = shuffleCards(cards);
console.log('Shuffle 2:', shuffled2.map(c => c.question));
console.log('Random values:', randomValues);

// 4. パターンを分析
// Math.random()の出力パターンから次の出力を予測

// 5. Math.random()を復元
Math.random = originalRandom;
```

## 🛡️ 推奨対策

### 短期
- [ ] `crypto.getRandomValues()`を使用した暗号学的に安全なシャッフルに変更
- [ ] 以下のように修正：
  ```javascript
  // ❌ Before
  function shuffleCards(cards) {
      const shuffled = [...cards];
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
  }

  // ✅ After
  function shuffleCards(cards) {
      const shuffled = [...cards];
      for (let i = shuffled.length - 1; i > 0; i--) {
          // crypto.getRandomValues()を使用
          const randomArray = new Uint32Array(1);
          crypto.getRandomValues(randomArray);
          const j = Math.floor((randomArray[0] / 0xFFFFFFFF) * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
  }
  ```

### 長期
- [ ] ヘルパー関数として暗号学的に安全な乱数生成関数を実装
  ```javascript
  // 暗号学的に安全な0-1の乱数を生成
  function secureRandom() {
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      return randomArray[0] / 0xFFFFFFFF;
  }

  // 暗号学的に安全な整数乱数を生成
  function secureRandomInt(max) {
      return Math.floor(secureRandom() * max);
  }
  ```
- [ ] 将来的にスコア機能やゲーム要素を追加する場合は必須対応
- [ ] コードレビューガイドラインに「Math.random()の使用禁止（暗記カード関連）」を追加

## 🔗 参考
- OWASP: https://owasp.org/www-community/vulnerabilities/Insecure_Randomness
- CWE: https://cwe.mitre.org/data/definitions/330.html
- Fisher-Yates Shuffle: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
- MDN Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues

---
*Iteration 1 | 2025-11-21 00:00 JST*
