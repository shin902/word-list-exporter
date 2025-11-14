// データ操作関数
const STORAGE_KEY = 'MEMORY';

// ローカルストレージから単語カードを読み込む
function loadCards() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
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

// 画像インポート機能
let selectedImage = null;
let extractedCards = [];

// インポート画面の初期化
function initImportView() {
    showView('import-view');
    selectedImage = null;
    extractedCards = [];
    document.getElementById('image-input').value = '';
    document.getElementById('preview-canvas').style.display = 'none';
    document.getElementById('process-image-btn').disabled = true;
    document.getElementById('import-status').textContent = '';
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

// 赤字を抽出してインポート
document.getElementById('process-image-btn').addEventListener('click', async () => {
    if (!selectedImage) return;

    const statusDiv = document.getElementById('import-status');
    const previewDiv = document.getElementById('import-preview');

    statusDiv.textContent = '画像を処理中...';
    previewDiv.innerHTML = '';

    try {
        // 赤字部分を抽出
        statusDiv.textContent = '赤字を検出中...';
        const redTextCanvas = extractRedText(selectedImage);

        // OCRで文字認識
        statusDiv.textContent = 'OCRで文字を認識中... (しばらくお待ちください)';
        const text = await performOCR(redTextCanvas);

        // テキストを解析してカードを作成
        statusDiv.textContent = 'テキストを解析中...';
        extractedCards = parseTextToCards(text);

        if (extractedCards.length === 0) {
            statusDiv.textContent = '赤字のテキストが見つかりませんでした。別の画像を試してください。';
            return;
        }

        // プレビューを表示
        displayImportPreview(extractedCards);
        statusDiv.textContent = `${extractedCards.length}件のカードを検出しました。確認して保存してください。`;

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
        statusDiv.textContent = 'エラーが発生しました: ' + error.message;
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
        const isRed = (r > 150 && g < 100 && b < 100) || // 濃い赤
                      (r > 180 && r > g * 1.5 && r > b * 1.5); // 薄い赤

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

// OCRで文字認識
async function performOCR(canvas) {
    const { data } = await Tesseract.recognize(
        canvas,
        'jpn+eng',
        {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    document.getElementById('import-status').textContent =
                        `OCR処理中... ${progress}%`;
                }
            }
        }
    );
    return data.text;
}

// テキストを解析してカード配列を作成
function parseTextToCards(text) {
    const cards = [];
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    for (const line of lines) {
        // パターン1: スペース、タブ、または複数の空白で区切られた「問題 答え」形式
        const parts = line.split(/[\s\t]+/).filter(p => p.length > 0);

        if (parts.length >= 2) {
            // 最初の部分を問題、残りを答えとする
            const question = parts[0];
            const answer = parts.slice(1).join(' ');

            cards.push({
                category: '英単語',
                question: question,
                answer: answer
            });
        } else if (parts.length === 1) {
            // 単一の単語の場合、次の行と組み合わせる処理は
            // より高度なパースが必要なため、ここではスキップ
            // （必要に応じて後で実装）
        }
    }

    return cards;
}

// インポートプレビューを表示
function displayImportPreview(cards) {
    const previewDiv = document.getElementById('import-preview');
    previewDiv.innerHTML = '<h3 style="margin-bottom: 15px; color: #333;">検出されたカード:</h3>';

    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'preview-card';
        cardDiv.innerHTML = `
            <div><strong>問題:</strong> ${card.question}</div>
            <div><strong>答え:</strong> ${card.answer}</div>
        `;
        previewDiv.appendChild(cardDiv);
    });
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
