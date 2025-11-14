// データ操作関数
const STORAGE_KEY = 'MEMORY';
const API_KEY_STORAGE_KEY = 'GEMINI_API_KEY';

// ローカルストレージから単語カードを読み込む
function loadCards() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Gemini API Keyの保存
function saveApiKey(apiKey) {
    try {
        localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
        return true;
    } catch (e) {
        // QuotaExceededError または SecurityError をキャッチ
        console.error('Failed to save API key to localStorage:', e);
        if (e.name === 'QuotaExceededError') {
            throw new Error('ストレージの容量が不足しています。ブラウザのデータを整理してください。');
        } else if (e.name === 'SecurityError') {
            throw new Error('プライベートブラウジングモードではAPI Keyを保存できません。');
        } else {
            throw new Error('API Keyの保存に失敗しました: ' + e.message);
        }
    }
}

// Gemini API Keyの読み込み
function loadApiKey() {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

// Gemini API Keyの削除
function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}

// Gemini API Keyのバリデーション
function validateApiKey(apiKey) {
    // Gemini API keyは通常"AIza"で始まる39文字の文字列
    // ただし、将来的に形式が変わる可能性があるため、基本的な長さチェックのみ行う
    if (!apiKey) return false;

    // 最低限の長さチェック（20文字以上）
    if (apiKey.length < 20) return false;

    // "AIza"で始まる場合は39文字であることを確認（現在の標準形式）
    if (apiKey.startsWith('AIza') && apiKey.length !== 39) {
        return false;
    }

    return true;
}

// ローカルストレージに単語カードを保存
function saveCards(cards) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

// 新規カードを作成
function createCard(category, question, answer) {
    const card = { category, question, answer };
    const cards = loadCards();
    cards.push(card);
    saveCards(cards);
}

// カードを削除
function deleteCard(index) {
    const cards = loadCards();
    cards.splice(index, 1);
    saveCards(cards);
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

// 上付き・下付き文字を変換
function parseSubscriptSuperscript(text) {
    // 波括弧付き上付き文字: ^{text}
    text = text.replace(/\^\{([^}]+)\}/g, '<span class="superscript">$1</span>');
    // 単一文字上付き文字: ^x
    text = text.replace(/\^(.)/g, '<span class="superscript">$1</span>');

    // 波括弧付き下付き文字: _{text}
    text = text.replace(/\_\{([^}]+)\}/g, '<span class="subscript">$1</span>');
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
    const category = document.getElementById('category-input').value.trim();
    const question = document.getElementById('question-input').value.trim();
    const answer = document.getElementById('answer-input').value.trim();

    if (!question || !answer) {
        alert('問題と解答を入力してください');
        return;
    }

    // カテゴリが空の場合はデフォルト値を設定
    const finalCategory = category || '未分類';

    createCard(finalCategory, question, answer);
    alert('保存しました');

    // 入力欄をクリア
    document.getElementById('category-input').value = '';
    document.getElementById('question-input').value = '';
    document.getElementById('answer-input').value = '';

    // フォーカスをカテゴリ入力欄に戻す
    document.getElementById('category-input').focus();
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
                        deleteCard(index);
                        renderListView();
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
function initSettingsView() {
    showView('settings-view');
    const apiKey = loadApiKey();
    document.getElementById('gemini-api-key-input').value = apiKey;
    document.getElementById('settings-status').textContent = '';
}

// 設定画面: 戻るボタン
document.getElementById('back-from-settings-btn').addEventListener('click', () => {
    initHomeView();
});

// 設定画面: 保存ボタン
document.getElementById('save-settings-btn').addEventListener('click', () => {
    const apiKey = document.getElementById('gemini-api-key-input').value.trim();
    if (!apiKey) {
        alert('API Keyを入力してください');
        return;
    }
    if (!validateApiKey(apiKey)) {
        alert('API Keyの形式が正しくありません。20文字以上の英数字である必要があります。');
        return;
    }
    try {
        saveApiKey(apiKey);
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

// 赤字検出の閾値設定
// R値が高く、G・B値が低い場合に赤と判定
const RED_DETECTION_THRESHOLD = {
    // 濃い赤の判定: R > 150 AND G < 100 AND B < 100
    darkRed: { r: 150, g: 100, b: 100 },
    // 薄い赤の判定: R > 180 AND R > G×1.5 AND R > B×1.5
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
        selectedImage.src = '';
        selectedImage = null;
    }
    extractedCards = [];
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

    // 既に処理中の場合は無視
    if (isProcessingOCR) {
        return;
    }

    const previewDiv = document.getElementById('import-preview');
    const processBtn = document.getElementById('process-image-btn');

    updateImportStatus('画像を処理中...');
    previewDiv.innerHTML = '';
    isProcessingOCR = true;
    processBtn.disabled = true; // レース条件防止のためボタンを無効化

    try {
        // 赤字部分を抽出
        updateImportStatus('赤字を検出中...');
        const redTextCanvas = extractRedText(selectedImage);

        // 画像をリサイズ
        const resizedCanvas = resizeCanvas(redTextCanvas, GEMINI_API_CONFIG.maxImageSize);

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
        isProcessingOCR = false;
        processBtn.disabled = false; // ボタンを再度有効化
    }
});

// 赤字部分を抽出
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

// OCRで文字認識（Gemini Vision API使用）
async function performOCR(canvas) {
    const apiKey = loadApiKey();
    if (!apiKey) {
        throw new Error('Gemini API Keyが設定されていません。設定画面から設定してください。');
    }

    // キャンバスをbase64エンコード
    const base64Image = canvas.toDataURL('image/png').split(',')[1];

    // Gemini APIにリクエスト
    updateImportStatus('Gemini APIで画像を解析中...');

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
        })
    });

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
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Gemini APIからのレスポンスが不正です。画像の内容を確認してください。');
    }
}

// テキストを解析してカード配列を作成
function parseTextToCards(text) {
    // 入力をサニタイズ
    const categoryRaw = document.getElementById('import-category-input').value.trim() || '英単語';
    const category = sanitizeInput(categoryRaw);
    const cards = [];
    const lines = text.split('\n')
        .map(line => sanitizeInput(line))
        .filter(line => line.length > 0);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // パターン1: 矢印や記号で区切られている場合（→ : - など）
        const separators = /[→:：\-－]/;
        if (separators.test(line)) {
            const parts = line.split(separators).map(p => p.trim()).filter(p => p.length > 0);
            if (parts.length >= 2) {
                cards.push({
                    category: category,
                    question: parts[0],
                    answer: parts.slice(1).join(' ')
                });
                continue;
            }
        }

        // パターン2: スペース、タブで区切られた「問題 答え」形式
        const parts = line.split(/[\s\t]+/).filter(p => p.length > 0);
        if (parts.length >= 2) {
            cards.push({
                category: category,
                question: parts[0],
                answer: parts.slice(1).join(' ')
            });
        } else if (parts.length === 1 && i + 1 < lines.length) {
            // パターン3: 単一の単語の場合、次の行と組み合わせる
            const nextLine = lines[i + 1];
            const nextParts = nextLine.split(/[\s\t]+/).filter(p => p.length > 0);
            if (nextParts.length === 1) {
                cards.push({
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

// インポートプレビューを表示（編集機能付き）
function displayImportPreview(cards) {
    const previewDiv = document.getElementById('import-preview');
    previewDiv.innerHTML = '<h3 style="margin-bottom: 15px; color: #333;">検出されたカード（編集可能）:</h3>';

    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'preview-card';
        cardDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">問題:</label>
                <input type="text" class="preview-input" data-index="${index}" data-field="question" value="${escapeHtml(card.question)}">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-weight: bold; margin-bottom: 5px;">答え:</label>
                <input type="text" class="preview-input" data-index="${index}" data-field="answer" value="${escapeHtml(card.answer)}">
            </div>
            <button class="delete-preview-btn" data-index="${index}" style="background-color: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">削除</button>
        `;
        previewDiv.appendChild(cardDiv);
    });

    // 編集イベントリスナー
    document.querySelectorAll('.preview-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            // ユーザー入力をサニタイズ
            extractedCards[index][field] = sanitizeInput(e.target.value);
        });
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

// HTMLエスケープ関数（XSS対策）
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 入力サニタイゼーション関数
function sanitizeInput(text) {
    if (!text) return '';
    // 制御文字を除去
    return text.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

// 抽出したカードを保存
function saveExtractedCards() {
    const cards = loadCards();
    extractedCards.forEach(card => {
        cards.push(card);
    });
    saveCards(cards);

    alert(`${extractedCards.length}件のカードをインポートしました`);
    renderListView();
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    initHomeView();
});
