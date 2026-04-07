import os
import re
from bs4 import BeautifulSoup
import pandas as pd

base_dir = os.path.dirname(os.path.abspath(__file__))
html_path = os.path.join(base_dir, "wikiALL.html")
output_path = os.path.normpath(os.path.join(base_dir, "..", "craft_data.csv"))

def run_convert():
    if not os.path.exists(html_path):
        print(f"❌ エラー: {html_path} が見つかりません")
        return

    print(f"🔍 読み込み中: {html_path}")

    with open(html_path, encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    rows = []
    seen = set()
    content = soup.find(id="wikibody") or soup.find(id="main") or soup.find(class_="atwiki_body") or soup
    tables = content.find_all("table")

    target_keywords = ["アイテム", "名称", "装備", "パーツ", "チップ", "作成", "材料"]

    for table in tables:
        all_tr = table.find_all("tr")
        if not all_tr: continue

        # --- 1. カテゴリとレアリティ判定 ---
        table_category = "クレイドルパーツ" # デフォルト
        table_default_rarity = ""
        prev_node = table.find_previous(["h2", "h3", "h4"])
        if prev_node:
            htxt = prev_node.get_text()
            if "素材" in htxt: table_category = "素材"
            elif any(x in htxt for x in ["消費", "アイテム"]): table_category = "消費アイテム"
            elif any(x in htxt for x in ["装備", "パーツ", "武器"]): table_category = "装備品"
            elif "チップ" in htxt: table_category = "チップ"
            elif "掘削機" in htxt: table_category = "掘削機"
            if "武器" in htxt: table_category = "武器" # 武器キーワードを優先
            
            for r_jp, r_en in [("レジェンダリー", "legendary"), ("エピック", "epic"), ("レア", "rare"), ("アンコモン", "uncommon"), ("コモン", "common")]:
                if r_jp in htxt:
                    table_default_rarity = r_en
                    break

        # --- 2. ヘッダー特定 ---
        header_row = None
        for tr in all_tr:
            cells = tr.find_all(["th", "td"])
            if not cells: continue
            txt = cells[0].get_text(strip=True)
            if any(kw in txt for kw in target_keywords):
                header_row = tr
                break
        
        if not header_row: continue

        # --- 3. データ行の抽出 ---
        found_header = False
        for tr in all_tr:
            if tr == header_row:
                found_header = True
                continue
            if not found_header: continue

            cells = tr.find_all(["td", "th"])
            if len(cells) < 2: continue

            # セル内のテキストを取得
            texts = [c.get_text("\n", strip=True).replace("×", "x").replace("　", " ") for c in cells]
            
            # --- 【修正ポイント】ターゲット名のクレンジング ---
            # 改行を削除（または半角スペースに置換）して1行にする
            target_item_raw = texts[0]
            target_item = re.sub(r'^[+\s・]+', '', target_item_raw).strip()
            target_item = target_item.replace("\n", " ").replace("\r", "") # 改行を消してスペース1つに
            
            if not target_item or any(target_item == kw for kw in target_keywords):
                continue

            # レアリティ判定
            row_rarity = table_default_rarity
            full_line_text = " ".join(texts)
            for r_jp, r_en in [("レジェンダリー", "legendary"), ("エピック", "epic"), ("アンコモン", "uncommon"), ("コモン", "common"), ("レア", "rare")]:
                if r_jp in full_line_text:
                    if r_jp == "レア" and any(x in full_line_text for x in ["素材", "メタル", "チップ"]): continue
                    row_rarity = r_en
                    break

            # 素材抽出
            for i, cell_content in enumerate(texts):
                if i == 0: continue 
                
                parts = re.split(r'[\n,、/]', cell_content)
                for part in parts:
                    m = re.search(r'(.+?)\s*[xX]\s*(\d+)', part.strip())
                    if m:
                        mat_name = m.group(1).strip()
                        qty = int(m.group(2))
                        if len(mat_name) < 2 or mat_name == "材料": continue

                        key = (mat_name, target_item, qty)
                        if key not in seen:
                            seen.add(key)
                            rows.append({
                                "material": mat_name,
                                "target": target_item,
                                "machine": "", 
                                "rarity": row_rarity or "common",
                                "qty": qty,
                                "category": table_category
                            })

    if rows:
        df = pd.DataFrame(rows)
        df = df[["material", "target", "machine", "rarity", "qty", "category"]]
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
        print(f"✅ 成功: {len(df)} 件を {output_path} に出力")
    else:
        print("⚠ 抽出可能なデータが見つかりませんでした。")

if __name__ == "__main__":
    run_convert()