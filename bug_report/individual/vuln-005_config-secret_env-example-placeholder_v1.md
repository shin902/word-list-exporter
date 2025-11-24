# ℹ️ 情報 - .env.exampleの機密情報プレースホルダー

## メタデータ
```yaml
id: vuln-005
version: v1
iteration: 1
language: config
category: secret
cwe_id: CWE-798
cvss_score: 0.0
severity: Info
priority: P3
discovered: 2025-11-24 00:49
status: New
related_vulns: []
```

## 🎯 要約
.env.exampleファイルに機密情報のプレースホルダーが含まれていますが、実際のAPIキーが誤ってコミットされるリスクがあります。これは一般的なプラクティスですが、適切な管理が必要です。

## 📍 発生場所
- **ファイル**: `.env.example`
- **行番号**: L1-8
- **関数**: N/A（設定ファイル）
- **エンドポイント**: N/A

## 💣 詳細

### 問題コード
```bash
# .env.example L1-8
GEMINI_API_KEY=your_api_key_here
FRONTEND_URL=http://localhost:5500
PORT=3000
NODE_ENV=development
# Redis/KV URL (Required in production)
# KV_URL=redis://...
# REDIS_URL=redis://...
```

### 根本原因
- .env.exampleファイルが設定例として提供されている（良いプラクティス）
- しかし、開発者が誤って実際のAPIキーを.env.exampleに記載し、コミットする可能性がある
- .gitignoreに.envが含まれていても、.env.exampleは含まれていない

### 攻撃シナリオ

#### シナリオ1: 誤ってAPIキーをコミット
1. 開発者が.env.exampleを.envにコピー
2. GEMINI_API_KEYに実際のAPIキーを設定
3. 誤って.env.exampleファイルも編集してしまう
4. 気づかずにGitにコミット・プッシュ
5. 公開リポジトリの場合、APIキーが露出
6. 攻撃者がAPIキーを取得し、不正利用

#### シナリオ2: 履歴からの漏洩
1. 過去に誤って.envファイルをコミットしていた
2. 後で.gitignoreに追加して削除
3. しかし、Git履歴には残っている
4. 攻撃者が履歴を調査し、APIキーを発見

### 影響範囲
- **機密性**: None（現状は問題なし）
- **完全性**: None
- **可用性**: None
- **影響ユーザー**: 開発者、サーバー運営者

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- Gitリポジトリへのアクセス権限

### 再現ステップ
```bash
# Git履歴から.envファイルの存在を確認
git log --all --full-history -- .env

# もし見つかった場合、内容を確認
git show <commit-hash>:.env

# .env.exampleの内容を確認
cat .env.example
```

## 🛡️ 推奨対策

### 短期
- [ ] .gitignoreに.envが含まれていることを確認
  ```
  # .gitignore
  .env
  .env.local
  .env.*.local
  ```
- [ ] プレースホルダーを明確に識別可能にする
  ```bash
  # より明確なプレースホルダー
  GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE_DO_NOT_COMMIT_REAL_KEY
  ```
- [ ] README.mdに環境変数の設定手順を明記

### 長期
- [ ] Pre-commit フックの導入: 実際のAPIキーがコミットされていないかチェック
  ```bash
  #!/bin/bash
  # .git/hooks/pre-commit

  # .env.exampleファイルに本物のキーっぽい文字列がないかチェック
  if grep -E "GEMINI_API_KEY=AI[a-zA-Z0-9]{30,}" .env.example; then
      echo "Error: .env.example contains what looks like a real API key!"
      exit 1
  fi
  ```
- [ ] シークレットスキャンツールの導入: TruffleHog、git-secrets などを使用
- [ ] 環境変数管理サービスの利用: AWS Secrets Manager、Vercel Environment Variables など
- [ ] 定期的なシークレットローテーション: APIキーを定期的に更新

## 🔗 参考
- OWASP: https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password
- CWE: https://cwe.mitre.org/data/definitions/798.html
- GitHub Secret Scanning: https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning

---
*Iteration 1 | 2025-11-24 00:49:00 JST*
