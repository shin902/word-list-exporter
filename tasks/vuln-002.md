# vuln-002: Information Disclosure (情報漏洩)

## 脆弱性の詳細
`api/middleware/errorHandler.js` において、すべてのエラーに対して `console.error('Error:', err)` で詳細なエラースタックトレースをログに出力しています。
本番環境において、これらのログが意図せず外部に漏洩したり（ログ集約サービスの設定ミスなど）、攻撃者がエラーを誘発させてサーバー内部の状態を推測する手がかりになる可能性があります。

## 修正対象ファイル
- `api/middleware/errorHandler.js`

## 修正内容 (タスク)
1. `api/middleware/errorHandler.js` を開く。
2. エラーログの出力部分を修正し、本番環境（`NODE_ENV === 'production'`）ではスタックトレースなどの詳細情報を抑制するようにする。

   ```javascript
   function errorHandler(err, req, res, next) {
       // 本番環境以外、または重大なエラーの場合のみ詳細ログを出力するなどの制御を行う
       // 例:
       if (process.env.NODE_ENV !== 'production') {
           console.error('Error:', err);
       } else {
           // 本番環境では、エラーメッセージのみなど、最小限の情報にとどめる
           console.error('Error Message:', err.message);
       }

       // ... 既存の処理
   }
   ```

## 検証方法
1. `.env` ファイルなどで `NODE_ENV` を `production` に設定する。
2. エラーが発生するようなリクエストを送信する（例: 不正なJSONボディを送信するなど）。
3. コンソールログを確認し、完全なスタックトレースが表示されず、エラーメッセージのみ（または抑制されたログ）が出力されることを確認する。
4. `NODE_ENV` を `development` に戻し、詳細なスタックトレースが表示されることを確認する。
