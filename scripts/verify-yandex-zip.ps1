# Проверка build/yandex.zip перед загрузкой в Консоль Яндекс Игр.
# 1) В архиве не должно быть URL внутреннего хранилища Яндекса (yandex.net / s3. / sdk.games)
#    даже в комментариях (модерация: «Файл содержит URL-адрес внутреннего хранилища сервиса»).
# 2) В index.html должен быть тег <script src="/sdk.js"> (п. 1.1 — SDK встроен по официальной схеме).
# 3) В js/platform-sdk.js не должно быть абсолютных URL на S3.
# 4) В архиве не должно быть слов «pirat/pirate/Пират/пират» (полный ребрендинг — «Океан 2048»).
param(
    [string]$ZipPath = (Join-Path $PSScriptRoot '..\build\yandex.zip')
)

Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipPath))
try {
    $bad = [System.Collections.Generic.List[string]]::new()
    $sdkTag = $false
    $sdkAbsolute = [System.Collections.Generic.List[string]]::new()
    $pirateWords = [System.Collections.Generic.List[string]]::new()
    # Паттерн без кириллицы в исходнике (файл UTF-8 без BOM, PS 5.1 читает как ANSI):
    # Пират|пират собираем из char-кодов.
    $pirRe = 'pirat|pirate|' + [char]0x041F + [char]0x0438 + [char]0x0440 + [char]0x0430 + [char]0x0442 + '|' + [char]0x043F + [char]0x0438 + [char]0x0440 + [char]0x0430 + [char]0x0442

    # Текстовые расширения, которые сканируем на URL/слова. Бинарные файлы
    # (mp3/png/jpg/...) пропускаем: их байты дают ложные срабатывания на
    # паттерны вида "s3." (модерация ищет URL в тексте, а не байты в медиа).
    $textExts = @('.html', '.js', '.mjs', '.css', '.json', '.txt', '.webmanifest', '.md', '.xml', '.svg')

    foreach ($e in $zip.Entries) {
        if ($e.FullName -like '*/') { continue }
        $ext = [System.IO.Path]::GetExtension($e.Name).ToLowerInvariant()
        if ($ext -notin $textExts) { continue }
        $s = ''
        $sr = New-Object System.IO.StreamReader($e.Open())
        try { $s = $sr.ReadToEnd() } finally { $sr.Close() }

        if ($s -match 'yandex\.net|s3[.\-]|sdk\.games') {
            $bad.Add($e.FullName)
        }
        if ($e.Name -eq 'index.html' -and $s -match '<script[^>]*src="/sdk\.js"') {
            $sdkTag = $true
        }
        if ($e.FullName -eq 'js/platform-sdk.js' -and $s -match 'sdk\.games\.s3\.yandex\.net') {
            $sdkAbsolute.Add($e.FullName)
        }
        if ($s -match $pirRe) {
            $pirateWords.Add($e.FullName)
        }
    }

    Write-Output ('ZIP: ' + (Resolve-Path $ZipPath))
    Write-Output ('Bad URL entries (yandex.net / s3. / sdk.games): ' + $(if ($bad.Count -eq 0) { 'NONE - CLEAN' } else { $bad -join ', ' }))
    Write-Output ('/sdk.js tag in index.html: ' + $sdkTag)
    Write-Output ('Absolute S3 URL in platform-sdk.js: ' + $(if ($sdkAbsolute.Count -eq 0) { 'NONE - CLEAN' } else { $sdkAbsolute -join ', ' }))
    Write-Output ('Pirate words (pirat/pirate/Pirat/pirat): ' + $(if ($pirateWords.Count -eq 0) { 'NONE - CLEAN' } else { $pirateWords -join ', ' }))

    $ok = $bad.Count -eq 0 -and $sdkAbsolute.Count -eq 0 -and $pirateWords.Count -eq 0 -and $sdkTag
    Write-Output ('RESULT: ' + $(if ($ok) { 'PASS' } else { 'FAIL' }))
    if (-not $ok) { exit 1 }
}
finally {
    $zip.Dispose()
}
