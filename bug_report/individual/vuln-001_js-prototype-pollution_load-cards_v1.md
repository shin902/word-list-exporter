# 🟡 Prototype Pollution - loadCards関数での不十分なオブジェクト検証

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: javascript
category: prototype-pollution
cwe_id: CWE-1321
cvss_score: 4.3
severity: Medium
priority: P2
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
`loadCards()`関数がlocalStorageから読み込んだJSONデータを十分に検証せずに処理しており、`__proto__`や`constructor`などの特殊プロパティを含むオブジェクトが注入される可能性がある。

## 📍 発生場所
- **ファイル**: `public/app.js`
- **行番号**: L70-L100
- **関数**: `loadCards()`
- **エンドポイント**: N/A (クライアントサイド)

## 💣 詳細

### 問題コード
```javascript
function loadCards() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        // 配列であることを確認
        if (!Array.isArray(parsed)) return [];

        // レガシーカード（IDがない）を移行
        let needsMigration = false;
        const migratedCards = parsed.map(card => {
            if (!card) return card; // Handle null/undefined
            if (!card.id) {
                needsMigration = true;
                return {
                    ...card,  // ← ここで __proto__ などがコピーされる可能性
                    id: generateUniqueId()
                };
            }
            return card;
        });
        // ...
    }
}
```

### 根本原因
- localStorageから読み込んだデータのオブジェクトプロパティを検証していない
- スプレッド演算子(`...card`)が`__proto__`や`constructor`プロパティをコピーする

### 攻撃シナリオ
1. 攻撃者がXSSなどを通じてlocalStorageに悪意のあるデータを注入
2. `{"__proto__": {"polluted": true}}`などのペイロードを含むカードデータを保存
3. `loadCards()`実行時にプロトタイプが汚染される
4. アプリケーション全体の動作に影響を与える可能性

### 影響範囲
- **機密性**: Low
- **完全性**: Medium
- **可用性**: Low
- **影響ユーザー**: 該当ブラウザのユーザー

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- ブラウザの開発者ツールにアクセス可能

### 再現ステップ
```javascript
// ブラウザコンソールで実行
localStorage.setItem('MEMORY', JSON.stringify([
  {"__proto__": {"polluted": true}, "question": "test", "answer": "test", "category": "test"}
]));
// ページをリロード
// Object.prototype.polluted を確認
console.log({}.polluted); // true (汚染された場合)
```

## 🛡️ 推奨対策

### 短期
- [ ] オブジェクトプロパティのホワイトリスト検証を追加
```javascript
const allowedKeys = ['id', 'category', 'question', 'answer'];
const safeCard = {};
allowedKeys.forEach(key => {
    if (card.hasOwnProperty(key)) {
        safeCard[key] = card[key];
    }
});
```

### 長期
- [ ] `Object.create(null)`を使用してプロトタイプチェーンのないオブジェクトを作成
- [ ] JSONスキーマバリデーションライブラリの導入を検討

## 🔗 参考
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html
- CWE: https://cwe.mitre.org/data/definitions/1321.html

---
*Iteration 1 | 2025-11-26*
