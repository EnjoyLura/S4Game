$ErrorActionPreference = 'Stop'
$kwCleanGame = 'D:/AI/S4Game/KingdomWatch'
$kwCleanPrevious = Join-Path $kwCleanGame 'build/publish-hero-attack-natural-v1-20261014-100137'
$kwCleanStage = Join-Path $kwCleanGame ('build/publish-sniper-attack-clean-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$kwCleanVersion = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
if (Test-Path -LiteralPath $kwCleanStage) { throw 'Preview stage already exists' }
New-Item -ItemType Directory -Path $kwCleanStage | Out-Null
Get-ChildItem -LiteralPath $kwCleanPrevious -Force | Copy-Item -Destination $kwCleanStage -Recurse -Force
$kwCleanPreview = Join-Path $kwCleanStage 'previews/sniper-attack-clean-v1'
New-Item -ItemType Directory -Path $kwCleanPreview | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'preview.html') -Destination (Join-Path $kwCleanPreview 'index.html')
foreach ($kwCleanFile in @('attack.png','attack.frames.json','attack-mirror.gif','attack-cleaned.mp4','comparison.mp4','comparison.gif','original.png','original-1.png','original.frames.json','processing.json','packaging.json')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $kwCleanFile) -Destination (Join-Path $kwCleanPreview $kwCleanFile)
}
foreach ($kwCleanOldPage in @('sniper-idle-loop-close-v1/index.html','hero-attack-natural-v1/index.html')) {
    $kwCleanOldTarget = Join-Path (Join-Path $kwCleanStage 'previews') $kwCleanOldPage
    if (Test-Path -LiteralPath $kwCleanOldTarget) {
        $kwCleanOldHtml = Get-Content -LiteralPath $kwCleanOldTarget -Raw -Encoding utf8
        $kwCleanOldHtml = $kwCleanOldHtml.Replace('<main>', '<main><p><a href="../sniper-attack-clean-v1/">查看重弩手攻击去枪焰与烟尘的对照预览</a></p>')
        [System.IO.File]::WriteAllText($kwCleanOldTarget, $kwCleanOldHtml, [System.Text.UTF8Encoding]::new($false))
    }
}
$kwCleanRecord = [ordered]@{ stage = $kwCleanStage; preservedGameStage = $kwCleanPrevious; version = $kwCleanVersion; previewOnly = $true; gameAttackChanged = $false; project = 'kingdom-watch'; branch = 'main'; preview = ('https://kingdom-watch.pages.dev/previews/sniper-attack-clean-v1/?v=' + $kwCleanVersion) }
$kwCleanRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwCleanProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwCleanProxy.ProxyEnable -eq 1 -and $kwCleanProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwCleanProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwCleanStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Preview publication failed; keep stage for retry' }
$kwCleanRecord | ConvertTo-Json -Compress
