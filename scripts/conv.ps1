# ファイル読み込み
$html = Get-Content ".\wikiALL.html" -Raw

# HTMLパース（COM）
$doc = New-Object -ComObject "HTMLFile"
$doc.IHTMLDocument2_write($html)

# テーブル取得
$tables = $doc.getElementsByTagName("table")

$result = @()

foreach ($table in $tables) {
    $rows = $table.getElementsByTagName("tr")

    foreach ($row in $rows) {
        $cells = $row.getElementsByTagName("td")

        if ($cells.length -gt 1) {
            $text = ($cells | ForEach-Object { $_.innerText.Trim() }) -join "|"

            # レシピ行っぽいやつだけ抽出
            if ($text -match "×") {
                $result += $text
            }
        }
    }
}

# 出力
$result | Out-File ".\raw1.txt"