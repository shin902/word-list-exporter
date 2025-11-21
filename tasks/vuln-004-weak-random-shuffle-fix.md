# 🟢 VULN-004: 弱い乱数生成 - カードシャッフルの改善

## 概要
学習モードでのカードシャッフルに`Math.random()`を使用しており、カードの出題順序が予測可能になる可能性があります。

## 脆弱性情報
- **ID**: vuln-004
- **カテゴリ**: Weak Random (CWE-330)
- **重大度**: 🟢 Low (CVSS: 2.3)
- **優先度**: P3（1ヶ月以内）
- **影響ファイル**: `app.js:170-178`

## 実装タスク

### タスク1: 暗号学的に安全な乱数生成の実装
- [ ] `app.js`の`shuffleCards()`関数を修正
- [ ] `Math.random()`を`crypto.getRandomValues()`に置き換え
- [ ] Fisher-Yatesアルゴリズムの構造は維持

### タスク2: ヘルパー関数の作成（オプション）
- [ ] 暗号学的に安全な乱数生成用のヘルパー関数を作成
- [ ] 他の場所でも再利用可能にする

### タスク3: テスト
- [ ] シャッフル機能が正常に動作することを確認
- [ ] 複数回シャッフルして、毎回異なる順序になることを確認
- [ ] 学習モードでカードの出題順序がランダムであることを確認

## 修正コード例

```javascript
// ❌ Before (app.js:170-178)
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
        // crypto.getRandomValues()を使用した暗号学的に安全な乱数生成
        const randomArray = new Uint32Array(1);
        crypto.getRandomValues(randomArray);
        const j = Math.floor((randomArray[0] / 0xFFFFFFFF) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
```

## ヘルパー関数の実装例（オプション）

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

// 使用例
function shuffleCards(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
```

## 成功基準
- [ ] シャッフル機能が正常に動作する
- [ ] `Math.random()`が使用されていない
- [ ] `crypto.getRandomValues()`が使用されている
- [ ] 学習モードでカードがランダムに出題される

## 参考資料
- [OWASP Insecure Randomness](https://owasp.org/www-community/vulnerabilities/Insecure_Randomness)
- [CWE-330](https://cwe.mitre.org/data/definitions/330.html)
- [Fisher-Yates Shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)

## 関連ファイル
- `app.js`

## 関連脆弱性
- vuln-003: ID生成での弱い乱数生成
