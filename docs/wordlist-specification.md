# WordList - フラッシュカード学習アプリ 機能仕様書

## 1. アプリケーション概要

### 1.1 目的
ユーザーが問題と解答のペアを登録・管理し、ランダムに出題されるフラッシュカード形式で学習できるWebアプリケーション。

### 1.2 主要機能
- 単語カード(フラッシュカード)の作成・編集・削除
- カテゴリによる分類管理
- ランダム出題による学習モード
- 上付き・下付き文字のサポート
- ローカルストレージによるデータ永続化

---

## 2. データモデル

### 2.1 単語カードオブジェクト

各単語カードは以下のプロパティを持つ:

```javascript
{
  category: String,  // カテゴリ名
  question: String,  // 問題文
  answer: String     // 解答文
}
```

### 2.2 データ永続化
- **保存先**: ブラウザのローカルストレージ
- **キー名**: `MEMORY` (または任意の識別子)
- **形式**: JSON形式の配列

```javascript
// 保存例
[
  { category: "英単語", question: "apple", answer: "りんご" },
  { category: "数学", question: "x^2 + 2x + 1", answer: "(x+1)^2" },
  { category: "化学", question: "H_2O", answer: "水" }
]
```

---

## 3. 画面構成と機能

### 3.1 ホーム画面 (Home View)

#### UI要素
- **アプリタイトル**: "My 暗記帳"
- **学習開始ボタン**: 学習モードへ移動
- **一覧表示ボタン**: 単語カード管理画面へ移動

#### 動作仕様

**学習開始ボタン押下時**:
```
IF 登録済み単語カードが1件以上存在する THEN
  学習画面へ遷移
ELSE
  アラート表示: "まずは単語を登録してください"
END IF
```

#### スタイリング推奨
- 背景色: 明るい水色系 (#5ED0FF)
- ボタン: オレンジ系統の暖色
- 中央寄せレイアウト

---

### 3.2 学習画面 (Quiz View)

#### UI要素
- **カテゴリ表示エリア**: 現在のカードのカテゴリ
- **問題表示エリア**: 問題文
- **解答表示エリア**: 解答文 (初期状態では非表示)
- **アクションボタン**: 「答えを表示」/「次へ」(状態により変化)
- **終了ボタン**: ホーム画面へ戻る

#### 状態管理

**状態変数**:
- `wordArray`: 全単語カードの配列
- `currentIndex`: 現在表示中のカードのインデックス
- `isAnswerShown`: 解答が表示されているか (Boolean)

**初期化処理**:
```
1. ローカルストレージから単語カード配列を読み込み
2. 配列をシャッフル (Fisher-Yatesアルゴリズム等)
3. currentIndex = 0
4. isAnswerShown = false
5. 最初のカードを表示
```

#### インタラクション仕様

**アクションボタン押下時**:
```
IF isAnswerShown == false THEN
  // 解答を表示
  解答エリアに現在のカードの解答を表示
  isAnswerShown = true
  ボタンテキストを「次へ」に変更
ELSE
  // 次の問題へ
  currentIndex++
  
  IF currentIndex < wordArray.length THEN
    次のカードを表示
    解答エリアをクリア
    isAnswerShown = false
    ボタンテキストを「答えを表示」に変更
  ELSE
    完了画面へ遷移
  END IF
END IF
```

#### テキスト装飾機能

上付き・下付き文字のマークアップ記法をサポート:

**記法ルール**:
- `^`: 直後の1文字を上付き文字に
- `_`: 直後の1文字を下付き文字に
- `^{...}`: 波括弧内の複数文字を上付き文字に
- `_{...}`: 波括弧内の複数文字を下付き文字に

**変換例**:
- 入力: `x^2 + y^2 = r^2`
- 出力: x² + y² = r²

- 入力: `H_2O`
- 出力: H₂O

- 入力: `10^{-5}`
- 出力: 10⁻⁵

**実装アプローチ**:
```javascript
function parseSubscriptSuperscript(text) {
  // 正規表現でマーカーを検出
  // HTMLの<sup>と<sub>タグに変換
  // または CSS (vertical-align, font-size) を適用
}
```

---

### 3.3 単語カード一覧画面 (List View)

#### UI要素
- **ナビゲーションバー**:
  - 左: 戻るボタン
  - 中央: タイトル「一覧」
  - 右: 編集ボタン、追加ボタン
- **カードリスト**: カテゴリごとにグループ化されたリスト
- **各リストアイテム**: 問題文と解答文を表示

#### データ表示ロジック

**カテゴリ別グルーピング**:
```javascript
// 1. 全カテゴリの一意なリストを作成
const categories = [...new Set(wordArray.map(card => card.category))].sort();

// 2. 各カテゴリごとにカードをフィルタリング
categories.forEach(category => {
  const cardsInCategory = wordArray.filter(card => card.category === category);
  // カテゴリヘッダーとカードを表示
});
```

#### インタラクション仕様

**1. 追加ボタン**:
- 単語カード追加画面へ遷移

**2. 編集ボタン**:
- 編集モードの切り替え
- 編集モード時:
  - 各アイテムに削除ボタン表示
  - ドラッグ&ドロップで並び替え可能
  - ボタンテキストが「完了」に変化

**3. スワイプアクション (モバイル対応)**:
- 左スワイプ: 削除アクション表示
- 右スワイプ: 編集アクション表示

**4. カードアイテムクリック/タップ**:
- 編集ダイアログを表示

#### 削除機能

**削除処理フロー**:
```
1. ユーザーが削除を確認
2. 対象カードを配列から削除
3. ローカルストレージを更新
4. UIを再描画
```

#### 編集機能

**編集ダイアログ**:
- 入力フィールド:
  - 問題文 (既存値をプリセット)
  - 解答文 (既存値をプリセット)
  - カテゴリ (既存値をプリセット)
- ボタン:
  - キャンセル: 変更を破棄
  - 保存: 変更を保存

**保存処理**:
```
1. 入力検証 (空欄チェック)
2. 配列内の対象要素を更新
3. ローカルストレージを更新
4. UIを再描画
```

#### 並び替え機能

**ドラッグ&ドロップ仕様**:
- カードを長押し/ドラッグでピックアップ
- 別の位置にドロップで順序変更
- 異なるカテゴリへの移動も可能
- ドロップ後、即座にローカルストレージを更新

---

### 3.4 単語カード追加画面 (Add View)

#### UI要素
- **ナビゲーションバー**:
  - 左: キャンセル/戻るボタン
  - 中央: タイトル「新規追加」
  - 右: 保存ボタン
- **入力フォーム**:
  - 問題文入力欄
  - 解答文入力欄
  - カテゴリ入力欄

#### 保存処理フロー

```
1. ボタン押下
2. 入力検証:
   IF 問題文が空 OR 解答文が空 THEN
     エラーアラート: "問題と解答を入力してください"
     処理中断
   END IF
3. 新規カードオブジェクトを作成
4. 配列に追加
5. ローカルストレージを更新
6. 成功アラート: "保存しました"
7. 入力欄をクリア
```

#### UI/UX推奨事項
- カテゴリ入力時に既存カテゴリの候補を表示 (オートコンプリート)
- Enter/Tabキーでフィールド間を移動可能に
- 保存成功後、連続して登録できるようにフィールドをクリア

---

### 3.5 完了画面 (Completion View)

#### UI要素
- **メッセージ**: "完了!" または "お疲れ様でした"
- **ホームに戻るボタン**: ホーム画面へ遷移

#### オプション機能 (拡張案)
- 学習した単語数の表示
- 正答率の表示 (正誤判定機能を追加した場合)
- もう一度学習するボタン

---

## 4. ナビゲーション構造

```
ホーム画面
├─ 学習画面
│  └─ 完了画面
│     └─ ホーム画面 (戻る)
└─ 一覧画面
   ├─ 追加画面
   │  └─ 一覧画面 (戻る)
   └─ ホーム画面 (戻る)
```

### ルーティング実装案

**シングルページアプリケーション (SPA) アプローチ**:
```javascript
const routes = {
  'home': renderHomeView,
  'quiz': renderQuizView,
  'list': renderListView,
  'add': renderAddView,
  'completion': renderCompletionView
};

function navigate(routeName) {
  // 現在のビューを非表示
  // 指定されたビューを表示
  routes[routeName]();
}
```

---

## 5. データ操作API

### 5.1 基本的なCRUD操作

```javascript
// Create - 新規カード作成
function createCard(category, question, answer) {
  const card = { category, question, answer };
  const cards = loadCards();
  cards.push(card);
  saveCards(cards);
}

// Read - 全カード取得
function loadCards() {
  const data = localStorage.getItem('MEMORY');
  return data ? JSON.parse(data) : [];
}

// Update - カード更新
function updateCard(index, category, question, answer) {
  const cards = loadCards();
  cards[index] = { category, question, answer };
  saveCards(cards);
}

// Delete - カード削除
function deleteCard(index) {
  const cards = loadCards();
  cards.splice(index, 1);
  saveCards(cards);
}

// Save - ローカルストレージに保存
function saveCards(cards) {
  localStorage.setItem('MEMORY', JSON.stringify(cards));
}
```

### 5.2 便利な操作関数

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

// カテゴリ一覧を取得
function getCategories() {
  const cards = loadCards();
  return [...new Set(cards.map(card => card.category))].sort();
}

// 特定カテゴリのカードを取得
function getCardsByCategory(category) {
  const cards = loadCards();
  return cards.filter(card => card.category === category);
}
```

---

## 6. スタイリングガイドライン

### 6.1 カラーパレット

```css
/* プライマリカラー */
--primary-bg: #5ED0FF;        /* 水色背景 */
--primary-button: #FF9248;    /* オレンジボタン */
--secondary-button: #F1A15E;  /* 薄いオレンジボタン */
--input-bg: #5CFAFF;          /* 入力欄背景 */

/* テキストカラー */
--text-dark: #333333;         /* 濃い文字 */
--text-light: #FFFFFF;        /* 明るい文字 */
```

### 6.2 タイポグラフィ

```css
/* タイトル */
.app-title {
  font-size: 60px;
  font-weight: bold;
}

/* 見出し */
.section-heading {
  font-size: 30px;
  font-weight: bold;
}

/* 通常テキスト */
.body-text {
  font-size: 16px;
}

/* 上付き文字 */
.superscript {
  font-size: 0.6em;
  vertical-align: super;
}

/* 下付き文字 */
.subscript {
  font-size: 0.6em;
  vertical-align: sub;
}
```

### 6.3 レスポンシブデザイン

```css
/* モバイル優先アプローチ */
.container {
  max-width: 100%;
  padding: 16px;
}

/* タブレット以上 */
@media (min-width: 768px) {
  .container {
    max-width: 720px;
    margin: 0 auto;
  }
}

/* デスクトップ */
@media (min-width: 1024px) {
  .container {
    max-width: 960px;
  }
}
```

---

## 7. 実装時の技術的考慮事項

### 7.1 状態管理
- 小規模なので、Vanilla JSの変数管理で十分
- 必要に応じてReact/Vue等のフレームワークを使用

### 7.2 データバリデーション
- 必須項目チェック (問題文、解答文)
- 文字数制限 (推奨: 各フィールド500文字以内)
- XSS対策のためのサニタイズ処理

### 7.3 パフォーマンス最適化
- 大量のカード登録を想定する場合:
  - 仮想スクロール実装
  - ページネーション
  - 検索・フィルタ機能

### 7.4 アクセシビリティ
- キーボード操作対応
- スクリーンリーダー対応 (ARIA属性)
- 適切なコントラスト比

### 7.5 エラーハンドリング
- ローカルストレージが使用できない場合の対応
- データ破損時の復旧処理
- ユーザーフレンドリーなエラーメッセージ

---

## 8. 拡張機能案

### 8.1 学習機能の強化
- 正誤判定機能
- 学習履歴・統計の記録
- 復習スケジューリング (間隔反復法)
- タイマー機能

### 8.2 データ管理
- インポート/エクスポート (JSON, CSV)
- 複数デッキの管理
- クラウド同期

### 8.3 UI/UX改善
- ダークモード
- カスタムテーマ
- アニメーション効果
- 音声読み上げ

### 8.4 共有機能
- デッキの共有URL生成
- ソーシャルメディア連携

---

## 9. テスト項目

### 9.1 機能テスト
- [ ] カードの作成・編集・削除
- [ ] カテゴリ別のフィルタリング
- [ ] ランダム出題
- [ ] 上付き・下付き文字の表示
- [ ] データの永続化

### 9.2 エッジケースのテスト
- [ ] カードが0件の状態での動作
- [ ] 特殊文字を含むテキストの保存・表示
- [ ] 長文テキストの表示
- [ ] 同一カテゴリ名の重複
- [ ] ローカルストレージの容量超過

### 9.3 ブラウザ互換性
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] モバイルブラウザ (iOS Safari, Chrome Mobile)

---

## 10. 実装の優先順位

### Phase 1 (MVP - 最小viable製品)
1. ホーム画面
2. カード追加画面 (基本機能のみ)
3. 学習画面 (シャッフル、問題・解答表示)
4. ローカルストレージでのデータ永続化

### Phase 2 (コア機能完成)
5. 一覧画面 (表示、削除)
6. カテゴリ別グルーピング
7. 編集機能
8. 上付き・下付き文字サポート

### Phase 3 (UX改善)
9. 並び替え機能
10. レスポンシブデザイン最適化
11. アニメーション効果
12. エラーハンドリング強化

### Phase 4 (拡張機能)
13. 統計情報表示
14. インポート/エクスポート
15. その他の拡張機能

---

## 11. まとめ

このドキュメントは、フラッシュカード学習アプリケーションの完全な機能仕様を提供します。JavaScript/HTML/CSSでの実装を念頭に、プラットフォーム非依存な形で設計されています。

**核となる機能**:
- データのCRUD操作
- カテゴリによる分類
- ランダム出題
- ローカルストレージでの永続化

これらの機能を段階的に実装することで、実用的な学習ツールを構築できます。
