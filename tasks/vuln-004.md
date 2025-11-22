# vuln-004: Weak Random (弱い乱数生成 - Shuffle)

## 脆弱性の詳細
`app.js` 内の `shuffleCards` 関数において、Fisher-Yates シャッフルアルゴリズムの実装に `Math.random()` が使用されています。
```javascript
// カード配列をシャッフル
function shuffleCards(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
```
`Math.random()` は予測可能であるため、シャッフル結果が予測可能になる可能性があります（カードゲームやテストの出題順序としては公平性が損なわれる可能性がある）。

## 修正対象ファイル
- `app.js`

## 修正内容 (タスク)
1. `app.js` を開く。
2. `shuffleCards` 関数を修正し、`crypto.getRandomValues()` を使用して乱数を生成するように変更する。

   ```javascript
   function shuffleCards(cards) {
       const shuffled = [...cards];
       for (let i = shuffled.length - 1; i > 0; i--) {
           // Math.random() の代わりに crypto.getRandomValues() を使用
           let j;
           if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
               const array = new Uint32Array(1);
               crypto.getRandomValues(array);
               // 0 から i までの範囲の乱数を得る
               // NOTE: バイアスを完全に排除するにはより複雑な処理が必要だが、
               // 簡易的には以下で Math.random() よりはマシになる
               j = array[0] % (i + 1);
           } else {
               // フォールバック
               j = Math.floor(Math.random() * (i + 1));
           }

           [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
       }
       return shuffled;
   }
   ```

## 検証方法
1. アプリケーションを起動し、学習モードを開始してカードがシャッフルされることを確認する（エラーが出ないこと）。
2. 何度か実行し、ランダムに並び替えられているように見えるか確認する。
