$ErrorActionPreference = 'Stop'
$kwHeroAttackGame = 'D:/AI/S4Game/KingdomWatch'
$kwHeroAttackPrior = Join-Path $kwHeroAttackGame 'build/publish-hero-attack-natural-v1-20261014-100137'
$kwHeroAttackWeb = Join-Path $kwHeroAttackGame 'build/web-mobile'
$kwHeroAttackStage = Join-Path $kwHeroAttackGame ('build/publish-hero-attack-choreography-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwHeroAttackStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwHeroAttackStage | Out-Null
Get-ChildItem -LiteralPath $kwHeroAttackWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwHeroAttackStage -Recurse -Force
$kwHeroAttackPreviews = Join-Path $kwHeroAttackStage 'previews'
New-Item -ItemType Directory -Path $kwHeroAttackPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwHeroAttackPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwHeroAttackPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwHeroAttackWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwHeroAttackPreviews -Recurse -Force
$kwHeroAttackPriorPage = Join-Path $kwHeroAttackPreviews 'hero-attack-natural-v1/index.html'
if (Test-Path -LiteralPath $kwHeroAttackPriorPage) {
    $kwHeroAttackPriorHtml = Get-Content -LiteralPath $kwHeroAttackPriorPage -Raw -Encoding utf8
    $kwHeroAttackPriorHtml = $kwHeroAttackPriorHtml.Replace('<main>', '<main><p><a href="../hero-attack-choreography-v2/">查看重弩手与雷法师的新攻击动作</a></p>')
    [System.IO.File]::WriteAllText($kwHeroAttackPriorPage, $kwHeroAttackPriorHtml, [System.Text.UTF8Encoding]::new($false))
}
$kwHeroAttackHtml = Get-Content -LiteralPath (Join-Path $kwHeroAttackStage 'index.html') -Raw
$kwHeroAttackVersion = [regex]::Match($kwHeroAttackHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwHeroAttackVersion) { throw 'No built cache entry version in stage' }
$kwHeroAttackRecord = [ordered]@{ stage = $kwHeroAttackStage; entryVersion = $kwHeroAttackVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-attack-choreography-v2-' + $kwHeroAttackVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-attack-choreography-v2/?v=' + $kwHeroAttackVersion) }
$kwHeroAttackRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwHeroAttackProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwHeroAttackProxy.ProxyEnable -eq 1 -and $kwHeroAttackProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwHeroAttackProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwHeroAttackStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain stage for retry' }
$kwHeroAttackRecord | ConvertTo-Json -Compress
