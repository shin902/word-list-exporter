# バックエンド実装計画書
## 単一APIキー管理システムの導入

**作成日**: 2025-11-20

---

## 📋 目次

1. [現状分析](#現状分析)
2. [目標アーキテクチャ](#目標アーキテクチャ)
3. [技術スタック](#技術スタック)
4. [実装手順](#実装手順)
5. [セキュリティ考慮事項](#セキュリティ考慮事項)
6. [デプロイメント戦略](#デプロイメント戦略)
7. [テスト計画](#テスト計画)
8. [マイルストーン](#マイルストーン)
9. [リスクと対策](#リスクと対策)

---

## 現状分析

### アーキテクチャ

**現在**: フロントエンドのみ（Static SPA）

```
ユーザーブラウザ → Gemini API（直接呼び出し）
     ↓
localStorage（APIキー保存：平文）
```

### セキュリティ上の課題

| 課題 | 影響度 | 詳細 |
|------|--------|------|
| APIキーの平文保存 | 高 | localStorageに暗号化なしで保存 |
| ブラウザからの直接API呼び出し | 中 | APIキーがネットワークトラフィックに露出 |
| 開発者ツールでの閲覧可能 | 高 | F12キーで誰でもAPIキーを確認可能 |
| レート制限の未実装 | 中 | 悪意のある利用者による大量リクエストのリスク |
| 利用状況の追跡不可 | 低 | コスト管理・監視が困難 |

### 現在のコード構造

**重要なファイル**:
- `app.js` (1,152行)
  - APIキー管理: 114-156行
  - OCR処理: 861-954行
- `index.html`
  - APIキー設定UI: 132-164行
  - CSPヘッダー: 6-17行

**Gemini API利用箇所**:
```javascript
// app.js:877
headers: {
    'x-goog-api-key': apiKey,
    'Content-Type': 'application/json'
}
```

---

## 目標アーキテクチャ

### システム構成図

```
┌─────────────┐      HTTPS      ┌──────────────┐     HTTPS     ┌─────────────┐
│   ユーザー   │ ──────────────> │  バックエンド  │ ────────────> │  Gemini API  │
│  ブラウザ   │ <────────────── │   サーバー    │ <──────────── │             │
└─────────────┘                 └──────────────┘               └─────────────┘
      │                                │
      │ (APIキー不要)                  │ 環境変数
      │                                ↓
      │                         ┌──────────────┐
      │                         │   .env file   │
      │                         │  API_KEY=xxx  │
      │                         └──────────────┘
      │
      ↓ localStorage
┌─────────────┐
│  単語カード  │
│   データ     │
└─────────────┘
```

### データフロー

1. **画像アップロード**
   ```
   ユーザー → フロントエンド → Base64エンコード
   → バックエンド `/api/ocr` → Gemini API → 結果返却
   ```

2. **エラーハンドリング**
   ```
   Gemini API (エラー) → バックエンド (整形) → フロントエンド (表示)
   ```

3. **レート制限**
   ```
   バックエンド: IPアドレス/セッションID単位で制限
   例: 1時間あたり100リクエスト
   ```

---

## 技術スタック

### バックエンド

| 技術 | 選定理由 | 代替案 |
|------|---------|--------|
| **Node.js** | フロントエンドと同じ言語、軽量 | Python (Flask), Go |
| **Express.js** | シンプル、豊富なミドルウェア | Fastify, Koa |
| **dotenv** | 環境変数管理の標準 | - |
| **express-rate-limit** | レート制限の簡単実装 | redis-rate-limiter |
| **helmet** | セキュリティヘッダー自動設定 | - |
| **cors** | CORS設定の簡素化 | - |

### インフラ（候補）

| サービス | メリット | デメリット | コスト |
|---------|---------|-----------|--------|
| **Vercel** | 簡単デプロイ、Serverless | コールドスタート | 無料枠あり |
| **Netlify Functions** | GitOps、自動デプロイ | 実行時間制限 | 無料枠あり |
| **Railway** | フルスタック対応 | 設定がやや複雑 | $5/月〜 |
| **Render** | 無料枠あり、フルスタック | コールドスタート | 無料枠あり |
| **AWS Lambda** | スケーラブル | 設定が複雑 | 従量課金 |

**推奨**: Vercel（フロントエンドとバックエンドを一緒にデプロイ可能）

---

## 実装手順

### Phase 1: バックエンド基盤構築（2-4時間）

#### 1.1 プロジェクト構造の作成

```
word-list-exporter/
├── api/                    # バックエンドコード
│   ├── index.js           # Expressサーバー
│   ├── routes/
│   │   └── ocr.js         # OCRエンドポイント
│   ├── middleware/
│   │   ├── rateLimit.js   # レート制限
│   │   └── errorHandler.js # エラーハンドリング
│   └── utils/
│       └── gemini.js      # Gemini API呼び出し
├── .env.example           # 環境変数テンプレート
├── .env                   # 実際の環境変数（.gitignore）
├── vercel.json            # Vercel設定
└── package.json           # 依存関係
```

#### 1.2 依存関係のインストール

```bash
npm install express dotenv cors helmet express-rate-limit
npm install express dotenv cors helmet express-rate-limit
npm install --save-dev nodemon jest supertest
```

#### 1.3 Express サーバーの実装

```javascript
// api/index.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const ocrRouter = require('./routes/ocr');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// セキュリティ
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// ボディパーサー（画像サイズを考慮）
app.use(express.json({ limit: '10mb' }));

// ルート
app.use('/api/ocr', ocrRouter);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// エラーハンドリング
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// ローカル開発時のみサーバーを起動
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
```

### Phase 2: OCRエンドポイントの実装（1-2時間）

#### 2.1 Gemini API呼び出しロジック

```javascript
// api/utils/gemini.js
const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function performOCR(base64Image) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = `以下の画像には、日本語または英語のテキストが含まれています。
赤色で書かれているテキストのみを抽出してください。
各行は「問題文:解答」の形式で出力してください。
赤色のテキストが見つからない場合は「NONE」と出力してください。`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    }]
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Invalid response format from Gemini API');
  }

  const text = data.candidates[0].content.parts[0].text;
  return text;
}

module.exports = { performOCR };
```

#### 2.2 OCRエンドポイント

```javascript
// api/routes/ocr.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { performOCR } = require('../utils/gemini');

const router = express.Router();

// レート制限: 1時間あたり100リクエスト
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { error: 'レート制限に達しました。1時間後に再試行してください。' }
// レート制限: 1時間あたり100リクエスト
// 注意: VercelなどのServerless環境ではメモリ上のストアはリクエスト毎にリセットされる可能性があるため、
// 厳密な制限にはRedisなどの外部ストアが必要です。今回は簡易的な実装とします。
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { error: 'レート制限に達しました。1時間後に再試行してください。' }
});

router.post('/', limiter, async (req, res, next) => {
  try {
    const { image } = req.body;

    // バリデーション
    if (!image) {
      return res.status(400).json({ error: '画像データが必要です' });
    }

    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: '無効な画像形式です' });
    }

    // Base64データの抽出
    const base64Data = image.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({ error: '画像データの解析に失敗しました' });
    }

    // OCR実行
    const result = await performOCR(base64Data);

    res.json({
      success: true,
      text: result
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

#### 2.3 エラーハンドリングミドルウェア

```javascript
// api/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Gemini APIエラーの処理
  if (err.message && err.message.includes('Gemini API error')) {
    const statusMatch = err.message.match(/(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 500;

    if (status === 429) {
      return res.status(429).json({
        error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。'
      });
    } else if (status === 401 || status === 403) {
      return res.status(500).json({
        error: 'サーバーの設定エラーです。管理者に連絡してください。'
      });
    }
  }

  // デフォルトエラー
  res.status(500).json({
    error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
  });
}

module.exports = errorHandler;
```

### Phase 3: フロントエンド修正（1-2時間）

#### 3.1 APIキー関連コードの削除

**削除対象**:
- `app.js`: 114-156行（APIキー管理関数）
- `index.html`: 132-164行（設定画面UI）

#### 3.2 `performOCR`関数の修正

```javascript
// app.js（修正後）
async function performOCR(canvas) {
    const loadingEl = document.getElementById('importLoading');
    const errorEl = document.getElementById('importError');

    try {
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');

        // キャンバスをBase64に変換
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // バックエンドに送信
        const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'OCR処理に失敗しました');
        }

        const data = await response.json();

        if (data.text === 'NONE') {
            throw new Error('赤字のテキストが見つかりませんでした');
        }

        return data.text;

    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    } finally {
        loadingEl.classList.add('hidden');
    }
}
```

#### 3.3 設定画面UIの削除

```html
<!-- index.html（修正後） -->
<!-- 設定ボタンと設定モーダルを完全に削除 -->
<!-- ホーム画面の説明文を更新 -->
<div id="home-screen" class="screen active">
    <div class="home-container">
        <h1>My 暗記帳</h1>
        <p>フラッシュカード形式で効率的に学習</p>
        <p>画像から自動で単語カードを作成できます</p> <!-- APIキー不要と明記 -->

        <div class="button-group">
            <button onclick="showScreen('study-screen')" class="btn btn-primary">学習開始</button>
            <button onclick="showScreen('list-screen')" class="btn btn-secondary">一覧表示</button>
        </div>
    </div>
</div>
```

#### 3.4 README.mdの更新

- APIキー設定の説明を削除
- セキュリティ警告を削除
- バックエンドのセットアップ手順を追加

### Phase 4: デプロイメント設定（1-2時間）

#### 4.1 環境変数設定

```bash
# .env.example（テンプレート）
GEMINI_API_KEY=your_api_key_here
FRONTEND_URL=https://yourdomain.com
PORT=3000
NODE_ENV=production
```

#### 4.2 Vercel設定

```json
// vercel.json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    }
  ]
}
```

#### 4.3 .gitignoreの更新

```gitignore
# Environment variables
.env

# Node modules
node_modules/
api/node_modules/

# Logs
*.log
npm-debug.log*

# Build
dist/
build/
```

### Phase 5: テスト（2-4時間）

#### 5.1 ユニットテスト

```javascript
// api/__tests__/ocr.test.js
const request = require('supertest');
const app = require('../index');

describe('POST /api/ocr', () => {
  it('should return error when no image provided', async () => {
    const response = await request(app)
      .post('/api/ocr')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('should return error for invalid image format', async () => {
    const response = await request(app)
      .post('/api/ocr')
      .send({ image: 'invalid' });

    expect(response.status).toBe(400);
  });

  // モックを使った正常系テストなど
});
```

#### 5.2 統合テスト

- フロントエンドからバックエンドへの通信テスト
- 実際の画像を使ったE2Eテスト
- エラーハンドリングのテスト

---

## セキュリティ考慮事項

### 実装するセキュリティ対策

| 対策 | 実装方法 | 優先度 |
|------|---------|--------|
| **APIキーの保護** | 環境変数（.env）、GitHubでは.gitignore | 必須 |
| **レート制限** | express-rate-limit（IP単位） | 必須 |
| **CORS設定** | 特定のオリジンのみ許可 | 必須 |
| **入力バリデーション** | 画像形式・サイズの検証 | 必須 |
| **セキュリティヘッダー** | helmet.js使用 | 必須 |
| **HTTPS強制** | デプロイ環境で設定 | 必須 |
| **エラーメッセージの最小化** | 内部エラーを隠蔽 | 推奨 |
| **ログ記録** | アクセスログ、エラーログ | 推奨 |
| **DDoS対策** | CloudflareなどのCDN | 任意 |

### セキュリティチェックリスト

- [ ] `.env`ファイルが`.gitignore`に含まれている
- [ ] APIキーがコードにハードコードされていない
- [ ] CORS設定が本番環境のURLのみ許可している
- [ ] レート制限が適切に設定されている
- [ ] エラーメッセージに機密情報が含まれていない
- [ ] HTTPS通信のみ許可している
- [ ] 画像サイズの上限が設定されている（10MB）
- [ ] 入力バリデーションが実装されている

---

## デプロイメント戦略

### デプロイフロー

```
開発 → テスト → ステージング → 本番
```

### Vercelデプロイ手順

1. **Vercelアカウント作成・リポジトリ連携**
   ```bash
   npm install -g vercel
   vercel login
   vercel link
   ```

2. **環境変数の設定**
   ```bash
   # Vercel ダッシュボードで設定
   # または CLIで設定
   vercel env add GEMINI_API_KEY
   ```

3. **デプロイ**
   ```bash
   # プレビューデプロイ
   vercel

   # 本番デプロイ
   vercel --prod
   ```

4. **動作確認**
   - ヘルスチェック: `https://yourdomain.com/api/health`
   - フロントエンド: `https://yourdomain.com/`

### ロールバック計画

```bash
# 前のデプロイに戻す
vercel rollback
```

---

## テスト計画

### テストレベル

| レベル | 対象 | ツール | カバレッジ目標 |
|--------|------|--------|---------------|
| ユニットテスト | 個別関数 | Jest | 80%以上 |
| 統合テスト | API エンドポイント | Supertest | 主要パス100% |
| E2Eテスト | フロントエンド+バックエンド | Playwright | 主要機能100% |
| 手動テスト | UI/UX | - | 全画面 |

### テストケース

#### バックエンド

1. **正常系**
   - ✅ 有効な画像でOCR成功
   - ✅ ヘルスチェックが200を返す

2. **異常系**
   - ✅ 画像データなし → 400エラー
   - ✅ 無効な画像形式 → 400エラー
   - ✅ APIキー未設定 → 500エラー
   - ✅ レート制限超過 → 429エラー

#### フロントエンド

1. **正常系**
   - ✅ 画像アップロード後にOCR結果が表示される
   - ✅ APIキー設定画面が表示されない

2. **異常系**
   - ✅ ネットワークエラー時に適切なメッセージ表示
   - ✅ OCR失敗時のエラーハンドリング

---

## マイルストーン

### フェーズ1: バックエンド基盤（Day 1）
- [x] プロジェクト構造作成
- [ ] Express サーバー実装
- [ ] 環境変数設定
- [ ] ヘルスチェックエンドポイント

**完了条件**: `curl http://localhost:3000/api/health` が成功

### フェーズ2: OCR機能（Day 2-3）
- [ ] Gemini API呼び出し実装
- [ ] OCRエンドポイント実装
- [ ] エラーハンドリング
- [ ] レート制限

**完了条件**: Postmanで画像送信→OCR結果取得が成功

### フェーズ3: フロントエンド統合（Day 4）
- [ ] APIキー管理コード削除
- [ ] `performOCR`関数の修正
- [ ] 設定画面UI削除
- [ ] README更新

**完了条件**: フロントエンドからバックエンド経由でOCRが成功

### フェーズ4: デプロイ準備（Day 5）
- [ ] Vercel設定
- [ ] 環境変数設定
- [ ] .gitignore更新
- [ ] セキュリティチェック

**完了条件**: ステージング環境で動作確認完了

### フェーズ5: テスト・本番デプロイ（Day 6-7）
- [ ] ユニットテスト作成
- [ ] 統合テスト実行
- [ ] 本番デプロイ
- [ ] 動作確認

**完了条件**: 本番環境で全機能が正常動作

---

## リスクと対策

### 技術的リスク

| リスク | 影響度 | 確率 | 対策 |
|--------|--------|------|------|
| Gemini APIの仕様変更 | 高 | 低 | APIバージョン固定、モニタリング |
| レート制限の適切な設定ミス | 中 | 中 | 段階的に調整、ログ監視 |
| 画像サイズによるタイムアウト | 中 | 中 | タイムアウト設定、画像サイズ制限 |
| CORS設定ミス | 低 | 低 | テスト環境で事前確認 |
| 環境変数の設定漏れ | 中 | 低 | チェックリスト、自動テスト |

### 運用リスク

| リスク | 影響度 | 確率 | 対策 |
|--------|--------|------|------|
| APIキーの漏洩 | 高 | 低 | .gitignore徹底、定期的なローテーション |
| コスト超過 | 中 | 中 | レート制限、アラート設定 |
| サーバーダウン | 中 | 低 | ヘルスチェック、自動再起動 |
| DDoS攻撃 | 中 | 低 | CloudflareなどのCDN導入 |

### 緩和策

1. **段階的デプロイ**
   - まずステージング環境でテスト
   - 本番は少数ユーザーでベータテスト

2. **モニタリング**
   - ログ記録（アクセス、エラー、パフォーマンス）
   - アラート設定（エラー率、レスポンスタイム）

3. **ロールバック計画**
   - 前バージョンのバックアップ保持
   - 1コマンドでロールバック可能な状態維持

---

## コスト見積もり

### インフラコスト（月額）

| 項目 | サービス | 無料枠 | 有料プラン |
|------|---------|--------|-----------|
| ホスティング | Vercel | ✅ 100GB帯域 | $20/月〜 |
| API呼び出し | Gemini API | ✅ 1,500req/日 | 従量課金 |
| ドメイン | 任意 | - | $10-15/年 |
| **合計** | | **$0/月** | $20-30/月 |

### 開発コスト

- **初期開発**: 8-15時間
- **テスト**: 2-4時間
- **デプロイ**: 1-2時間
- **ドキュメント**: 1-2時間

**合計**: 12-23時間

---

## 参考資料

### API ドキュメント
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Vercel Documentation](https://vercel.com/docs)

### セキュリティ
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### デプロイ
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)

---

## 承認・レビュー

- [ ] 技術的実装計画の承認
- [ ] セキュリティレビュー完了
- [ ] コスト見積もりの承認
- [ ] 実装開始の承認

**次のステップ**: 承認後、フェーズ1から実装を開始

---

**最終更新**: 2025-11-20
**作成者**: Claude
**ステータス**: レビュー待ち
