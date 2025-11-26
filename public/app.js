// データ操作関数
const STORAGE_KEY = 'MEMORY';
const MAX_IMPORT_TEXT_LENGTH = 100000; // インポートテキストの最大長
const WARNING_THRESHOLD = 4 * 1024 * 1024; // 4MB
const MAX_STORAGE_SIZE = 4.8 * 1024 * 1024; // 4.8MB

/**
 * 衝突のないユニークIDを生成
 * crypto.randomUUID()が利用可能な場合はそれを使用、
 * それ以外の場合は暗号学的に安全な乱数を使用
 * @returns {string} ユニークID
 */
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

    // 最終フォールバック: 安全でない乱数生成は使用しない
    // CWE-330: Math.random()は暗号学的に安全ではないため、フォールバックとして使用せずエラーとする
    throw new Error('このブラウザでは安全な乱数生成がサポートされていません。');
}

/**
 * 暗号学的に安全な0-1の乱数を生成
 * @returns {number} 0以上1未満の乱数
 * @throws {Error} crypto.getRandomValues()が利用できない場合
 */
function secureRandom() {
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
        throw new Error('このブラウザでは安全な乱数生成がサポートされていません。');
    }
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    return randomArray[0] / (0xFFFFFFFF + 1);
}

/**
 * 暗号学的に安全な整数乱数を生成
 * @param {number} max - 上限（含まない）
 * @returns {number} 0以上max未満の整数（切り捨て）
 * @throws {Error} crypto.getRandomValues()が利用できない場合
 */
function secureRandomInt(max) {
    return Math.floor(secureRandom() * max);
}

/**
 * デバウンス関数 - 連続した関数呼び出しを遅延させる
 * @param {Function} func - デバウンスする関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * localStorageエラーハンドリングヘルパー関数
 * @param {Error} e - エラーオブジェクト
 * @param {string} context - エラーコンテキスト
 * @throws {Error} ユーザー向けエラーメッセージ
 */
function handleStorageError(e, context) {
    console.error(`Failed to save ${context} to localStorage:`, e);
    if (e.name === 'QuotaExceededError') {
        throw new Error('ストレージの容量が不足しています。ブラウザのデータを整理してください。');
    } else if (e.name === 'SecurityError') {
        throw new Error('プライベートブラウジングモードでは保存できません。');
    } else {
        throw new Error(`${context}の保存に失敗しました: ` + e.message);
    }
}

/**
 * ローカルストレージから単語カードを読み込む
 * レガシーカード（ID未設定）を自動的に移行
 * @returns {Array} カード配列
 */
function loadCards() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    try {
        const parsed = JSON.parse(data);
        // 配列であることを確認
        if (!Array.isArray(parsed)) return [];

        // 移行が必要かどうかを追跡
        let needsMigration = false;
        const migratedCards = parsed
            // 1. Prototype Pollution/Invalid Data対策: null, undefined, 非オブジェクトを除外
            .filter(card => card && typeof card === 'object')
            .map(card => {
                // 2. Prototype Pollution対策: 安全なオブジェクトを作成
                // 信頼できないソースからのオブジェクトは、プロパティを明示的に検証・コピーする
                const safeCard = {
                    question: typeof card.question === 'string' ? card.question : '',
                    answer: typeof card.answer === 'string' ? card.answer : '',
                    category: typeof card.category === 'string' ? card.category : '未分類',
                    id: typeof card.id === 'string' ? card.id : null // IDは文字列のみ許容
                };

                // 3. レガシーカード（IDがない）を移行
                if (!safeCard.id) {
                    needsMigration = true;
                    safeCard.id = generateUniqueId();
                }
                return safeCard;
            });

        // 移行が必要な場合は保存
        if (needsMigration) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedCards));
                console.log('レガシーカードを移行しました:', migratedCards.length);
            } catch (e) {
                console.error('カードの移行中にエラーが発生しました:', e);
                // 移行失敗してもデータは返す
            }
        }

        return migratedCards;
    } catch (e) {
        console.error('Failed to parse cards from localStorage:', e);
        // データが破損している場合は空配列を返す
        return [];
    }
}



// ローカルストレージに単語カードを保存
function saveCards(cards) {
    const dataStr = JSON.stringify(cards);
    // JSの文字列はUTF-16エンコードであり、文字ごとに1-2バイトを使用する。
    // 安全マージンを考慮し、1文字あたり2バイトとしてサイズを概算する。
    // これによりASCII文字が多い場合に過大評価されるが、DoS攻撃防止の目的では許容される。
    // 将来的には `new Blob([dataStr]).size` を使用するとより正確なサイズが得られる。
    const estimatedSize = dataStr.length * 2;

    // 致命的なエラー: データが大きすぎて保存操作を試行しない
    if (estimatedSize > MAX_STORAGE_SIZE) {
        const message = `合計データサイズが上限に近づいています (${(estimatedSize / 1024 / 1024).toFixed(2)}MB)。` +
                        '新しいカードを追加する前に、いくつかカードを削除してください。';
        throw new Error(message);
    }

    // 警告: ユーザーに将来の問題を通知
    if (estimatedSize > WARNING_THRESHOLD) {
        console.warn('カードデータのサイズが大きくなっています:', (estimatedSize / 1024 / 1024).toFixed(2) + 'MB');
    }

    try {
        localStorage.setItem(STORAGE_KEY, dataStr);
    } catch (e) {
        handleStorageError(e, 'カードデータ');
    }
}

/**
 * 新規カードを作成
 * @param {string} category - カテゴリ名
 * @param {string} question - 問題文
 * @param {string} answer - 解答
 */
function createCard(category, question, answer) {
    const card = {
        id: generateUniqueId(),
        category,
        question,
        answer
    };
    const cards = loadCards();
    cards.push(card);
    try {
        saveCards(cards);
    } catch (error) {
        console.error('カードの作成に失敗しました:', error);
        // UI層で処理できるようエラーを再スロー
        throw error;
    }
}

/**
 * カードをIDで削除（インデックスベースの削除はレガシーサポート）
 * @param {string|number} idOrIndex - カードIDまたはインデックス
 * @throws {Error} ストレージへの保存に失敗した場合
 */
function deleteCard(idOrIndex) {
    const cards = loadCards();

    // 数値の場合はインデックスとして扱う（レガシーサポート）
    if (typeof idOrIndex === 'number') {
        cards.splice(idOrIndex, 1);
    } else {
        // IDで削除
        const index = cards.findIndex(c => c.id === idOrIndex);
        if (index !== -1) {
            cards.splice(index, 1);
        }
    }

    try {
        saveCards(cards);
    } catch (error) {
        console.error('カードの削除に失敗しました:', error);
        throw error;
    }
}

// カード配列をシャッフル（Fisher-Yatesアルゴリズム + 暗号学的に安全な乱数）
function shuffleCards(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// カテゴリ一覧を取得
function getCategories() {
    const cards = loadCards();
    return [...new Set(cards.map(card => card.category))].sort();
}

/**
 * HTMLエスケープ関数（XSS対策）
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたHTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * HTML属性用エスケープ関数（XSS対策）
 * @param {string} text - エスケープするテキスト
 * @returns {string} 属性用にエスケープされたテキスト
 */
function escapeHtmlAttr(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    // HTMLエンティティ化した上で、引用符も追加エスケープ
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 入力サニタイゼーション関数
 * ASCII制御文字（C0, C1）およびUnicode行区切り文字を除去
 * @param {string} text - サニタイズするテキスト
 * @param {number} maxLength - 最大文字数（デフォルト: 1000）
 * @returns {string} サニタイズされたテキスト
 */
function sanitizeInput(text, maxLength = 1000) {
    if (!text) return '';
    // 制御文字を除去し、最大長を制限
    // \x00-\x08, \x0B, \x0C, \x0E-\x1F: C0制御文字（改行・タブを除く）
    // \x7F: DEL文字
    // \x80-\x9F: C1制御文字（Unicode 128-159）
    // \u2028: Line Separator
    // \u2029: Paragraph Separator
    // 改行(\n, \r)とタブ(\t)は許可する
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u2028\u2029]/g, '')
        .trim()
        .substring(0, maxLength);
}

/**
 * 上付き・下付き文字を変換（XSS対策のため先にエスケープ）
 * ReDoS攻撃を防ぐため、最大長を制限
 * @param {string} text - 変換するテキスト
 * @returns {string} 変換されたHTML
 */
function parseSubscriptSuperscript(text) {
    // まずHTMLエスケープしてXSS攻撃を防ぐ
    text = escapeHtml(text);

    // 波括弧付き上付き文字: ^{text} (最大100文字に制限してReDoS防止)
    text = text.replace(/\^\{([^}]{1,100})\}/g, '<span class="superscript">$1</span>');
    // 単一文字上付き文字: ^x
    text = text.replace(/\^(.)/g, '<span class="superscript">$1</span>');

    // 波括弧付き下付き文字: _{text} (最大100文字に制限してReDoS防止)
    text = text.replace(/\_\{([^}]{1,100})\}/g, '<span class="subscript">$1</span>');
    // 単一文字下付き文字: _x
    text = text.replace(/\_(.)/g, '<span class="subscript">$1</span>');

    return text;
}

// ビュー管理
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}

// ホーム画面の初期化
function initHomeView() {
    showView('home-view');
}

// ホーム画面: 学習開始ボタン
if (typeof document !== 'undefined') {
    const startQuizBtn = document.getElementById('start-quiz-btn');
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', () => {
            const cards = loadCards();
            if (cards.length === 0) {
                alert('まずは単語を登録してください');
            } else {
                try {
                    startQuiz();
                } catch (error) {
                    console.error('学習の開始に失敗しました:', error);
                    alert('エラーが発生しました: ' + error.message);
                }
            }
        });
    }

    // ホーム画面: 一覧表示ボタン
    const showListBtn = document.getElementById('show-list-btn');
    if (showListBtn) {
        showListBtn.addEventListener('click', () => {
            renderListView();
        });
    }
}



// 単語カード追加画面の初期化
function initAddView() {
    showView('add-view');
    // 入力欄をクリア
    document.getElementById('category-input').value = '';
    document.getElementById('question-input').value = '';
    document.getElementById('answer-input').value = '';
}

if (typeof document !== 'undefined') {
    // 追加画面: キャンセルボタン
    const cancelAddBtn = document.getElementById('cancel-add-btn');
    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', () => {
            renderListView();
        });
    }

    // 追加画面: 保存ボタン
    const saveCardBtn = document.getElementById('save-card-btn');
    if (saveCardBtn) {
        saveCardBtn.addEventListener('click', () => {
            const category = sanitizeInput(document.getElementById('category-input').value.trim());
            const question = sanitizeInput(document.getElementById('question-input').value.trim());
            const answer = sanitizeInput(document.getElementById('answer-input').value.trim());

            if (!question || !answer) {
                alert('問題と解答を入力してください');
                return;
            }

            // カテゴリが空の場合はデフォルト値を設定
            const finalCategory = category || '未分類';

            try {
                createCard(finalCategory, question, answer);
                alert('保存しました');

                // 入力欄をクリア
                document.getElementById('category-input').value = '';
                document.getElementById('question-input').value = '';
                document.getElementById('answer-input').value = '';

                // フォーカスをカテゴリ入力欄に戻す
                document.getElementById('category-input').focus();
            } catch (error) {
                alert('保存に失敗しました: ' + error.message);
            }
        });
    }
}

// 単語カード一覧画面の表示
function renderListView() {
    showView('list-view');
    const cards = loadCards();
    const cardListElement = document.getElementById('card-list');
    cardListElement.innerHTML = '';

    if (cards.length === 0) {
        cardListElement.innerHTML = '<div class="empty-message">まだ単語カードが登録されていません。<br>「追加」ボタンから登録してください。</div>';
        return;
    }

    // カテゴリ別にグループ化
    const categories = getCategories();

    categories.forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.textContent = category;
        categorySection.appendChild(categoryHeader);

        // このカテゴリのカードを取得
        cards.forEach((card, index) => {
            if (card.category === category) {
                const cardItem = document.createElement('div');
                cardItem.className = 'card-item';

                const cardContent = document.createElement('div');
                cardContent.className = 'card-content';

                const cardQuestion = document.createElement('div');
                cardQuestion.className = 'card-question';
                cardQuestion.innerHTML = parseSubscriptSuperscript(card.question);

                const cardAnswer = document.createElement('div');
                cardAnswer.className = 'card-answer';
                cardAnswer.innerHTML = parseSubscriptSuperscript(card.answer);

                cardContent.appendChild(cardQuestion);
                cardContent.appendChild(cardAnswer);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '削除';
                deleteBtn.addEventListener('click', () => {
                    if (confirm('この単語カードを削除しますか?')) {
                        try {
                            // IDベースで削除（移行により全カードにIDが設定済み）
                            deleteCard(card.id);
                            renderListView();
                        } catch (error) {
                            alert('削除に失敗しました: ' + error.message);
                        }
                    }
                });

                cardItem.appendChild(cardContent);
                cardItem.appendChild(deleteBtn);
                categorySection.appendChild(cardItem);
            }
        });

        cardListElement.appendChild(categorySection);
    });
}

if (typeof document !== 'undefined') {
    // 一覧画面: 戻るボタン
    const backFromListBtn = document.getElementById('back-from-list-btn');
    if (backFromListBtn) {
        backFromListBtn.addEventListener('click', () => {
            initHomeView();
        });
    }

    // 一覧画面: 追加ボタン
    const addFromListBtn = document.getElementById('add-from-list-btn');
    if (addFromListBtn) {
        addFromListBtn.addEventListener('click', () => {
            initAddView();
        });
    }

    // 一覧画面: インポートボタン
    const importFromListBtn = document.getElementById('import-from-list-btn');
    if (importFromListBtn) {
        importFromListBtn.addEventListener('click', () => {
            initImportView();
        });
    }
}

// 学習画面の変数
let quizWordArray = [];
let currentIndex = 0;
let isAnswerShown = false;

// 学習モードを開始
function startQuiz() {
    const cards = loadCards();
    quizWordArray = shuffleCards(cards);
    currentIndex = 0;
    isAnswerShown = false;
    showView('quiz-view');
    displayCurrentCard();
}

// 現在のカードを表示
function displayCurrentCard() {
    if (currentIndex >= quizWordArray.length) {
        showCompletionView();
        return;
    }

    const currentCard = quizWordArray[currentIndex];

    // カテゴリを表示
    document.getElementById('quiz-category').textContent = currentCard.category;

    // 問題を表示
    document.getElementById('question-text').innerHTML = parseSubscriptSuperscript(currentCard.question);

    // 解答エリアを非表示にする
    document.getElementById('answer-area').classList.add('hidden');
    document.getElementById('answer-text').innerHTML = '';

    // ボタンのテキストを「答えを表示」に設定
    document.getElementById('quiz-action-btn').textContent = '答えを表示';
    isAnswerShown = false;
}

if (typeof document !== 'undefined') {
    // 学習画面: アクションボタン
    const quizActionBtn = document.getElementById('quiz-action-btn');
    if (quizActionBtn) {
        quizActionBtn.addEventListener('click', () => {
            if (!isAnswerShown) {
                // 解答を表示
                const currentCard = quizWordArray[currentIndex];
                document.getElementById('answer-text').innerHTML = parseSubscriptSuperscript(currentCard.answer);
                document.getElementById('answer-area').classList.remove('hidden');
                document.getElementById('quiz-action-btn').textContent = '次へ';
                isAnswerShown = true;
            } else {
                // 次の問題へ
                currentIndex++;
                displayCurrentCard();
            }
        });
    }

    // 学習画面: 終了ボタン
    const quitQuizBtn = document.getElementById('quit-quiz-btn');
    if (quitQuizBtn) {
        quitQuizBtn.addEventListener('click', () => {
            if (confirm('学習を終了してホームに戻りますか?')) {
                initHomeView();
            }
        });
    }
}

// 完了画面を表示
function showCompletionView() {
    showView('completion-view');
}

// 完了画面: ホームに戻るボタン
if (typeof document !== 'undefined') {
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', () => {
            initHomeView();
        });
    }
}



// 画像インポート機能
let selectedImage = null;
let extractedCards = [];
let isProcessingOCR = false; // OCR処理中フラグ

// インポートステータス更新のヘルパー関数
function updateImportStatus(message) {
    const statusDiv = document.getElementById('import-status');
    if (statusDiv) {
        statusDiv.textContent = message;
    }
}

/**
 * 赤字検出の閾値設定
 *
 * これらの値は以下の原理に基づいて決定されています：
 * - RGB色空間で赤色は R値が高く、G・B値が低い特徴を持つ
 * - 教科書や参考書の赤字マーカーを想定し、実際の画像テストに基づいて調整
 *
 * darkRed (濃い赤の判定):
 *   - R > 150: 赤成分が十分に強い（255段階の約60%）
 *   - G < 100, B < 100: 緑と青の成分が抑えられている
 *   - 用途: ボールペンやマーカーで書かれた濃い赤字
 *
 * lightRed (薄い赤・ピンクの判定):
 *   - R > 180: 赤成分がさらに強い（約70%以上）
 *   - R > G×1.5, R > B×1.5: 相対的に赤が他の色より1.5倍強い
 *   - 用途: 蛍光ペンや薄めの赤字、背景が白に近い場合の赤文字
 *   - 比率ベース判定により、明るさの影響を軽減
 */
const RED_DETECTION_THRESHOLD = {
    darkRed: { r: 150, g: 100, b: 100 },
    lightRed: { r: 180, ratio: 1.5 }
};

// Gemini API設定
const GEMINI_API_CONFIG = {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    maxImageSize: 1024, // 最大画像サイズ（幅・高さ）
    prompt: '画像から日本語と英語のテキストを抽出してください。単語の対訳形式のリストがあれば、そのまま出力してください。記号や矢印（→、:、-など）が含まれている場合はそのまま保持してください。'
};

// インポート画面の初期化
function initImportView() {
    showView('import-view');
    // メモリリーク防止のため既存の画像をクリア
    if (selectedImage) {
        selectedImage.onload = null; // イベントハンドラをクリア
        selectedImage.onerror = null;
        selectedImage.src = '';
        selectedImage = null;
    }
    extractedCards = [];
    isProcessingOCR = false; // 処理フラグもリセット
    document.getElementById('import-category-input').value = '英単語';
    document.getElementById('image-input').value = '';
    document.getElementById('preview-canvas').classList.add('hidden');
    document.getElementById('process-image-btn').disabled = true;
    updateImportStatus('');
    document.getElementById('import-preview').innerHTML = '';
}

if (typeof document !== 'undefined') {
    // インポート画面: キャンセルボタン
    const cancelImportBtn = document.getElementById('cancel-import-btn');
    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', () => {
            renderListView();
        });
    }

    // インポート画面: 画像選択
    const imageInput = document.getElementById('image-input');
    if (imageInput) {
        imageInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    selectedImage = img;
                    displayImagePreview(img);
                    document.getElementById('process-image-btn').disabled = false;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
}

// 画像プレビューを表示
function displayImagePreview(img) {
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');

    // キャンバスサイズを画像に合わせる（最大幅500px）
    const maxWidth = 500;
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.classList.remove('hidden');
}

// 画像をリサイズする関数
function resizeCanvas(sourceCanvas, maxSize) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    // 既に小さい場合はそのまま返す
    if (width <= maxSize && height <= maxSize) {
        return sourceCanvas;
    }

    // アスペクト比を維持してリサイズ
    const scale = Math.min(maxSize / width, maxSize / height);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;

    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

    return resizedCanvas;
}

// 赤字を抽出してインポート
if (typeof document !== 'undefined') {
    const processImageBtn = document.getElementById('process-image-btn');
    if (processImageBtn) {
        processImageBtn.addEventListener('click', async () => {
            if (!selectedImage) return;

            const processBtn = document.getElementById('process-image-btn');
            const previewDiv = document.getElementById('import-preview');

            // レース条件防止: フラグチェックとボタン無効化をアトミックに実行
            // ボタンが既に無効化されている場合は処理中と判断
            if (processBtn.disabled || isProcessingOCR) return;

            // フラグとボタンを即座に設定（これより先は1つの実行のみ）
            isProcessingOCR = true;
            processBtn.disabled = true;

            updateImportStatus('画像を処理中...');
            previewDiv.innerHTML = '';

            let redTextCanvas = null;
            let resizedCanvas = null;

            try {
                // 赤字部分を抽出（クライアントサイド処理はスキップし、Geminiに任せる）
                // updateImportStatus('赤字を検出中...');
                // redTextCanvas = extractRedText(selectedImage);

                // 画像をリサイズ（オリジナル画像をリサイズ）
                const originalCanvas = document.createElement('canvas');
                originalCanvas.width = selectedImage.width;
                originalCanvas.height = selectedImage.height;
                originalCanvas.getContext('2d').drawImage(selectedImage, 0, 0);

                resizedCanvas = resizeCanvas(originalCanvas, GEMINI_API_CONFIG.maxImageSize);

                // OCRで文字認識（JSON配列として取得）
                updateImportStatus('OCRで文字を認識中... (しばらくお待ちください)');
                const cardsData = await performOCR(resizedCanvas);

                // カテゴリを追加してカードを作成
                updateImportStatus('カードを作成中...');
                const categoryRaw = document.getElementById('import-category-input').value.trim() || '英単語';
                const category = sanitizeInput(categoryRaw);

                extractedCards = cardsData.map(card => ({
                    id: generateUniqueId(),
                    category: category,
                    question: sanitizeInput(card.question || ''),
                    answer: sanitizeInput(card.answer || '')
                }));

                if (!extractedCards || extractedCards.length === 0) {
                    updateImportStatus('赤字のテキストが見つかりませんでした。別の画像を試してください。');
                    return;
                }

                // カードデータの妥当性チェック
                const validCards = extractedCards.filter(card =>
                    card && card.question && card.answer && card.category
                );

                if (validCards.length === 0) {
                    updateImportStatus('有効なカードデータが見つかりませんでした。別の画像を試してください。');
                    extractedCards = [];
                    return;
                }

                extractedCards = validCards;

                // プレビューを表示
                displayImportPreview(extractedCards);
                updateImportStatus(`${extractedCards.length}件のカードを検出しました。確認して保存してください。`);

                // 保存ボタンを表示
                const saveBtn = document.createElement('button');
                saveBtn.className = 'primary-button save-all-btn';
                saveBtn.textContent = 'すべて保存';
                saveBtn.addEventListener('click', () => {
                    saveExtractedCards();
                });
                previewDiv.appendChild(saveBtn);

            } catch (error) {
                console.error('処理エラー:', error);
                updateImportStatus('エラーが発生しました: ' + error.message);
                // エラー時のクリーンアップ
                previewDiv.innerHTML = '';
                extractedCards = [];
            } finally {
                // メモリリーク防止: Canvasをクリーンアップ
                cleanupCanvas(redTextCanvas);
                cleanupCanvas(resizedCanvas);

                isProcessingOCR = false;
                processBtn.disabled = false; // ボタンを再度有効化
            }
        });
    }
}

// Canvasクリーンアップヘルパー関数
function cleanupCanvas(canvas) {
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * 赤字部分を抽出
 * 画像から赤色のテキストのみを抽出し、OCR用のキャンバスを生成
 * @param {HTMLImageElement} img - ソース画像
 * @returns {HTMLCanvasElement} 赤字のみを含むキャンバス
 */
function extractRedText(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 赤い部分を白に、それ以外を黒に変換（反転マスク）
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 赤字判定: R値が高く、G・B値が低い
        // 濃い赤: RGB値の絶対的な閾値判定
        // 薄い赤: R値が他の色成分より相対的に高いかを判定
        const isDarkRed = r > RED_DETECTION_THRESHOLD.darkRed.r &&
            g < RED_DETECTION_THRESHOLD.darkRed.g &&
            b < RED_DETECTION_THRESHOLD.darkRed.b;
        const isLightRed = r > RED_DETECTION_THRESHOLD.lightRed.r &&
            r > g * RED_DETECTION_THRESHOLD.lightRed.ratio &&
            r > b * RED_DETECTION_THRESHOLD.lightRed.ratio;
        const isRed = isDarkRed || isLightRed;

        if (isRed) {
            // 赤字部分を黒に（OCR用）
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
        } else {
            // それ以外を白に
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * OCRで文字認識（Gemini Vision API使用）
 * @param {HTMLCanvasElement} canvas - OCR対象のキャンバス
 * @returns {Promise<string>} 抽出されたテキスト
 * @throws {Error} APIキー未設定、ネットワークエラー、APIエラー
 */
async function performOCR(canvas) {
    // キャンバスをbase64エンコード
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    // バックエンドAPIにリクエスト
    updateImportStatus('画像を解析中...');

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
}

/**
 * テキストを解析してカード配列を作成
 * @param {string} text - 解析するテキスト
 * @returns {Array} カード配列
 */
function parseTextToCards(text) {
    // 入力をサニタイズ（テキスト全体を一度だけ）
    const categoryRaw = document.getElementById('import-category-input').value.trim() || '英単語';
    const category = sanitizeInput(categoryRaw);
    const sanitizedText = sanitizeInput(text, MAX_IMPORT_TEXT_LENGTH);
    const cards = [];
    const lines = sanitizedText.split('\n')
        .map(line => line.trim()) // トリムのみ（既にサニタイズ済み）
        .filter(line => line.length > 0);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // パターン1: 矢印や記号で区切られている場合（→ : - など）
        const separators = /[→:：\-－]/;
        if (separators.test(line)) {
            const parts = line.split(separators)
                .map(p => p.trim()) // トリムのみ
                .filter(p => p.length > 0);
            if (parts.length >= 2) {
                cards.push({
                    id: generateUniqueId(),
                    category: category,
                    question: parts[0],
                    answer: parts.slice(1).join(' ')
                });
                continue;
            }
        }

        // パターン2: スペース、タブで区切られた「問題 答え」形式
        const parts = line.split(/[\s\t]+/)
            .map(p => p.trim()) // トリムのみ
            .filter(p => p.length > 0);
        if (parts.length >= 2) {
            cards.push({
                id: generateUniqueId(),
                category: category,
                question: parts[0],
                answer: parts.slice(1).join(' ')
            });
        } else if (parts.length === 1 && i + 1 < lines.length) {
            // パターン3: 単一の単語の場合、次の行と組み合わせる
            const nextLine = lines[i + 1];
            const nextParts = nextLine.split(/[\s\t]+/)
                .map(p => p.trim()) // トリムのみ
                .filter(p => p.length > 0);
            if (nextParts.length === 1) {
                cards.push({
                    id: generateUniqueId(),
                    category: category,
                    question: parts[0],
                    answer: nextParts[0]
                });
                i++; // 次の行をスキップ
            }
        }
    }

    return cards;
}

/**
 * インポートプレビューを表示（編集機能付き）
 * DOM APIを使用してXSS脆弱性を防止
 * @param {Array} cards - プレビューするカード配列
 */
function displayImportPreview(cards) {
    const previewDiv = document.getElementById('import-preview');
    // 既存の内容をクリア
    previewDiv.innerHTML = '';

    // ヘッダーを作成
    const header = document.createElement('h3');
    header.textContent = '検出されたカード（編集可能）:';
    header.className = 'preview-section-title';
    previewDiv.appendChild(header);

    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'preview-card';

        // 問題セクション
        const questionDiv = document.createElement('div');
        questionDiv.className = 'preview-field-group';

        const questionLabel = document.createElement('label');
        questionLabel.textContent = '問題:';
        questionLabel.className = 'preview-label';

        const questionInput = document.createElement('input');
        questionInput.type = 'text';
        questionInput.className = 'preview-input';
        questionInput.dataset.index = index;
        questionInput.dataset.field = 'question';
        questionInput.value = card.question; // DOM API により自動的にエスケープ

        questionDiv.appendChild(questionLabel);
        questionDiv.appendChild(questionInput);

        // 答えセクション
        const answerDiv = document.createElement('div');
        answerDiv.className = 'preview-field-group';

        const answerLabel = document.createElement('label');
        answerLabel.textContent = '答え:';
        answerLabel.className = 'preview-label';

        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.className = 'preview-input';
        answerInput.dataset.index = index;
        answerInput.dataset.field = 'answer';
        answerInput.value = card.answer; // DOM API により自動的にエスケープ

        answerDiv.appendChild(answerLabel);
        answerDiv.appendChild(answerInput);

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-preview-btn';
        deleteBtn.dataset.index = index;
        deleteBtn.textContent = '削除';

        cardDiv.appendChild(questionDiv);
        cardDiv.appendChild(answerDiv);
        cardDiv.appendChild(deleteBtn);
        previewDiv.appendChild(cardDiv);
    });

    // 編集イベントリスナー（デバウンス適用で性能向上）
    document.querySelectorAll('.preview-input').forEach(input => {
        input.addEventListener('input', debounce((e) => {
            const index = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            // ユーザー入力をサニタイズ
            extractedCards[index][field] = sanitizeInput(e.target.value);
        }, 300));
    });

    // 削除イベントリスナー
    document.querySelectorAll('.delete-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (confirm('このカードを削除しますか？')) {
                extractedCards.splice(index, 1);
                displayImportPreview(extractedCards);

                // カウントを更新
                if (extractedCards.length === 0) {
                    updateImportStatus('すべてのカードが削除されました。');
                } else {
                    updateImportStatus(`${extractedCards.length}件のカードを検出しました。確認して保存してください。`);
                }
            }
        });
    });
}

// 抽出したカードを保存
function saveExtractedCards() {
    try {
        const cards = loadCards();
        extractedCards.forEach(card => {
            cards.push(card);
        });
        saveCards(cards);

        alert(`${extractedCards.length}件のカードをインポートしました`);
        renderListView();
    } catch (error) {
        alert('カードの保存に失敗しました: ' + error.message);
    }
}

// アプリケーションの初期化
// Node.js環境（テスト時）での実行エラーを防ぐため、documentオブジェクトの存在チェックを行う
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initHomeView();
    });
}

// For Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseTextToCards,
        loadCards,
        saveCards,
        createCard,
        generateUniqueId,
        deleteCard,
        escapeHtml,
        escapeHtmlAttr,
        sanitizeInput,
        parseSubscriptSuperscript,
        debounce,
        performOCR,
        shuffleCards,
        secureRandom,
        secureRandomInt
    };
}
