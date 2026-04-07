import os
from bs4 import BeautifulSoup
import csv
import unicodedata

def normalize_rarity(text):
    if not text: return "common"
    s = unicodedata.normalize('NFKC', text).lower().strip()
    if "legendary" in s or "レジェンダリー" in s: return "legendary"
    if "epic" in s or "エピック" in s: return "epic"
    if "rare" in s or "レア" in s: return "rare"
    if "uncommon" in s or "アンコモン" in s: return "uncommon"
    if "common" in s or "コモン" in s: return "common"
    return "common"

def run_master_convert():
    # --- パス設定 (元の設定を維持) ---
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, "itemALL.html")
    # 1つ上の階層の item_master.csv に出力
    output_path = os.path.normpath(os.path.join(base_dir, "..", "item_master.csv"))

    if not os.path.exists(input_path):
        print(f"❌ エラー: {input_path} が見つかりません。")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    tables = soup.find_all("table")
    item_master = []
    seen_names = set()

    for table in tables:
        rows = table.find_all("tr")
        if not rows: continue
        
        header_cols = [th.get_text(strip=True) for th in rows[0].find_all(["th", "td"])]
        col_map = {
            "name": -1, "rarity": -1, "category": -1, 
            "location": -1, "buy": -1, "sell": -1, "note": -1
        }
        
        for i, h in enumerate(header_cols):
            if any(x in h for x in ["名称", "アイテム名"]): col_map["name"] = i
            elif "レア" in h: col_map["rarity"] = i
            elif any(x in h for x in ["種類", "カテゴリ"]): col_map["category"] = i
            elif "入手" in h: col_map["location"] = i
            elif "購入" in h: col_map["buy"] = i
            elif "売却" in h: col_map["sell"] = i
            elif "備考" in h: col_map["note"] = i

        for row in rows[1:]:
            cols = row.find_all("td")
            if col_map["name"] == -1 or len(cols) <= col_map["name"]: continue
            
            name = cols[col_map["name"]].get_text(strip=True)
            if not name or name in seen_names: continue
            
            def get_text(key):
                idx = col_map[key]
                if idx != -1 and len(cols) > idx:
                    return cols[idx].get_text(separator=" ", strip=True).replace("\n", " ").strip()
                return ""

            rarity_raw = get_text("rarity")
            
            item_master.append({
                "name": name,
                "rarity": normalize_rarity(rarity_raw),
                "category": get_text("category") or "素材",
                "location": get_text("location"),
                "buy": get_text("buy"),
                "sell": get_text("sell"),
                "note": get_text("note")
            })
            seen_names.add(name)

    # 出力
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "rarity", "category", "location", "buy", "sell", "note"])
        writer.writeheader()
        writer.writerows(item_master)
    
    print(f"✅ 完了: {len(item_master)}件のアイテムを {output_path} に書き出しました。")

if __name__ == "__main__":
    run_master_convert()