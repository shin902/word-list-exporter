// データ操作関数
const STORAGE_KEY = 'MEMORY';
const API_KEY_STORAGE_KEY = 'GEMINI_API_KEY';
const MAX_IMPORT_TEXT_LENGTH = 100000; // インポートテキストの最大長

// 入力制限の定数
const INPUT_LIMITS = {
    CATEGORY: 50,                       // カテゴリ名の最大文字数
    QUESTION: 50,                       // 問題文の最大文字数
    ANSWER: 50,                         // 解答の最大文字数
    API_KEY: 100,                       // APIキーの最大文字数
    MAX_CARDS: 10000,                   // カード総数の上限
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,   // 画像ファイルサイズ上限（10MB）
    FETCH_TIMEOUT: 30000                // API呼び出しタイムアウト（30秒）
};

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

    // 最終フォールバック（古いブラウザ用）: タイムスタンプ + Math.random()
    const timestamp = Date.now().toString(36);
    const randomPart1 = Math.random().toString(36).substring(2, 11);
    const randomPart2 = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${randomPart1}-${randomPart2}`;
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

// ========== API Key暗号化関数 ==========

/**
 * パスワードから暗号化キーを生成
 * ブラウザ環境から一意な値を生成してキーマテリアルとする
 * @param {Uint8Array} salt - ソルト値
 * @returns {Promise<CryptoKey>} 暗号化キー
 */
async function deriveKey(salt) {
    // ブラウザフィンガープリント的な値を使用（簡易版）
    const baseString = navigator.userAgent + navigator.language + Array.from(salt).join('');
    const encoder = new TextEncoder();
    const data = encoder.encode(baseString);

    // SHA-256でハッシュ化
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // AES-GCMキーとしてインポート
    return await crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * API Keyを暗号化
 * @param {string} apiKey - 暗号化するAPIキー
 * @returns {Promise<string>} Base64エンコードされた暗号化データ
 */
async function encryptApiKey(apiKey) {
    try {
        // ランダムなsaltとIV（初期化ベクトル）を生成
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // 暗号化キーを生成
        const key = await deriveKey(salt);

        // API Keyを暗号化
        const encoder = new TextEncoder();
        const data = encoder.encode(apiKey);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        // salt + iv + 暗号化データを結合
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        // Base64エンコードして保存
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('暗号化エラー:', error);
        throw new Error('API Keyの暗号化に失敗しました');
    }
}

/**
 * API Keyを復号化
 * @param {string} encryptedData - Base64エンコードされた暗号化データ
 * @returns {Promise<string>} 復号化されたAPIキー
 */
async function decryptApiKey(encryptedData) {
    try {
        // Base64デコード
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

        // salt, iv, 暗号化データを分離
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);

        // 暗号化キーを生成（保存時と同じキー）
        const key = await deriveKey(salt);

        // 復号化
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );

        // 文字列に変換
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error('復号化エラー:', error);
        throw new Error('API Keyの復号化に失敗しました');
    }
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

        // レガシーカード（IDがない）を移行
        let needsMigration = false;
        const migratedCards = parsed.map(card => {
            if (!card.id) {
                needsMigration = true;
                return {
                    ...card,
                    id: generateUniqueId()
                };
            }
            return card;
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

// Gemini API Keyの保存（暗号化して保存）
async function saveApiKey(apiKey) {
    try {
        const encrypted = await encryptApiKey(apiKey);
        localStorage.setItem(API_KEY_STORAGE_KEY, encrypted);
        return true;
    } catch (e) {
        handleStorageError(e, 'API Key');
    }
}

// Gemini API Keyの読み込み（復号化して返す）
async function loadApiKey() {
    try {
        const encrypted = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (!encrypted) return '';
        return await decryptApiKey(encrypted);
    } catch (error) {
        console.error('API Key読み込みエラー:', error);
        // 復号化に失敗した場合は古いデータとして削除
        clearApiKey();
        return '';
    }
}

// Gemini API Keyの削除
function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}

/**
 * Gemini API Keyのバリデーション
 * @param {string} apiKey - 検証するAPIキー
 * @returns {boolean} 有効な場合true
 */
function validateApiKey(apiKey) {
    if (!apiKey) return false;

    // APIキーは英数字、ハイフン、アンダースコアのみ許可
    const validFormat = /^[A-Za-z0-9_-]{20,}$/;
    if (!validFormat.test(apiKey)) return false;

    // 最低限の長さチェック（20文字以上）
    if (apiKey.length < 20) return false;

    // Gemini API keyの既知の形式: "AIza"で始まる39文字
    if (apiKey.startsWith('AIza')) {
        return apiKey.length === 39; // 厳密に39文字
    }

    // 将来の形式変更に対応: 20-100文字
    return apiKey.length >= 20 && apiKey.length <= 100;
}

// ローカルストレージに単語カードを保存
function saveCards(cards) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
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
    saveCards(cards);
}

/**
 * カードをIDで削除
 * @param {string} id - カードID
 * @throws {Error} カードIDが不正、または保存に失敗した場合
 */
function deleteCard(id) {
    // 入力検証
    if (!id || typeof id !== 'string') {
        throw new Error('無効なカードIDです');
    }

    const cards = loadCards();

    // IDで検索して削除
    const index = cards.findIndex(c => c.id === id);
    if (index === -1) {
        throw new Error('カードが見つかりませんでした');
    }

    cards.splice(index, 1);

    try {
        saveCards(cards);
    } catch (error) {
        console.error('カードの削除に失敗しました:', error);
        throw error;
    }
}

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
    // \x00-\x1F: C0制御文字（ASCII 0-31）
    // \x7F: DEL文字
    // \x80-\x9F: C1制御文字（Unicode 128-159）
    // \u2028: Line Separator
    // \u2029: Paragraph Separator
    return text.replace(/[\x00-\x1F\x7F-\x9F\u2028\u2029]/g, '')
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
document.getElementById('start-quiz-btn').addEventListener('click', () => {
    const cards = loadCards();
    if (cards.length === 0) {
        alert('まずは単語を登録してください');
    } else {
        startQuiz();
    }
});

// ホーム画面: 一覧表示ボタン
document.getElementById('show-list-btn').addEventListener('click', () => {
    renderListView();
});

// ホーム画面: 設定ボタン
document.getElementById('settings-btn').addEventListener('click', () => {
    initSettingsView();
});

// 単語カード追加画面の初期化
function initAddView() {
    showView('add-view');
    // 入力欄をクリア
    document.getElementById('category-input').value = '';
    document.getElementById('question-input').value = '';
    document.getElementById('answer-input').value = '';
}

// 追加画面: キャンセルボタン
document.getElementById('cancel-add-btn').addEventListener('click', () => {
    renderListView();
});

// 追加画面: 保存ボタン
document.getElementById('save-card-btn').addEventListener('click', () => {
    const categoryRaw = document.getElementById('category-input').value.trim();
    const questionRaw = document.getElementById('question-input').value.trim();
    const answerRaw = document.getElementById('answer-input').value.trim();

    // 入力長制限チェック
    if (categoryRaw.length > INPUT_LIMITS.CATEGORY) {
        alert(`カテゴリ名は${INPUT_LIMITS.CATEGORY}文字以内にしてください`);
        return;
    }
    if (questionRaw.length > INPUT_LIMITS.QUESTION) {
        alert(`問題文は${INPUT_LIMITS.QUESTION}文字以内にしてください`);
        return;
    }
    if (answerRaw.length > INPUT_LIMITS.ANSWER) {
        alert(`解答は${INPUT_LIMITS.ANSWER}文字以内にしてください`);
        return;
    }

    // サニタイズ
    const category = sanitizeInput(categoryRaw, INPUT_LIMITS.CATEGORY);
    const question = sanitizeInput(questionRaw, INPUT_LIMITS.QUESTION);
    const answer = sanitizeInput(answerRaw, INPUT_LIMITS.ANSWER);

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

    // カテゴリ別にグループ化（パフォーマンス最適化: O(n×m) → O(n)）
    const cardsByCategory = cards.reduce((acc, card) => {
        if (!acc.has(card.category)) {
            acc.set(card.category, []);
        }
        acc.get(card.category).push(card);
        return acc;
    }, new Map());

    // カテゴリごとに表示
    for (const [category, categoryCards] of cardsByCategory) {
        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.textContent = category;
        categorySection.appendChild(categoryHeader);

        // このカテゴリのカードを表示
        categoryCards.forEach((card) => {
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
        });

        cardListElement.appendChild(categorySection);
    }
}

// 一覧画面: 戻るボタン
document.getElementById('back-from-list-btn').addEventListener('click', () => {
    initHomeView();
});

// 一覧画面: 追加ボタン
document.getElementById('add-from-list-btn').addEventListener('click', () => {
    initAddView();
});

// 一覧画面: インポートボタン
document.getElementById('import-from-list-btn').addEventListener('click', () => {
    initImportView();
});

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

// 学習画面: アクションボタン
document.getElementById('quiz-action-btn').addEventListener('click', () => {
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

// 学習画面: 終了ボタン
document.getElementById('quit-quiz-btn').addEventListener('click', () => {
    if (confirm('学習を終了してホームに戻りますか?')) {
        initHomeView();
    }
});

// 完了画面を表示
function showCompletionView() {
    showView('completion-view');
}

// 完了画面: ホームに戻るボタン
document.getElementById('back-to-home-btn').addEventListener('click', () => {
    initHomeView();
});

// 設定画面の初期化
async function initSettingsView() {
    showView('settings-view');
    const apiKey = await loadApiKey();
    document.getElementById('gemini-api-key-input').value = apiKey;
    document.getElementById('settings-status').textContent = '';
}

// 設定画面: 戻るボタン
document.getElementById('back-from-settings-btn').addEventListener('click', () => {
    initHomeView();
});

// 設定画面: 保存ボタン
document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const apiKeyRaw = document.getElementById('gemini-api-key-input').value.trim();
    // セキュリティ: まず入力をサニタイズ
    const apiKey = sanitizeInput(apiKeyRaw, INPUT_LIMITS.API_KEY);

    if (!apiKey) {
        alert('API Keyを入力してください');
        return;
    }

    // 入力長制限チェック
    if (apiKeyRaw.length > INPUT_LIMITS.API_KEY) {
        alert(`API Keyは${INPUT_LIMITS.API_KEY}文字以内にしてください`);
        return;
    }

    if (!validateApiKey(apiKey)) {
        alert('API Keyの形式が正しくありません。有効なGemini API Keyを入力してください。');
        return;
    }
    try {
        await saveApiKey(apiKey);
        document.getElementById('settings-status').textContent = '設定を保存しました';
        setTimeout(() => {
            document.getElementById('settings-status').textContent = '';
        }, 3000);
    } catch (error) {
        alert(error.message);
    }
});

// 設定画面: API Keyクリアボタン
document.getElementById('clear-api-key-btn').addEventListener('click', () => {
    if (confirm('API Keyを削除しますか？画像インポート機能を使用するには再度設定が必要になります。')) {
        clearApiKey();
        document.getElementById('gemini-api-key-input').value = '';
        document.getElementById('settings-status').textContent = 'API Keyを削除しました';
        setTimeout(() => {
            document.getElementById('settings-status').textContent = '';
        }, 3000);
    }
});

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
    document.getElementById('preview-canvas').style.display = 'none';
    document.getElementById('process-image-btn').disabled = true;
    updateImportStatus('');
    document.getElementById('import-preview').innerHTML = '';
}

// インポート画面: キャンセルボタン
document.getElementById('cancel-import-btn').addEventListener('click', () => {
    renderListView();
});

// インポート画面: 画像選択
document.getElementById('image-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // ファイルサイズチェック
    if (file.size > INPUT_LIMITS.MAX_IMAGE_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        const limitMB = (INPUT_LIMITS.MAX_IMAGE_SIZE / 1024 / 1024).toFixed(0);
        alert(`画像サイズが大きすぎます。\n現在: ${sizeMB}MB\n上限: ${limitMB}MB\n\nより小さい画像を選択してください。`);
        event.target.value = ''; // 入力をクリア
        return;
    }

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
    canvas.style.display = 'block';
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
document.getElementById('process-image-btn').addEventListener('click', async () => {
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
        // 赤字部分を抽出
        updateImportStatus('赤字を検出中...');
        redTextCanvas = extractRedText(selectedImage);

        // 画像をリサイズ
        resizedCanvas = resizeCanvas(redTextCanvas, GEMINI_API_CONFIG.maxImageSize);

        // OCRで文字認識
        updateImportStatus('OCRで文字を認識中... (しばらくお待ちください)');
        const text = await performOCR(resizedCanvas);

        // テキストを解析してカードを作成
        updateImportStatus('テキストを解析中...');
        extractedCards = parseTextToCards(text);

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
        saveBtn.className = 'primary-button';
        saveBtn.textContent = 'すべて保存';
        saveBtn.style.marginTop = '20px';
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
    const apiKey = await loadApiKey();
    if (!apiKey) {
        throw new Error('Gemini API Keyが設定されていません。設定画面から設定してください。');
    }

    // キャンバスをbase64エンコード
    const base64Image = canvas.toDataURL('image/png').split(',')[1];

    // Gemini APIにリクエスト
    updateImportStatus('Gemini APIで画像を解析中...');

    // タイムアウト設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INPUT_LIMITS.FETCH_TIMEOUT);

    try {
        const response = await fetch(GEMINI_API_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey  // セキュリティ向上: URLではなくヘッダーでAPI keyを送信
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: GEMINI_API_CONFIG.prompt
                        },
                        {
                            inline_data: {
                                mime_type: 'image/png',
                                data: base64Image
                            }
                        }
                    ]
                }]
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            // レート制限エラーの特別処理
            if (response.status === 429) {
                throw new Error('APIのリクエスト上限に達しました。しばらく時間をおいてから再度お試しください。');
            }

            // 認証エラーの特別処理
            if (response.status === 401 || response.status === 403) {
                throw new Error('API Keyが無効です。設定画面で正しいAPI Keyを設定してください。');
            }

            let errorMessage = response.statusText;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                // JSONパースエラーは無視してstatusTextを使用
                console.error('Failed to parse error response:', e);
            }
            throw new Error(`Gemini API error: ${errorMessage}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Gemini APIからのレスポンスの解析に失敗しました。ネットワーク接続を確認してください。');
        }

        // レスポンスからテキストを抽出
        // レスポンス構造の詳細バリデーション
        if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
            throw new Error('Gemini APIからのレスポンスが不正です（candidates配列が存在しません）。画像の内容を確認してください。');
        }

        const candidate = data.candidates[0];
        if (!candidate?.content?.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
            throw new Error('Gemini APIからのレスポンスが不正です（parts配列が存在しません）。画像の内容を確認してください。');
        }

        const textPart = candidate.content.parts[0];
        if (!textPart?.text || typeof textPart.text !== 'string') {
            throw new Error('Gemini APIからのレスポンスが不正です（テキストデータが存在しません）。画像の内容を確認してください。');
        }

        const extractedText = textPart.text;

        // レスポンス内容のバリデーション
        if (extractedText.trim().length === 0) {
            throw new Error('APIから空のレスポンスが返されました。画像に認識可能なテキストがあるか確認してください。');
        }

        // 異常に大きなレスポンスをチェック（100KB以上）
        if (extractedText.length > MAX_IMPORT_TEXT_LENGTH) {
            throw new Error('レスポンスが大きすぎます。画像サイズを小さくしてください。');
        }

        return extractedText;
    } catch (error) {
        clearTimeout(timeoutId);
        // タイムアウトエラーの特別処理
        if (error.name === 'AbortError') {
            throw new Error(`リクエストがタイムアウトしました（${INPUT_LIMITS.FETCH_TIMEOUT / 1000}秒）。ネットワーク接続を確認してください。`);
        }
        // その他のエラーは再スロー
        throw error;
    }
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
    header.style.marginBottom = '15px';
    header.style.color = '#333';
    previewDiv.appendChild(header);

    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'preview-card';

        // 問題セクション
        const questionDiv = document.createElement('div');
        questionDiv.style.marginBottom = '10px';

        const questionLabel = document.createElement('label');
        questionLabel.textContent = '問題:';
        questionLabel.style.display = 'block';
        questionLabel.style.fontWeight = 'bold';
        questionLabel.style.marginBottom = '5px';

        const questionInput = document.createElement('input');
        questionInput.type = 'text';
        questionInput.className = 'preview-input';
        questionInput.dataset.index = index;
        questionInput.dataset.field = 'question';
        questionInput.value = card.question; // DOM API により自動的にエスケープ
        questionInput.maxLength = INPUT_LIMITS.QUESTION;

        questionDiv.appendChild(questionLabel);
        questionDiv.appendChild(questionInput);

        // 答えセクション
        const answerDiv = document.createElement('div');
        answerDiv.style.marginBottom = '10px';

        const answerLabel = document.createElement('label');
        answerLabel.textContent = '答え:';
        answerLabel.style.display = 'block';
        answerLabel.style.fontWeight = 'bold';
        answerLabel.style.marginBottom = '5px';

        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.className = 'preview-input';
        answerInput.dataset.index = index;
        answerInput.dataset.field = 'answer';
        answerInput.value = card.answer; // DOM API により自動的にエスケープ
        answerInput.maxLength = INPUT_LIMITS.ANSWER;

        answerDiv.appendChild(answerLabel);
        answerDiv.appendChild(answerInput);

        // 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-preview-btn';
        deleteBtn.dataset.index = index;
        deleteBtn.textContent = '削除';
        deleteBtn.style.backgroundColor = '#ff4444';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.padding = '5px 10px';
        deleteBtn.style.borderRadius = '3px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '12px';

        cardDiv.appendChild(questionDiv);
        cardDiv.appendChild(answerDiv);
        cardDiv.appendChild(deleteBtn);
        previewDiv.appendChild(cardDiv);
    });

    // イベント委譲パターン（メモリリーク防止）
    // 既存のイベントリスナーをクリア
    const oldPreviewDiv = document.getElementById('import-preview');
    const newPreviewDiv = oldPreviewDiv.cloneNode(false);
    newPreviewDiv.innerHTML = oldPreviewDiv.innerHTML;
    oldPreviewDiv.parentNode.replaceChild(newPreviewDiv, oldPreviewDiv);

    // 親要素に1つのイベントリスナーを設定（イベント委譲）
    const handlePreviewInput = debounce((e) => {
        if (e.target.classList.contains('preview-input')) {
            const index = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            // ユーザー入力をサニタイズ
            extractedCards[index][field] = sanitizeInput(e.target.value);
        }
    }, 300);

    newPreviewDiv.addEventListener('input', handlePreviewInput);

    newPreviewDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-preview-btn')) {
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
        }
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
document.addEventListener('DOMContentLoaded', () => {
    initHomeView();
});
