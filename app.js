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

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    initHomeView();
});
