# 🟡 不十分なCSP - インラインスクリプト禁止だがDOM操作による回避可能性

## メタデータ
```yaml
id: vuln-004
version: v1
iteration: 1
language: html
category: xss
cwe_id: CWE-79
cvss_score: 4.3
severity: Medium
priority: P2
discovered: 2025-11-26 00:00
status: New
related_vulns: []
```

## 🎯 要約
`index.html`のCSPは厳格に設定されているが、`parseSubscriptSuperscript`関数で`innerHTML`を使用しており、HTMLタグの注入リスクがある。現在の実装では`escapeHtml`を先に適用しているため直接的なXSSは困難だが、将来の変更で脆弱になる可能性がある。

## 📍 発生場所
- **ファイル**: `public/app.js`
- **行番号**: L180-L195
- **関数**: `parseSubscriptSuperscript()`
- **エンドポイント**: N/A (クライアントサイド)

## 💣 詳細

### 問題コード
```javascript
function parseSubscriptSuperscript(text) {
    // まずHTMLエスケープしてXSS攻撃を防ぐ
    text = escapeHtml(text);

    // 波括弧付き上付き文字: ^{text} (最大100文字に制限してReDoS防止)
    text = text.replace(/\^\{([^}]{1,100})\}/g, '<span class="superscript">$1</span>');
    // 単一文字上付き文字: ^x
    text = text.replace(/\^(.)/g, '<span class="superscript">$1</span>');

    // 波括弧付き下付き文字: _{text} (最大100文字に制限してReDoS防止)
    text = text.replace(/\_\{([^}]{1,100})\}/g, '<span class="subscript">$1</span>');
    // 単一文字下付き文字: _x
    text = text.replace(/\_(.)/g, '<span class="subscript">$1</span>');

    return text;  // ← この戻り値がinnerHTMLに設定される
}

// 使用箇所
cardQuestion.innerHTML = parseSubscriptSuperscript(card.question);
```

### 根本原因
- `innerHTML`の使用は常にリスクを伴う
- `escapeHtml`は現在適切に機能しているが、エスケープ後に`<span>`を挿入するパターンは複雑
- 将来のリファクタリングでエスケープ順序が変更される可能性

### 攻撃シナリオ
1. 現状では`escapeHtml`により`<script>`等がエスケープされる
2. しかし、`&lt;script&gt;`が`<span>`で囲まれる可能性はある（実害なし）
3. 将来的に処理順序が変更された場合にXSSリスクが発生

### 影響範囲
- **機密性**: Low
- **完全性**: Low
- **可用性**: None
- **影響ユーザー**: 将来的リスク

## 🔗 関連脆弱性
- なし

## 🔬 検証手順 (PoC)

### 前提条件
- ブラウザの開発者ツール

### 再現ステップ
```javascript
// 現在の実装では攻撃不可
// テスト入力:
"<script>alert(1)</script>"
// 結果: &lt;script&gt;alert(1)&lt;/script&gt;

// 将来的リスクの確認:
// escapeHtml が削除された場合のシミュレーション
```

## 🛡️ 推奨対策

### 短期
- [ ] DOM APIを使用して`textContent`で設定し、スパン要素は別途作成

```javascript
function parseSubscriptSuperscriptSafe(text, container) {
    // テキストを解析してDOMノードを作成
    const parts = text.split(/(\^{[^}]+}|\^.|_{[^}]+}|_.)/g);
    parts.forEach(part => {
        if (part.match(/^\^{([^}]+)}$/)) {
            const span = document.createElement('span');
            span.className = 'superscript';
            span.textContent = part.slice(2, -1);
            container.appendChild(span);
        } else if (part.match(/^\^(.)$/)) {
            const span = document.createElement('span');
            span.className = 'superscript';
            span.textContent = part.slice(1);
            container.appendChild(span);
        }
        // ... 他のパターンも同様
        else {
            container.appendChild(document.createTextNode(part));
        }
    });
}
```

### 長期
- [ ] すべての`innerHTML`使用箇所を`textContent`またはDOM APIに置換
- [ ] セキュリティレビューのチェックリストに`innerHTML`禁止を追加

## 🔗 参考
- OWASP DOM XSS: https://owasp.org/www-community/attacks/DOM_Based_XSS
- CWE: https://cwe.mitre.org/data/definitions/79.html

---
*Iteration 1 | 2025-11-26*
