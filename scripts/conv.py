import os
import re
from bs4 import BeautifulSoup
import pandas as pd

base_dir = os.path.dirname(os.path.abspath(__file__))
html_path = os.path.join(base_dir, "wikiALL.html")
output_path = os.path.normpath(os.path.join(base_dir, "..", "craft_data.csv"))

def run_convert():
    if not os.path.exists(html_path): return

    with open(html_path, encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    rows = []
    seen = set()
    
    # Wiki本文エリアを狙い撃ち
    content = soup.find(id="wikibody") or soup.find(class_="atwiki_body") or soup
    tables = content.find_all("table")

    # 1列目にこれらが含まれていたら「クラフト用テーブル」と認定するリスト
    target_keywords = ["アイテム", "名称", "装備", "パーツ", "チップ", "作成"]

    for table in tables:
        all_tr = table.find_all("tr")
        if not all_tr: continue

        # --- 1. ヘッダー行の特定と列インデックスの把握 ---
        header_row = None
        target_col_idx = -1 # 「アイテム名」が何列目にあるか
        
        for tr in all_tr:
            cells = tr.find_all(["th", "td"])
            if not cells: continue
            
            first_text = cells[0].get_text(strip=True)
            if any(kw in first_text for kw in target_keywords):
                header_row = tr
                target_col_idx = 0 # 1列目をターゲットに固定
                break
        
        if target_col_idx == -1: continue # ターゲット外のテーブル

        # --- 2. レアリティ判定 (テーブル直前の見出し) ---
        table_rarity = ""
        prev = table.find_previous(["h2", "h3", "h4"])
        if prev:
            t = prev.get_text()
            if "レジェンダリー" in t: table_rarity = "legendary"
            elif "エピック" in t: table_rarity = "epic"
            elif "レア" in t: table_rarity = "rare"
            elif "アンコモン" in t: table_rarity = "uncommon"
            elif "コモン" in t: table_rarity = "common"

        # --- 3. データ行のパース ---
        # ヘッダー以降の行をループ
        found_header = False
        for tr in all_tr:
            if tr == header_row:
                found_header = True
                continue
            if not found_header: continue

            cells = tr.find_all(["td", "th"])
            if len(cells) < 2: continue

            # テキスト化とクレンジング
            texts = [c.get_text("\n", strip=True).replace("×", "x").replace("　", " ") for c in cells]

            

            # ターゲットアイテム名（不要な記号を削除）
            target_item = re.sub(r'^[+\s・]+', '', texts[target_col_idx]).strip()
            if not target_item or any(kw in target_item for kw in target_keywords):
                continue

            # レアリティの行内判定（ユーザー指定の正規表現）
            row_rarity = table_rarity
            for t in texts:
                if re.search(r'\b(legendary|レジェンダリー)\b', t, re.IGNORECASE):
                    row_rarity = "legendary"; break
                elif re.search(r'\b(epic|エピック)\b', t, re.IGNORECASE):
                    row_rarity = "epic"; break
                elif re.search(r'\b(uncommon|アンコモン)\b', t, re.IGNORECASE):
                    row_rarity = "uncommon"; break
                elif re.search(r'\b(common|コモン)\b', t, re.IGNORECASE):
                    row_rarity = "common"; break
                elif re.search(r'\b(rare|レア)\b', t, re.IGNORECASE) and "レア度" not in t:
                    if not any(x in t for x in ["メタル", "アース", "素材", "チップ"]):
                        row_rarity = "rare"; break

            # 素材の抽出 (アイテム名列以外をすべてチェック)
            for i, cell_content in enumerate(texts):
                # print(f"log-cell_content0: {cell_content}")

                if i == target_col_idx: continue # 自分自身は飛ばす
                # if "マネー" in cell_content: continue

                print(f"log-cell_content: {cell_content}")

                parts = re.split(r'[\n/、,]', cell_content)
                for part in parts:
                    # 素材名 x 数量
                    m = re.search(r'(.+?)\s*[xX]\s*(\d+)', part.strip())
                    if m:
                        mat_name = m.group(1).strip()
                        qty = int(m.group(2))
                        if len(mat_name) < 2: continue

                        key = (mat_name, target_item, qty)
                        if key not in seen:
                            seen.add(key)
                            rows.append({
                                "material": mat_name,
                                "target": target_item,
                                "machine": "",
                                "rarity": row_rarity,
                                "qty": qty
                            })

    if rows:
        pd.DataFrame(rows).to_csv(output_path, index=False, encoding="utf-8-sig")
        print(f"✅ 完了: {len(rows)} 件を {output_path} に出力")
    else:
        print("⚠ 抽出できませんでした。")

if __name__ == "__main__":
    run_convert()