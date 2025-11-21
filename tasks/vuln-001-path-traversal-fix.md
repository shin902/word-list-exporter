# 🟠 VULN-001: ディレクトリトラバーサル脆弱性の修正

## 概要
プロジェクトルート全体を静的ファイルとして公開しているため、機密ファイル（.env、.git、package.jsonなど）が外部からアクセス可能になるリスクがあります。

## 脆弱性情報
- **ID**: vuln-001
- **カテゴリ**: Path Traversal (CWE-22)
- **重大度**: 🟠 High (CVSS: 7.5)
- **優先度**: P0（24時間以内）
- **影響ファイル**: `api/index.js:24`

## 実装タスク

### タスク1: 静的ファイル配信ディレクトリの制限
- [ ] `api/index.js`の24行目を修正
- [ ] `express.static(__dirname + '/../')` を `express.static(path.join(__dirname, '../public'))` に変更
- [ ] `path`モジュールがインポートされていることを確認

### タスク2: publicディレクトリの作成と静的ファイルの移動
- [ ] プロジェクトルートに`public`ディレクトリを作成
- [ ] 必要な静的ファイルを`public`ディレクトリに移動またはコピー
  - `index.html`
  - `styles.css`
  - `app.js` (必要に応じて)
  - その他の公開すべき静的ファイル

### タスク3: 機密ファイルのアクセス制限確認
- [ ] `.env`ファイルが`public`ディレクトリ外にあることを確認
- [ ] `package.json`が公開されないことを確認
- [ ] `.git`ディレクトリが公開されないことを確認
- [ ] `node_modules`が公開されないことを確認

### タスク4: 検証とテスト
- [ ] ローカル環境でサーバーを起動
- [ ] ブラウザまたはcurlで以下のアクセスを試行し、すべて404またはアクセス不可であることを確認
  ```bash
  curl http://localhost:3000/.env
  curl http://localhost:3000/package.json
  curl http://localhost:3000/.git/config
  curl http://localhost:3000/api/index.js
  ```
- [ ] 正常な静的ファイル（`index.html`など）はアクセス可能であることを確認

### タスク5: Vercel設定の更新（必要に応じて）
- [ ] `vercel.json`が存在する場合、静的ファイルルーティングを確認
- [ ] 機密ファイルが公開されないよう設定を更新

## 修正コード例

```javascript
// ❌ Before (api/index.js:24)
app.use(express.static(__dirname + '/../'));

// ✅ After
const path = require('path'); // ファイル上部でインポート
app.use(express.static(path.join(__dirname, '../public')));
```

## 成功基準
- [ ] `.env`、`package.json`、`.git`などの機密ファイルにHTTP経由でアクセスできない
- [ ] 必要な静的ファイル（HTML、CSS、JSなど）は正常にアクセスできる
- [ ] ローカル環境と本番環境の両方で検証完了

## 参考資料
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [CWE-22](https://cwe.mitre.org/data/definitions/22.html)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## 関連ファイル
- `api/index.js`
- `public/` (新規作成)
- `vercel.json` (存在する場合)
