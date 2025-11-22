# vuln-003: Weak Random (弱い乱数生成 - ID)

## 脆弱性の詳細
`app.js` 内の `generateUniqueId` 関数において、`crypto.randomUUID` も `crypto.getRandomValues` も利用できない場合のフォールバックとして、`Math.random()` とタイムスタンプを使用しています。
```javascript
    // 最終フォールバック（古いブラウザ用）: タイムスタンプ + Math.random()
    const timestamp = Date.now().toString(36);
    const randomPart1 = Math.random().toString(36).substring(2, 11);
    const randomPart2 = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${randomPart1}-${randomPart2}`;
```
`Math.random()` は暗号学的に安全ではなく、IDが予測可能になる可能性があります。

## 修正対象ファイル
- `app.js`

## 修正内容 (タスク)
1. `app.js` を開く。
2. `generateUniqueId` 関数のフォールバック処理を改善する。
   このアプリケーションはモダンブラウザを前提としていると思われるが、セキュリティ向上のため、`Math.random()` の使用についてコメントで警告を明記するか、あるいはこのフォールバック自体を削除し、例外をスローするように変更することも検討できる（ユーザーにモダンブラウザの使用を促すため）。

   ここでは、脆弱性レポートの推奨アクションに従い、**「古いブラウザサポート方針を明確化、または警告表示を追加」** する方針とするが、より積極的に `Math.random()` を排除する方向で修正案を提示する。

   ```javascript
   function generateUniqueId() {
       // crypto.randomUUID()が使用可能な場合（最も推奨）
       if (typeof crypto !== 'undefined' && crypto.randomUUID) {
           return crypto.randomUUID();
       }

       // フォールバック: crypto.getRandomValues()を使用
       if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
           const array = new Uint32Array(4);
           crypto.getRandomValues(array);
           return Array.from(array, dec => dec.toString(36)).join('-');
       }

       // 最終フォールバック: Math.random() は使用せずエラーとする、または明確な警告と共に使用する
       // ここでは安全性を優先し、エラーを投げるか、コンソールに警告を出す。
       console.warn('Warning: Using cryptographically insecure random number generator.');

       // 既存のMath.random()実装を残す場合でも、予測困難性を少しでも上げるために改善する
       // ただし、Math.random()自体が安全ではないため、根本的な解決にはならない。
       // 修正案としては、警告を追加した上で既存コードを維持する（Low Severityのため）。

       const timestamp = Date.now().toString(36);
       const randomPart1 = Math.random().toString(36).substring(2, 11);
       const randomPart2 = Math.random().toString(36).substring(2, 11);
       return `${timestamp}-${randomPart1}-${randomPart2}`;
   }
   ```

   *注: 実装時はコンソール警告 `console.warn('Using insecure fallback for ID generation');` を追加するだけで十分かもしれない。*

## 検証方法
1. ブラウザのコンソールで `crypto` オブジェクトを隠蔽または `randomUUID`/`getRandomValues` を無効化してテストを行う（これは難しい場合がある）。
2. コードレビューにより、フォールバックロジックに警告が含まれているか確認する。
