# My 暗記帳

フラッシュカード形式で学習できるWebアプリケーション

## 使い方

1. `index.html` をブラウザで開く
2. 「一覧表示」→「追加」から単語カードを登録
3. 「学習開始」でランダムに出題される問題を学習

## 機能（Phase 1 MVP）

- ✅ ホーム画面
- ✅ 単語カード追加機能
- ✅ 単語カード一覧表示（カテゴリ別）
- ✅ 単語カード削除機能
- ✅ ランダム出題による学習モード
- ✅ 上付き・下付き文字サポート（例: `x^2`, `H_2O`）
- ✅ ローカルストレージでのデータ永続化

## データ形式

```javascript
{
  category: String,  // カテゴリ名
  question: String,  // 問題文
  answer: String     // 解答文
}
```

## 詳細仕様

詳細な仕様については [docs/wordlist-specification.md](docs/wordlist-specification.md) を参照してください。
