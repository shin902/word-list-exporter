/**
 * @jest-environment jsdom
 */

// setup.js経由でグローバルスコープに関数をロード
require('../setup');

describe('saveCards with storage quota checks', () => {
    let setItemSpy;
    let consoleWarnSpy;

    // 各テストの前にモックを設定
    beforeEach(() => {
        // localStorage.setItem をスパイし、実際の呼び出しを無効化
        setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
        // console.warn をスパイし、コンソール出力をキャプチャ
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    // 各テストの後にモックをクリーンアップ
    afterEach(() => {
        jest.restoreAllMocks();
    });

    // テストケース1: データサイズが閾値以下の場合
    test('should save data normally when size is below the warning threshold', () => {
        const cards = [{ id: '1', question: 'What is Jest?', answer: 'A testing framework.' }];
        saveCards(cards);

        // setItemが1回呼び出されることを期待
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        // console.warnが呼び出されないことを期待
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    // テストケース2: データサイズが警告閾値と最大閾値の間の場合
    test('should show a warning when data size is above the warning threshold but below max', () => {
        // 4MB < size < 4.8MB となるような大きな文字列を生成
        // JSON.stringify後の文字数が 2 * 1024 * 1024 を超えるようにする
        const largeString = 'a'.repeat(2.2 * 1024 * 1024); // 約4.4MBのデータに相当
        const cards = [{ id: '1', question: largeString, answer: 'a' }];
        saveCards(cards);

        // setItemが1回呼び出されることを期待
        expect(setItemSpy).toHaveBeenCalledTimes(1);
        // console.warnが1回呼び出されることを期待
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        // 警告メッセージが正しい形式であることを確認
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('カードデータのサイズが大きくなっています:'),
            expect.stringContaining('MB')
        );
    });

    // テストケース3: データサイズが最大閾値を超えた場合
    test('should throw an error when data size exceeds the maximum threshold', () => {
        // 4.8MBを超えるような非常に大きな文字列を生成
        // JSON.stringify後の文字数が 2.4 * 1024 * 1024 を超えるようにする
        const veryLargeString = 'a'.repeat(2.5 * 1024 * 1024); // 約5.0MBのデータに相当
        const cards = [{ id: '1', question: veryLargeString, answer: 'a' }];

        // saveCardsを呼び出すとエラーがスローされることを期待
        // 新しいユーザーフレンドリーなエラーメッセージの一部を検証
        expect(() => saveCards(cards)).toThrow(/合計データサイズが上限に近づいています/);

        // エラーがスローされたため、setItemは呼び出されないことを期待
        expect(setItemSpy).not.toHaveBeenCalled();
        // エラーが優先されるため、警告も表示されないことを期待
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
});
