// --- グローバル変数 ---
/**
 * 全レシピのフラットなリスト
 * @type {Array<Object>}
 */
let allRecipes = [];

/**
 * アイテムの基本情報（レア度、場所など）
 * @type {Object<string, Object>}
 */
let itemMaster = {};

/**
 * 「素材名」をキーにした逆引き用辞書
 * @type {Object<string, Array<Object>>}
 */
let groupedByMaterial = {};

/**
 * アプリの初期化：CSVを読み込んでデータを構造化する
 * @async
 * @function init
 * @returns {Promise<void>} 初期化完了のPromise
 * @throws {Error} データ読み込みエラー
 */
async function init() {
    try {
        // マスターデータとレシピデータを同時に取得
        const [mRes, rRes] = await Promise.all([
            fetch('./item_master.csv'),
            fetch('./craft_data.csv')
        ]);

        // アイテムマスターのパース
        const mData = parseCSV(await mRes.text());
        mData.slice(1).forEach(row => {
            if (row[0]) {
                const rar = row[1] ? row[1].toLowerCase().trim().replace(/\s+/g, '') : 'common';
                itemMaster[row[0]] = { rarity: rar, category: row[2], location: row[3], buy: row[4], sell: row[5], note: row[6] };
            }
        });

        // レシピデータのパース
        const rData = parseCSV(await rRes.text());
        rData.slice(1).forEach(row => {
            if (!row[0]) return;
            const data = {
                material: row[0],
                target: row[1],
                rarity: row[3] ? row[3].toLowerCase().trim().replace(/\s+/g, '') : 'common',
                qty: parseInt(row[4]) || 0
            };
            allRecipes.push(data);
            // 逆引き検索を高速化するために、素材名でグループ化しておく
            if (!groupedByMaterial[data.material]) groupedByMaterial[data.material] = [];
            groupedByMaterial[data.material].push(data);
        });
        render(); // 最初の描画を実行
    } catch (e) { console.error("Data loading error:", e); }
}

/**
 * シンプルなCSVパース関数（引用符に対応）
 * @function parseCSV
 * @param {string} text - パースするCSVテキスト
 * @returns {Array<Array<string>>} パースされた行の配列
 */
function parseCSV(text) {
    const rows = [];
    let curRow = [], curCell = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (c === '"') inQuote = !inQuote;
        else if (c === ',' && !inQuote) { curRow.push(curCell.trim()); curCell = ''; }
        else if ((c === '\n' || c === '\r') && !inQuote) {
            if (curCell || curRow.length) { curRow.push(curCell.trim()); rows.push(curRow); }
            curRow = []; curCell = '';
        } else curCell += c;
    }
    return rows;
}

/**
 * メインの描画処理：素材ごとのカードを生成する
 * @function render
 */
function render() {
    const container = document.getElementById('container');
    container.innerHTML = "";

    // 素材名でソートしてループ
    Object.keys(groupedByMaterial).sort().forEach(name => {
        const items = groupedByMaterial[name];
        const m = itemMaster[name] || {};
        const rar = m.rarity || 'common';

        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-name', name);

        card.innerHTML = `
    <div class="card-header" onclick="quickSearch('${name.replace(/'/g, "\\'")}')">
        <div class="rarity-label bg-${rar}">${rar}</div>
        <div class="header-material-name">${name}</div>
        <div class="header-info">
            <span>[ ${m.category || '素材'} ]</span>
            ${m.buy && m.buy !== "-" ? `<span class="price-tag buy-price">購入: ${m.buy}</span>` : ""}
            ${m.sell && m.sell !== "-" ? `<span class="price-tag sell-price">売却: ${m.sell}</span>` : ""}
        </div>
        ${m.location ? `<div class="header-location">📍 入手方法: <b>${m.location}</b></div>` : ""}
        ${m.note ? `<div class="header-note">${m.note}</div>` : ""}
    </div>
    <div class="usage-list">
        <div class="usage-title">この素材から作れるアイテム（逆引き）</div>
            ${items.map(item => `
            <div class="usage-item">
                <span class="rarity-tag ${item.rarity}">${item.rarity.toUpperCase()}</span>
                <div style="flex-grow:1">
                    <div class="target-name"
                         onclick="quickSearch('${item.target.replace(/'/g, "\\'")}')"
                         title="このアイテムを材料として使うレシピを検索">
                         ${item.target}
                    </div>

                    <div class="expand-button"
                         onclick="toggleExpand(this, '${item.target.replace(/'/g, "\\'")}')">
                         ▼ その他素材の詳細表示 ▼
                    </div>

                    <div class="recursive-area"></div>
                </div>
                <div class="qty-area"><div class="qty-val">${item.qty}</div></div>
            </div>
        `).join('')}
    </div>
`;
        container.appendChild(card);
    });
}

/**
 * アコーディオン展開：完成品を末端素材まで再帰的に計算して表示する
 * @function toggleExpand
 * @param {HTMLElement} el - クリックされた要素
 * @param {string} target - 展開するターゲットアイテム名
 */
function toggleExpand(el, target) {
    const area = el.parentElement.querySelector('.recursive-area');
    const isDeepScan = document.getElementById('deep-scan').checked;

    if (area.classList.toggle('active')) {
        if (isDeepScan) {
            // --- 末端まで全部展開するモード ---
            const totals = {};
            const calc = (t, m) => {
                const ings = allRecipes.filter(r => r.target === t);
                if (!ings.length) return totals[t] = (totals[t] || 0) + m;
                ings.forEach(i => calc(i.material, i.qty * m));
            };
            calc(target, 1);
            
            area.innerHTML = '<div style="font-size:10px; color:var(--accent); margin-bottom:8px;">【再帰計算】末端素材の合計</div>' +
                Object.entries(totals).map(([m, q]) => `
                <div class="recursive-item" onclick="event.stopPropagation(); quickSearch('${m.replace(/'/g, "\\'")}')">
                    <span>${m}</span><span style="font-weight:bold; color:var(--accent);">x${q}</span>
                </div>`).join('');
        } else {
            // --- 1階層だけ表示するモード（デフォルト） ---
            const ingredients = allRecipes.filter(r => r.target === target);
            if (!ingredients.length) {
                area.innerHTML = '<div style="font-size:10px; color:#555;">※ 分解レシピがありません</div>';
                return;
            }
            
            area.innerHTML = '<div style="font-size:10px; color:#555; margin-bottom:8px;">必要な構成材料</div>' +
                ingredients.map(i => `
                <div class="recursive-item" onclick="event.stopPropagation(); quickSearch('${i.material.replace(/'/g, "\\'")}')">
                    <span>${i.material}</span><span style="font-weight:bold; color:var(--accent);">x${i.qty}</span>
                </div>`).join('');
        }
    }
}

/**
 * クイック検索：指定した単語を検索窓に入れてフィルタリングを実行
 * @function quickSearch
 * @param {string} n - 検索するアイテム名
 */
function quickSearch(n) {
    const searchInput = document.getElementById('search');
    searchInput.value = n;
    filter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * フィルタリングとソーティング：
 * 完全一致 ＞ 前方一致 ＞ 部分一致 の順で並び替えて表示する
 * @function filter
 */
function filter() {
    const query = document.getElementById('search').value.toLowerCase().trim();
    const container = document.getElementById('container');
    const cards = Array.from(document.querySelectorAll('.card'));

    if (query === "") {
        cards.forEach(c => c.classList.remove('show'));
        return;
    }

    // 各カードに「一致スコア」を付けて判定
    const results = cards.map(card => {
        const name = card.getAttribute('data-name').toLowerCase();
        let score = 0;

        if (name === query) {
            score = 3; // 完全一致
        } else if (name.startsWith(query)) {
            score = 2; // 前方一致
        } else if (name.includes(query)) {
            score = 1; // 部分一致（含まれる）
        }

        return { card, score };
    });

    // スコアがあるものだけを表示し、スコア順 ＞ 名前順 で並び替える
    results
        .filter(res => res.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score; // スコアが高い順
            return a.card.getAttribute('data-name').localeCompare(b.card.getAttribute('data-name')); // 同じスコアなら名前順
        })
        .forEach(res => {
            res.card.classList.add('show');
            container.appendChild(res.card); // DOM上の順番を入れ替える
        });

    // スコアが0のものは隠す
    results.filter(res => res.score === 0).forEach(res => res.card.classList.remove('show'));
}

// アプリ起動
init();