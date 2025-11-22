# vuln-006: CSP Weakness (CSP設定不備)

## 脆弱性の詳細
`index.html` の `<meta http-equiv="Content-Security-Policy" ...>` において、`style-src 'self' 'unsafe-inline'` が設定されています。
`unsafe-inline` はインラインスタイル（`<style>`タグや `style="..."` 属性）を許可するため、XSS攻撃のリスクを高めます（CSSによる情報漏洩など）。

## 修正対象ファイル
- `index.html`

## 修正内容 (タスク)
1. `index.html` を開く。
2. CSP設定から `'unsafe-inline'` を削除する。
3. HTML内のインラインスタイル（`style="..."`）を確認し、これらを `styles.css` などの外部CSSファイルに移動する（クラスを使用するように変更）。

   例えば、`index.html` 内に以下のようなインラインスタイルがある場合:
   ```html
   <canvas id="preview-canvas" style="max-width: 100%; border: 1px solid #ccc; display: none;"></canvas>
   ```
   これをCSSクラスに置き換える必要がある。

   また、JavaScriptコード内で `.style.display = 'block'` のようにスタイルを操作している箇所がある場合、CSPの影響を受けるかどうか確認が必要だが、DOM API経由のスタイル操作（`element.style.prop = value`）は通常CSPの `unsafe-inline` 制限の対象外であることが多い（ブラウザによるが、現代のブラウザはスクリプト経由のスタイル設定は許可される）。しかし、`setAttribute('style', '...')` や `innerHTML` でstyle属性を埋め込む場合はブロックされる。

   調査の結果、JavaScript (`app.js`) で `element.style` を操作している箇所が多い。これらは通常安全だが、HTMLファイル内の `style="..."` 属性は削除する必要がある。

   **修正手順:**
   1. `styles.css` に新しいクラスを追加する。
      ```css
      .preview-canvas-hidden {
          max-width: 100%;
          border: 1px solid #ccc;
          display: none;
      }
      /* その他の必要なスタイル */
      ```
   2. `index.html` の `style` 属性を削除し、クラスを割り当てる。
   3. `<meta>` タグの `style-src` から `'unsafe-inline'` を削除する。

   *注意: JavaScriptで動的に生成される要素に `style` プロパティを設定している箇所（`saveBtn.style.marginTop = '20px'` など）は、CSP違反にならないはず（DOM操作のため）。*

## 検証方法
1. アプリケーションを起動する。
2. ブラウザの開発者ツールのコンソールを開く。
3. ページを表示し、CSP違反のエラーが出ていないか確認する。
4. スタイルが正しく適用されているか確認する。
