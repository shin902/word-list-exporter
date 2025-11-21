# 🟠 サーバーレス環境におけるレート制限の構成不備 (DoSリスク)

## メタデータ
```yaml
id: vuln-002
version: v1
iteration: 1
language: js
category: config
cwe_id: CWE-770
cvss_score: 5.3
severity: Medium
priority: P2
discovered: 2024-05-22 10:15
status: New
related_vulns: [vuln-001]
```

## 🎯 要約
Redisが構成されていない本番環境（サーバーレス）において、レート制限が極端に厳しく設定（1時間あたり1リクエスト）されるため、同一IPを共有する正当なユーザーに対してサービス拒否（DoS）が発生する可能性があります。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L26
- **変数**: `limitMax`

## 💣 詳細

### 問題コード
```javascript
// api/routes/ocr.js

// Redisがない場合、Production環境では制限を1に設定
const limitMax = store ? 100 : (process.env.NODE_ENV === 'production' ? 1 : 100);

const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1時間
    max: limitMax,
    // ...
});
```

### 根本原因
1.  **環境依存の厳格すぎるデフォルト値**: Redisストアがない場合、セキュリティ（Bypass防止）を優先して制限値を `1` に設定していますが、これは実用性を著しく損ないます。
2.  **IPベースの共有制限**: NAT配下の複数のユーザー（企業、学校など）が同一IPとして扱われるため、1人のユーザーが利用すると他の全員が1時間利用できなくなります。

### 攻撃シナリオ
1.  攻撃者（または通常のユーザー）が1回リクエストを送信します。
2.  同じIPアドレス（Wi-FiスポットやNAT環境など）を利用する他のユーザーがリクエストを送信しようとします。
3.  サーバーは `429 Too Many Requests` を返し、サービスを利用できません。
4.  意図的な攻撃でなくても、サービスの可用性が損なわれます。

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Medium (特定環境下のユーザーが利用不可)
- **影響ユーザー**: NAT環境下のユーザー、または連続して利用したい正当なユーザー

## 🔗 関連脆弱性
- vuln-001: 認証の欠如（根本的な解決策として認証が必要）

## 🔬 検証手順 (PoC)

### 前提条件
- `NODE_ENV=production` で起動し、Redis環境変数を設定しない。

### 再現ステップ
```bash
# 1回目のリクエスト（成功）
curl -X POST http://localhost:3000/api/ocr -d '{"image":"..."}'

# 2回目のリクエスト（失敗 - 429 Error）
curl -X POST http://localhost:3000/api/ocr -d '{"image":"..."}'
```

## 🛡️ 推奨対策

### 短期
- [ ] 本番環境でのRedis (`KV_URL` or `REDIS_URL`) の設定をドキュメント等で強く強制する。
- [ ] Redisがない場合のフォールバック値を、セキュリティとユーザビリティのバランスを考慮した値（例: 10回/時）に緩和するか、Cookie等を用いたセッション追跡を併用する。

### 長期
- [ ] 認証システムを導入し、IPベースではなくユーザーIDベースのレート制限に移行する。

## 🔗 参考
- CWE-770: Allocation of Resources Without Limits or Throttling (逆のパターン：過度なスロットリング)
