# 🟡 VULN-006: CSP設定不備 - unsafe-inline の削除

## 概要
Content Security Policy (CSP)の`style-src`ディレクティブで`'unsafe-inline'`を許可しており、インラインスタイルによるXSS攻撃のリスクが増大しています。

## 脆弱性情報
- **ID**: vuln-006
- **カテゴリ**: XSS (CWE-1385)
- **重大度**: 🟡 Medium (CVSS: 4.7)
- **優先度**: P2（1週間以内）
- **影響ファイル**: `index.html:6-17`

## 実装タスク

### タスク1: CSPから`unsafe-inline`を削除
- [ ] `index.html`のCSP設定を修正
- [ ] `style-src 'self' 'unsafe-inline'` を `style-src 'self'` に変更

### タスク2: インラインスタイルの外部CSS化
- [ ] `app.js`内のインラインスタイル設定（`element.style.xxx = ...`）を検索
- [ ] インラインスタイルをCSSクラスに置き換え
- [ ] 必要なスタイルを`styles.css`に追加
- [ ] 主な対象箇所:
  - L932-990: プレビュー画面のボタンスタイル
  - その他、動的に設定されているスタイル

### タスク3: CSSクラスの追加
- [ ] `styles.css`に必要なクラスを追加
- [ ] 例: `.delete-preview-btn`, `.edit-preview-btn` など

### タスク4: JavaScriptコードの修正
- [ ] インラインスタイル設定をクラス名の追加に変更
- [ ] `element.style.xxx = ...` を `element.className = '...'` に変更

### タスク5: テスト
- [ ] ブラウザの開発者ツールでCSP違反がないことを確認
- [ ] すべてのUI要素が正しくスタイル適用されることを確認
- [ ] 動的に生成される要素（プレビュー画面など）のスタイルを確認

## 修正コード例

### index.html
```html
<!-- ❌ Before -->
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    connect-src 'self';
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
">

<!-- ✅ After -->
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self';
    style-src 'self';
    img-src 'self' data: blob:;
    connect-src 'self';
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
">
```

### app.js
```javascript
// ❌ Before (app.js L932-990付近)
deleteBtn.style.backgroundColor = '#ff4444';
deleteBtn.style.color = 'white';
deleteBtn.style.border = 'none';
deleteBtn.style.padding = '5px 10px';
deleteBtn.style.borderRadius = '4px';
deleteBtn.style.cursor = 'pointer';

// ✅ After
deleteBtn.className = 'delete-preview-btn';
```

### styles.css
```css
/* 新規追加 */
.delete-preview-btn {
    background-color: #ff4444;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
}

.delete-preview-btn:hover {
    background-color: #cc0000;
}
```

## 成功基準
- [ ] CSPに`unsafe-inline`が含まれていない
- [ ] ブラウザコンソールにCSP違反が表示されない
- [ ] すべてのUI要素が正しく表示される
- [ ] 動的に生成される要素も正しくスタイル適用される

## 将来の改善（オプション）
- [ ] CSPレポート機能の有効化
- [ ] Nonce-based CSPの実装（より厳格な設定）
- [ ] CI/CDにCSP検証を組み込み

## 参考資料
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CWE-1385](https://cwe.mitre.org/data/definitions/1385.html)
- [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSS Exfiltration](https://www.mike-gualtieri.com/posts/stealing-data-with-css-attack-and-defense)

## 関連ファイル
- `index.html`
- `app.js`
- `styles.css`
