# 🟠 VULN-007: コードインジェクション - eval()の削除

## 概要
テストセットアップファイルで`eval()`を使用してapp.jsの内容を実行しており、コードインジェクションやRCE（Remote Code Execution）のリスクがあります。

## 脆弱性情報
- **ID**: vuln-007
- **カテゴリ**: Code Injection (CWE-95)
- **重大度**: 🟠 High (CVSS: 7.3)
- **優先度**: P1（3日以内）
- **影響ファイル**: `tests/setup.js:120`

## 実装タスク

### タスク1: app.jsのモジュール化
- [ ] `app.js`の末尾にモジュールエクスポートを追加
- [ ] ブラウザ環境では実行されないよう条件分岐を追加
- [ ] 以下の関数をエクスポート
  - `parseTextToCards`
  - `loadCards`
  - `saveCards`
  - `createCard`
  - `deleteCard`
  - `escapeHtml`
  - `sanitizeInput`
  - `performOCR`

### タスク2: tests/setup.jsの修正
- [ ] `eval()`の使用を完全に削除
- [ ] `require()`を使用してapp.jsから関数をインポート
- [ ] モックの設定を調整（必要に応じて）

### タスク3: ESLintルールの追加
- [ ] `.eslintrc.json`に`no-eval`ルールを追加
- [ ] CI/CDでESLintチェックが実行されることを確認

### タスク4: テスト
- [ ] `npm test`を実行し、すべてのテストが成功することを確認
- [ ] `eval()`が使用されていないことを確認
- [ ] テスト対象の関数が正しくインポートされていることを確認

## 修正コード例

### app.js（末尾に追加）
```javascript
// ❌ Before: モジュールエクスポートなし

// ✅ After: 末尾に追加
// Node.js環境（テスト用）でのみエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseTextToCards,
        loadCards,
        saveCards,
        createCard,
        deleteCard,
        escapeHtml,
        sanitizeInput,
        performOCR
    };
}
```

### tests/setup.js
```javascript
// ❌ Before (tests/setup.js:120付近)
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
// ...
eval(appJsContent);  // 危険！

// ✅ After
// app.jsから必要な関数をインポート
const {
    parseTextToCards,
    loadCards,
    saveCards,
    createCard,
    deleteCard,
    escapeHtml,
    sanitizeInput,
    performOCR
} = require('../app');

// グローバルスコープに追加（テストから参照できるように）
global.parseTextToCards = parseTextToCards;
global.loadCards = loadCards;
global.saveCards = saveCards;
global.createCard = createCard;
global.deleteCard = deleteCard;
global.escapeHtml = escapeHtml;
global.sanitizeInput = sanitizeInput;
global.performOCR = performOCR;
```

### .eslintrc.json（追加）
```json
{
  "rules": {
    "no-eval": "error",
    "no-implied-eval": "error"
  }
}
```

## 成功基準
- [ ] `eval()`が完全に削除されている
- [ ] すべてのテストが成功する
- [ ] ESLintで`no-eval`ルールが有効になっている
- [ ] CI/CDでESLintチェックが実行される

## セキュリティチェック
- [ ] ファイル読み込みとコード実行が分離されている
- [ ] 任意のコード実行が不可能になっている
- [ ] テストファイルが本番環境にデプロイされないことを確認

## 参考資料
- [OWASP Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
- [CWE-95](https://cwe.mitre.org/data/definitions/95.html)
- [ESLint no-eval](https://eslint.org/docs/latest/rules/no-eval)
- [MDN eval() considered harmful](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval)

## 関連ファイル
- `tests/setup.js`
- `app.js`
- `.eslintrc.json`

## 関連脆弱性
- vuln-001: ディレクトリトラバーサル（組み合わせるとさらに危険）
