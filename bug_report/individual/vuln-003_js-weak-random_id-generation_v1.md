# 🟢 弱い乱数生成 - フォールバック時のID予測可能性

## メタデータ
```yaml
id: vuln-003
version: v1
iteration: 1
language: javascript
category: weak-random
cwe_id: CWE-330
cvss_score: 3.7
severity: Low
priority: P3
discovered: 2025-11-21 00:00
status: New
related_vulns: []
```

## 🎯 要約
古いブラウザ向けフォールバック処理で`Math.random()`を使用したID生成を行っており、IDが予測可能になる可能性があります。

## 📍 発生場所
- **ファイル**: `app.js`
- **行番号**: L26-29
- **関数**: `generateUniqueId()`
- **エンドポイント**: なし（クライアント側）

## 💣 詳細

### 問題コード
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

    // 最終フォールバック（古いブラウザ用）: タイムスタンプ + Math.random()
    const timestamp = Date.now().toString(36);
    const randomPart1 = Math.random().toString(36).substring(2, 11);
    const randomPart2 = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${randomPart1}-${randomPart2}`;
}
```

### 根本原因
- 最終フォールバックで`Math.random()`を使用
- `Math.random()`は暗号学的に安全ではなく、予測可能な乱数を生成
- タイムスタンプも予測可能
- 攻撃者が同時刻に生成されたIDを推測できる可能性

### 攻撃シナリオ
1. 攻撃者が古いブラウザ（IE10以下など）を使用してアプリケーションにアクセス
2. カードを作成し、生成されたIDを観察
3. `Math.random()`のシード値を推測し、次に生成されるIDを予測
4. 他のユーザーのカードIDを推測し、削除操作を試行（ただし、このアプリはローカルストレージのため影響は限定的）

**注意**: このアプリケーションではカードがlocalStorageに保存されており、他のユーザーのデータにはアクセスできないため、実際の影響は極めて低い。

### 影響範囲
- **機密性**: Low（IDの予測可能性）
- **完全性**: Low（予測したIDでの削除試行）
- **可用性**: None
- **影響ユーザー**: 古いブラウザを使用するユーザーのみ（IE10以下など、現在ほぼ存在しない）

## 🔗 関連脆弱性
- vuln-004: カードシャッフルでの`Math.random()`使用（別途報告）

## 🔬 検証手順 (PoC)

### 前提条件
- IE10以下または`crypto` APIが無効化されたブラウザ
- ブラウザの開発者ツールでJavaScript実行可能

### 再現ステップ
```javascript
// 1. crypto APIを無効化してフォールバックを強制
const originalCrypto = window.crypto;
window.crypto = undefined;

// 2. ID生成を複数回実行
const id1 = generateUniqueId();
const id2 = generateUniqueId();
console.log('ID 1:', id1);
console.log('ID 2:', id2);

// 3. タイムスタンプ部分が予測可能であることを確認
// パターン: {timestamp}-{random1}-{random2}

// 4. Math.random()のパターンを観察
// 注: 実際のシード推測には高度な統計解析が必要

// 5. crypto APIを復元
window.crypto = originalCrypto;
```

## 🛡️ 推奨対策

### 短期
- [ ] 古いブラウザのサポートを明示的に終了し、最終フォールバックを削除
- [ ] または、フォールバック時にユーザーに警告を表示：
  ```javascript
  // ❌ Before
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 11);
  const randomPart2 = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${randomPart1}-${randomPart2}`;

  // ✅ After (警告を追加)
  console.warn('警告: ブラウザが古いため、安全でないID生成方法を使用しています。ブラウザをアップデートしてください。');
  // または、エラーをスローして機能を無効化
  throw new Error('お使いのブラウザは対応していません。最新のブラウザをご利用ください。');
  ```

### 長期
- [ ] サポートブラウザを明示的に定義し、古いブラウザでは警告画面を表示
- [ ] `crypto.getRandomValues()`が利用できない環境では機能を制限
- [ ] ブラウザ互換性テーブルをドキュメント化
- [ ] 代替手段として、UUIDライブラリ（uuid.js）の導入を検討（ただし、バンドルサイズ増加のトレードオフ）

## 🔗 参考
- OWASP: https://owasp.org/www-community/vulnerabilities/Insecure_Randomness
- CWE: https://cwe.mitre.org/data/definitions/330.html
- MDN Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID

---
*Iteration 1 | 2025-11-21 00:00 JST*
