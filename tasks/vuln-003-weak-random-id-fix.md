# 🟢 VULN-003: 弱い乱数生成 - ID生成の改善

## 概要
古いブラウザ向けフォールバック処理で`Math.random()`を使用したID生成を行っており、IDが予測可能になる可能性があります。

## 脆弱性情報
- **ID**: vuln-003
- **カテゴリ**: Weak Random (CWE-330)
- **重大度**: 🟢 Low (CVSS: 3.7)
- **優先度**: P3（1ヶ月以内）
- **影響ファイル**: `app.js:26-29`

## 実装タスク

### タスク1: 最終フォールバックの削除または警告追加
- [ ] `app.js`の`generateUniqueId()`関数を修正
- [ ] 以下のいずれかの対応を選択
  - **オプションA**: 最終フォールバックを削除し、古いブラウザではエラーをスロー
  - **オプションB**: 最終フォールバック時に警告を表示

### タスク2: サポートブラウザの明確化
- [ ] README.mdにサポートブラウザを明記
- [ ] `crypto.getRandomValues()`をサポートするブラウザのみ対応とする
- [ ] 必要に応じて、起動時にブラウザ互換性チェックを追加

### タスク3: テスト
- [ ] モダンブラウザでID生成が正常に動作することを確認
- [ ] `crypto`オブジェクトを無効化してフォールバック動作をテスト
- [ ] フォールバック時のエラーまたは警告が表示されることを確認

## 修正コード例

### オプションA: エラーをスローする（推奨）
```javascript
// ❌ Before (app.js:26-29)
// 最終フォールバック（古いブラウザ用）: タイムスタンプ + Math.random()
const timestamp = Date.now().toString(36);
const randomPart1 = Math.random().toString(36).substring(2, 11);
const randomPart2 = Math.random().toString(36).substring(2, 11);
return `${timestamp}-${randomPart1}-${randomPart2}`;

// ✅ After
// 古いブラウザではサポートしない
throw new Error('お使いのブラウザは対応していません。最新のブラウザをご利用ください。');
```

### オプションB: 警告を表示する
```javascript
// ✅ After (警告を表示)
console.warn('警告: ブラウザが古いため、安全でないID生成方法を使用しています。ブラウザをアップデートしてください。');
const timestamp = Date.now().toString(36);
const randomPart1 = Math.random().toString(36).substring(2, 11);
const randomPart2 = Math.random().toString(36).substring(2, 11);
return `${timestamp}-${randomPart1}-${randomPart2}`;
```

## 成功基準
- [ ] モダンブラウザ（Chrome、Firefox、Safari、Edge最新版）でID生成が正常に動作
- [ ] 古いブラウザでは適切なエラーまたは警告が表示される
- [ ] サポートブラウザがドキュメント化されている

## 参考資料
- [OWASP Insecure Randomness](https://owasp.org/www-community/vulnerabilities/Insecure_Randomness)
- [CWE-330](https://cwe.mitre.org/data/definitions/330.html)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)

## 関連ファイル
- `app.js`
- `README.md`

## 関連脆弱性
- vuln-004: カードシャッフルでの弱い乱数生成
