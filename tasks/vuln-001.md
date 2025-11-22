# vuln-001: Path Traversal (ディレクトリトラバーサル)

## 脆弱性の詳細
`api/index.js` において、静的ファイルの配信パスがプロジェクトルート全体 (`__dirname + '/../'`) に設定されています。
これにより、`.env` ファイルや `package.json` などの機密ファイルが外部からアクセス可能になるリスクがあります。

## 修正対象ファイル
- `api/index.js`

## 修正内容 (タスク)
1. `api/index.js` を開く。
2. `path` モジュールを読み込む（未定義の場合）。
   ```javascript
   const path = require('path');
   ```
3. 静的ファイルの配信設定を以下のように変更し、`public` ディレクトリのみを公開するようにする。
   ```javascript
   // 変更前: app.use(express.static(__dirname + '/../'));
   app.use(express.static(path.join(__dirname, '../public')));
   ```
   ※ `path.join` を使用することで、OS間のパス区切り文字の違いを吸収し、より安全にパスを結合できます。

## 検証方法
1. アプリケーションを起動する。
2. ブラウザまたはcurlなどで `http://localhost:3000/package.json` や `http://localhost:3000/.env` にアクセスし、ファイルの内容が表示されず、404エラー（またはアクセス不可）になることを確認する。
3. `public` ディレクトリに適当なファイル（例: `test.txt`）を作成し、`http://localhost:3000/test.txt` には正常にアクセスできることを確認する。
