// --- グローバル変数 ---
let allRecipes = [];
let itemMaster = {};
let groupedByMaterial = {};

/**
 * アプリの初期化
 */
async function init() {
    try {
        const [mRes, rRes] = await Promise.all([
            fetch('./item_master.csv'),
            fetch('./craft_data.csv')
        ]);

        const mData = parseCSV(await mRes.text());
        mData.slice(1).forEach(row => {
            if (row[0]) {
                const rar = row[1] ? row[1].toLowerCase().trim().replace(/\s+/g, '') : 'common';
                itemMaster[row[0]] = { rarity: rar, category: row[2], location: row[3], buy: row[4], sell: row[5], note: row[6] };
            }
        });

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
            if (!groupedByMaterial[data.material]) groupedByMaterial[data.material] = [];
            groupedByMaterial[data.material].push(data);
        });
        render();
    } catch (e) { console.error("Data loading error:", e); }
}

/**
 * CSVパース関数
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
 * メインの描画処理
 */
function render() {
    const container = document.getElementById('container');
    container.innerHTML = "";

    Object.keys(groupedByMaterial).sort().forEach(name => {
        const items = groupedByMaterial[name];
        const m = itemMaster[name] || {};
        const rar = m.rarity || 'common';

        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-name', name);

        card.innerHTML = `
        <div class="card-header">
            <div class="header-main">
                <div class="rarity-label bg-${rar}">${rar}</div>
                <div class="header-material-name">${name}</div>
            </div>
            <div class="header-acquisition">
                ${(m.location && m.location.trim() !== "") ? `<div class="location-box">📍 入手: ${m.location}</div>` : ""}
                ${(m.buy && m.buy !== "-" && m.buy.trim() !== "") ? `<div class="price-box">💰 購入: ${m.buy}</div>` : ""}
            </div>
        </div>
        <div class="usage-list">
            <div class="usage-title">この素材から作れるアイテム（逆引き）</div>
            ${items.map(item => `
            <div class="usage-item">
                <span class="rarity-tag ${item.rarity}">${item.rarity.toUpperCase()}</span>
                <div style="flex-grow:1">
                    <div class="target-name" onclick="quickSearch('${item.target.replace(/'/g, "\\'")}')">
                        ${item.target}
                    </div>
                    <div class="expand-button" onclick="toggleExpand(this, '${item.target.replace(/'/g, "\\'")}')">
                        ▼ その他素材の詳細表示 ▼
                    </div>
                    <div class="recursive-area"></div>
                </div>
                <div class="qty-area"><div class="qty-val">${item.qty}</div></div>
            </div>
            `).join('')}
        </div>`;
        container.appendChild(card);
    });
}

/**
 * アコーディオン展開処理
 */
function toggleExpand(el, target) {
    const area = el.parentElement.querySelector('.recursive-area');
    const isDeepScan = document.getElementById('deep-scan').checked;

    if (area.classList.toggle('active')) {
        let htmlContent = '';
        if (isDeepScan) {
            const totals = {};
            const calc = (t, m) => {
                const ings = allRecipes.filter(r => r.target === t);
                if (!ings.length) totals[t] = (totals[t] || 0) + m;
                else ings.forEach(i => calc(i.material, i.qty * m));
            };
            calc(target, 1);
            htmlContent = '<div style="font-size:10px; color:var(--accent); margin-bottom:8px;">【再帰計算】末端素材の合計</div>' +
                Object.entries(totals).map(([m, q]) => `
                <div class="recursive-item" onclick="event.stopPropagation(); quickSearch('${m.replace(/'/g, "\\'")}')">
                    <span>${m}</span><span style="font-weight:bold; color:var(--accent);">x${q}</span>
                </div>`).join('');
        } else {
            const ingredients = allRecipes.filter(r => r.target === target);
            if (!ingredients.length) {
                htmlContent = '<div style="font-size:10px; color:#555;">※ 分解レシピがありません</div>';
            } else {
                htmlContent = '<div style="font-size:10px; color:#555; margin-bottom:8px;">必要な構成材料</div>' +
                    ingredients.map(i => `
                    <div class="recursive-item" onclick="event.stopPropagation(); quickSearch('${i.material.replace(/'/g, "\\'")}')">
                        <span>${i.material}</span><span style="font-weight:bold; color:var(--accent);">x${i.qty}</span>
                    </div>`).join('');
            }
        }
        area.innerHTML = htmlContent;
    }
}

function quickSearch(n) {
    const searchInput = document.getElementById('search');
    searchInput.value = n;
    filter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filter() {
    const query = document.getElementById('search').value.toLowerCase().trim();
    const container = document.getElementById('container');
    const cards = Array.from(document.querySelectorAll('.card'));
    if (query === "") { cards.forEach(c => c.classList.remove('show')); return; }

    const results = cards.map(card => {
        const name = card.getAttribute('data-name').toLowerCase();
        let score = name === query ? 3 : name.startsWith(query) ? 2 : name.includes(query) ? 1 : 0;
        return { card, score };
    });

    results.filter(res => res.score > 0)
        .sort((a, b) => b.score - a.score || a.card.getAttribute('data-name').localeCompare(b.card.getAttribute('data-name')))
        .forEach(res => { res.card.classList.add('show'); container.appendChild(res.card); });
    results.filter(res => res.score === 0).forEach(res => res.card.classList.remove('show'));
}

init();