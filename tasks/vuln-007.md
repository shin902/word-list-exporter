# vuln-007: Code Injection (コードインジェクション)

## 脆弱性の詳細
`tests/setup.js` において、`app.js` の内容をテスト環境に読み込むために `eval(appJsContent)` が使用されています。
```javascript
    try {
        // Execute app.js in global scope to make functions available
        eval(appJsContent);
    } catch (error) {
```
`eval()` の使用はセキュリティ上の重大なリスク（Code Injection/RCE）であり、特にファイルの内容をそのまま実行するのは危険です。また、テスト環境とはいえ、CI/CDパイプラインなどで悪意のあるコードが混入した場合に実行される恐れがあります。

## 修正対象ファイル
- `tests/setup.js`
- `app.js`

## 修正内容 (タスク)
1. `app.js` を開く。
2. `app.js` の末尾にある `module.exports` ブロックを確認する（既に存在している）。
   ```javascript
   // For Node.js testing environment
   if (typeof module !== 'undefined' && module.exports) {
       module.exports = {
           parseTextToCards,
           loadCards,
           saveCards,
           // ...
       };
   }
   ```
   この仕組みが正しく機能していれば、`eval()` を使う必要はないはずである。

3. `tests/setup.js` を開く。
4. `eval()` を使用して `app.js` を読み込んでいる部分を削除し、`require()` を使用するように変更する。

   ```javascript
   // 変更前
   // const appJsContent = fs.readFileSync(appJsPath, 'utf8');
   // ...
   // eval(appJsContent);

   // 変更後
   // app.js は末尾で module.exports を行っているため、普通に require できるはず。
   // ただし、app.js はブラウザ環境を前提としたコード（document参照など）が含まれるため、
   // JSDOM環境が整った状態で require する必要がある。

   // Jest環境では jsdom がデフォルトであれば document は存在するが、
   // app.js のトップレベルで DOM 要素を取得しようとするコード（getElementByIdなど）が
   // 実行されると、テスト環境のDOMにそのIDの要素がない場合にエラーになる可能性がある。

   // 現在の app.js は DOM 要素の取得結果に対して addEventListener を呼んでいるため、
   // 要素が見つからない（null）とエラーになる。
   // 例: const startQuizBtn = document.getElementById('start-quiz-btn');
   //     if (startQuizBtn) { ... }
   // nullチェック (`if (startQuizBtn)`) が入っているため、要素がなくてもエラーにはならないはず。

   // したがって、単に require('../app.js') するだけで良いはずである。

   const app = require('../app');

   // グローバルスコープに関数を展開する必要がある場合（テストコードがグローバル関数を期待している場合）
   Object.assign(global, app);
   ```

5. `tests/setup.js` 内で重複して定義されているモック関数（`escapeHtmlAttr`, `sanitizeInput` など）を削除し、`app.js` からインポートしたものを使用するように整理する。

## 検証方法
1. `npm test` を実行し、テストがすべて通過することを確認する。
2. `eval()` がコード内に存在しないことを確認する。
