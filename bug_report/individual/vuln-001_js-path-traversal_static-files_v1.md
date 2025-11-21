# 🔴 ディレクトリトラバーサル - 静的ファイル公開による機密情報漏洩

## メタデータ
```yaml
id: vuln-001
version: v1
iteration: 1
language: javascript
category: path-traversal
cwe_id: CWE-22
cvss_score: 7.5
severity: High
priority: P0
discovered: 2025-11-21 00:00
status: New
related_vulns: []
```

## 🎯 要約
プロジェクトルート全体を静的ファイルとして公開しているため、機密ファイル（.env、.git、package.jsonなど）が外部からアクセス可能になるリスクがあります。

## 📍 発生場所
- **ファイル**: `api/index.js`
- **行番号**: L24
- **関数**: `app.use()`
- **エンドポイント**: すべての静的ファイルリクエスト

## 💣 詳細

### 問題コード
```javascript
// 静的ファイルの配信（ローカル開発用）
app.use(express.static(__dirname + '/../'));
```

### 根本原因
- `__dirname + '/../'` はプロジェクトルートディレクトリ全体を指しており、すべてのファイルが公開される
- Express.jsの`express.static()`は、指定されたディレクトリ配下のすべてのファイルをHTTP経由でアクセス可能にする
- `.env`、`.git`、`package.json`、`node_modules`などの機密ファイルも含まれる可能性がある

### 攻撃シナリオ
1. 攻撃者がWebサイトにアクセス
2. `http://target.com/.env` や `http://target.com/package.json` にアクセス試行
3. ファイルが返された場合、APIキーや依存パッケージ情報が漏洩
4. 取得したAPIキー（GEMINI_API_KEY）を悪用して不正なAPI呼び出し
5. 依存パッケージ情報から既知の脆弱性を探索

### 影響範囲
- **機密性**: High（APIキー、環境変数の漏洩）
- **完全性**: None
- **可用性**: Low（APIキーが悪用されるとレート制限に達する可能性）
- **影響ユーザー**: すべてのユーザー、運営者

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- アプリケーションがローカルまたは本番環境で稼働中
- 静的ファイル配信が有効

### 再現ステップ
```bash
# .envファイルへのアクセス試行
curl http://localhost:3000/.env

# package.jsonへのアクセス試行
curl http://localhost:3000/package.json

# .gitディレクトリへのアクセス試行
curl http://localhost:3000/.git/config
```

## 🛡️ 推奨対策

### 短期
- [ ] 静的ファイルディレクトリを公開用のディレクトリのみに限定する
- [ ] 以下のように修正：
  ```javascript
  // ❌ Before
  app.use(express.static(__dirname + '/../'));

  // ✅ After
  app.use(express.static(path.join(__dirname, '../public')));
  // または、必要な静的ファイルのみを配信
  app.use('/styles.css', express.static(path.join(__dirname, '../styles.css')));
  app.use('/app.js', express.static(path.join(__dirname, '../app.js')));
  ```
- [ ] `.env`、`.git`、`package.json`などのファイルが配信されないことを確認

### 長期
- [ ] Vercel本番環境では、vercel.jsonの`routes`設定で静的ファイルを明示的に指定
- [ ] `.gitignore`や`.npmignore`を適切に設定し、機密ファイルがデプロイされないようにする
- [ ] Webサーバー（Nginx、Apache）で`.env`、`.git`などのファイルへのアクセスを明示的に拒否する設定を追加
- [ ] 定期的なセキュリティスキャンを実施し、意図しないファイル公開がないか確認

## 🔗 参考
- OWASP: https://owasp.org/www-community/attacks/Path_Traversal
- CWE: https://cwe.mitre.org/data/definitions/22.html
- Express.js Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html

---
*Iteration 1 | 2025-11-21 00:00 JST*
