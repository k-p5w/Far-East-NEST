import os
import csv
import re
from bs4 import BeautifulSoup
import pandas as pd

# スクリプトの場所を基準にする
base_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(base_dir, "wikiALL.html")
# 保存先を「scriptsの1つ上（リポジトリ直下）」のmanifest.csvに指定
output_path = os.path.normpath(os.path.join(base_dir, "..", "manifest.csv"))

def run_convert():
    if not os.path.exists(file_path):
        print(f"エラー: {file_path} が見つかりません。")
        return

    print(f"解析開始: {file_path}")
    
    with open(file_path, encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    rows = []
    seen = set()

    # 全てのテーブル行をスキャン
    for tr in soup.find_all("tr"):
        tds = [td.get_text(strip=True) for td in tr.find_all("td")]

        # 不要な記号（+など）を除去
        tds = [t for t in tds if t and t != "+"]

        if len(tds) < 2:
            continue

        # 1列目をターゲットアイテム名とする
        target = tds[0]

        for cell in tds:
            # 「素材名 × 個数」の形式を探す
            if "×" in cell:
                try:
                    name, qty = cell.split("×")
                    name = name.strip()
                    # 数字以外の文字が混じっている場合を考慮して抽出
                    qty_match = re.search(r'\d+', qty)
                    if not qty_match:
                        continue
                    qty_val = int(qty_match.group())

                    # 重複チェック（同じ素材・対象・個数の組み合わせはスキップ）
                    key = (name, target, qty_val)
                    if key in seen:
                        continue
                    seen.add(key)

                    rows.append({
                        "material": name,
                        "target": target,
                        "machine": "",
                        "rarity": "",
                        "qty": qty_val
                    })
                except Exception:
                    continue

    if not rows:
        print("警告: 抽出できるデータが見つかりませんでした。HTMLの構造が違う可能性があります。")
        return

    # CSV出力
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")

    print("-" * 30)
    print(f"完了しました！")
    print(f"出力先: {output_path}")
    print(f"合計件数: {len(rows)} 件")
    print("-" * 30)

if __name__ == "__main__":
    run_convert()