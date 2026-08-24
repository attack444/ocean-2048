# Проверка метаданных PNG (только IHDR: размер, без просмотра картинки)
# Важно: приводим байты к [int] перед -shl, иначе PowerShell обнуляет старшие байты.
param()
$files = @(
  "d:/pirat/scripts/neobrain/og-neobrain.png",
  "d:/pirat/scripts/neobrain/ill-home.png",
  "d:/pirat/scripts/neobrain/ill-uslugi.png",
  "d:/pirat/scripts/neobrain/ill-plans.png",
  "d:/pirat/scripts/covers/pixel-quest.png",
  "d:/pirat/scripts/covers/neon-racer.png",
  "d:/pirat/scripts/covers/cube-lab.png"
)
foreach ($f in $files) {
  $fs = Get-Item $f
  $bytes = [System.IO.File]::ReadAllBytes($f)
  if ($bytes.Length -ge 24 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) {
    $w = ([int]$bytes[16] -shl 24) -bor ([int]$bytes[17] -shl 16) -bor ([int]$bytes[18] -shl 8) -bor [int]$bytes[19]
    $h = ([int]$bytes[20] -shl 24) -bor ([int]$bytes[21] -shl 16) -bor ([int]$bytes[22] -shl 8) -bor [int]$bytes[23]
    Write-Output ("{0} | PNG {1}x{2} | {3:N0} bytes" -f (Split-Path $f -Leaf), $w, $h, $fs.Length)
  } else {
    Write-Output ("{0} | НЕ PNG (сигнатура не совпадает)" -f (Split-Path $f -Leaf))
  }
}
