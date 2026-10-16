$ErrorActionPreference = 'Stop'
$kwArcherCardsGame = 'D:/AI/S4Game/KingdomWatch'
$kwArcherCardsPriorRecord = Get-Content -LiteralPath (Join-Path $kwArcherCardsGame 'docs/volt-vfx-enhance-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwArcherCardsPrior = $kwArcherCardsPriorRecord.stage
$kwArcherCardsWeb = Join-Path $kwArcherCardsGame 'build/web-mobile'
$kwArcherCardsStage = Join-Path $kwArcherCardsGame ('build/publish-archer-cards-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwArcherCardsStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwArcherCardsStage | Out-Null
Get-ChildItem -LiteralPath $kwArcherCardsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwArcherCardsStage -Recurse -Force
$kwArcherCardsPreviews = Join-Path $kwArcherCardsStage 'previews'
New-Item -ItemType Directory -Path $kwArcherCardsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwArcherCardsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwArcherCardsPreviews -Recurse -Force
$kwArcherCardsHtml = Get-Content -LiteralPath (Join-Path $kwArcherCardsStage 'index.html') -Raw
$kwArcherCardsVersion = [regex]::Match($kwArcherCardsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwArcherCardsVersion) { throw 'Missing rebuilt entry version' }
$kwArcherCardsRecord = [ordered]@{
    stage = $kwArcherCardsStage; priorPublishedStage = $kwArcherCardsPrior; entryVersion = $kwArcherCardsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=archer-cards-v1-' + $kwArcherCardsVersion)
    scope = 'archer four-rarity cards, attack tradeoffs, five-stack serial and fan, shared per-hero numeric cards'; layoutChanged = $false; manualAcceptance = 'pending user manual review'
}
$kwArcherCardsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwArcherCardsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwArcherCardsProxy.ProxyEnable -eq 1 -and $kwArcherCardsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwArcherCardsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwArcherCardsStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwArcherCardsRecord | ConvertTo-Json -Compress
