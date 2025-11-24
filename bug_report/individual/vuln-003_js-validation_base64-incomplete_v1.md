# 🟢 入力検証不足 - Base64バリデーション不完全

## メタデータ
```yaml
id: vuln-003
version: v1
iteration: 1
language: javascript
category: validation
cwe_id: CWE-20
cvss_score: 3.7
severity: Low
priority: P2
discovered: 2025-11-24 00:47
status: New
related_vulns: []
```

## 🎯 要約
Base64データのバリデーションがReDoS攻撃を避けるために意図的に削除されていますが、代替の検証メカニズムが不足しているため、不正なデータがGemini APIに送信される可能性があります。

## 📍 発生場所
- **ファイル**: `api/routes/ocr.js`
- **行番号**: L69-83
- **関数**: `router.post('/')`
- **エンドポイント**: `POST /api/ocr`

## 💣 詳細

### 問題コード
```javascript
// L69-83: Base64形式の検証
// Base64形式の検証 (RFC 4648に従い、ホワイトスペースを除去してから検証)
// 正規表現による検証は大きなデータに対してDoSの可能性があるため、
// 簡易的な文字チェックのみ行うか、デコード時のエラーハンドリングに任せる
const cleanedBase64Data = base64Data.replace(/\s/g, '');

// 簡易チェック: Base64文字以外が含まれていないか
// Note: 完全なBase64検証は高コストなため、ここでは明らかに不正な文字のみチェックするか、
// Buffer.fromでのデコード結果を信頼する。
// ここでは、正規表現による全文スキャンを避けるため、チェックを省略し
// performOCR内での処理に任せるか、必要ならより軽量なチェックを実装する。
// しかし、gemini apiに送る前に最低限のチェックはしておきたい。
// Node.jsのBufferは非Base64文字を無視する仕様があるため、
// 厳密なチェックが必要ならバリデーターライブラリを使うべきだが、
// ここではReDoS回避のため正規表現チェックを削除する。

// OCR実行 (クリーンアップされたBase64データを使用)
const result = await performOCR(cleanedBase64Data);
```

### 根本原因
- ReDoS攻撃のリスク回避のため、正規表現によるBase64バリデーションが削除されている
- 代替の軽量なバリデーションメカニズムが実装されていない
- 不正なBase64データがGemini APIに直接送信される可能性
- コメントに「gemini apiに送る前に最低限のチェックはしておきたい」と記載されているが、実装されていない

### 攻撃シナリオ
1. 攻撃者が不正なBase64データを含むリクエストを送信
2. バリデーションをバイパスしてGemini APIにリクエストが転送される
3. Gemini APIがエラーを返す
4. エラーハンドリングにより、サーバーリソースが消費される
5. 大量の不正リクエストにより、レート制限に達する可能性

**影響**:
- Gemini APIの無駄な呼び出しによるコスト増加
- サーバーリソースの浪費
- 正当なユーザーのリクエストがレート制限により拒否される

### 影響範囲
- **機密性**: None
- **完全性**: None
- **可用性**: Low - 不正なリクエストによるリソース消費
- **影響ユーザー**: サーバー運営者、正当なユーザー

## 🔗 関連脆弱性
なし

## 🔬 検証手順 (PoC)

### 前提条件
- APIエンドポイントへのアクセス権限
- レート制限内でのリクエスト

### 再現ステップ
```bash
# ケース1: 不正なBase64データを送信
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,ThisIsNotValidBase64!!!@@@###"
  }'

# 期待される結果: Gemini APIエラーまたは内部サーバーエラー
# {"error": "Gemini API error: 400 - ..."}

# ケース2: 非常に長い不正データを送信（サイズ制限内）
curl -X POST http://localhost:3000/api/ocr \
  -H "Content-Type: application/json" \
  -d "{
    \"image\": \"data:image/jpeg;base64,$(python3 -c 'print(\"A\" * 1000000)')\"
  }"

# 期待される結果: サイズ制限でブロック（413エラー）
# またはGemini APIエラー
```

## 🛡️ 推奨対策

### 短期
- [ ] 軽量なBase64バリデーションを実装
  ```javascript
  // ReDoS回避のため、サンプリングベースの検証を実施
  function isValidBase64Sample(str) {
      if (!str || typeof str !== 'string') return false;
      if (str.length === 0) return false;

      // 先頭・中央・末尾の各100文字をサンプリング
      const samples = [
          str.substring(0, 100),
          str.substring(Math.floor(str.length / 2) - 50, Math.floor(str.length / 2) + 50),
          str.substring(str.length - 100)
      ];

      const base64Regex = /^[A-Za-z0-9+/=]*$/;
      return samples.every(sample => base64Regex.test(sample));
  }

  if (!isValidBase64Sample(cleanedBase64Data)) {
      return res.status(400).json({ error: '無効なBase64形式です' });
  }
  ```

### 長期
- [ ] バリデーターライブラリの導入: `validator.js` などの信頼性の高いライブラリを使用
- [ ] Gemini APIへのリクエスト前のプリチェック: データ形式の事前検証
- [ ] モニタリングとアラート: 不正なリクエストの検出と通知
- [ ] レート制限の強化: IPアドレスベースやユーザーベースのレート制限

## 🔗 参考
- OWASP: https://owasp.org/www-community/vulnerabilities/Improper_Data_Validation
- CWE: https://cwe.mitre.org/data/definitions/20.html
- ReDoS: https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS

---
*Iteration 1 | 2025-11-24 00:47:00 JST*
