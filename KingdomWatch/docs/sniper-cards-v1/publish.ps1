$ErrorActionPreference = 'Stop'
$kwSniperCardsGame = 'D:/AI/S4Game/KingdomWatch'
$kwSniperCardsPriorRecord = Get-Content -LiteralPath (Join-Path $kwSniperCardsGame 'docs/archer-cards-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwSniperCardsPrior = $kwSniperCardsPriorRecord.stage
$kwSniperCardsWeb = Join-Path $kwSniperCardsGame 'build/web-mobile'
$kwSniperCardsStage = Join-Path $kwSniperCardsGame ('build/publish-sniper-cards-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwSniperCardsStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwSniperCardsStage | Out-Null
Get-ChildItem -LiteralPath $kwSniperCardsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwSniperCardsStage -Recurse -Force
$kwSniperCardsPreviews = Join-Path $kwSniperCardsStage 'previews'
New-Item -ItemType Directory -Path $kwSniperCardsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwSniperCardsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSniperCardsPreviews -Recurse -Force
$kwSniperCardsHtml = Get-Content -LiteralPath (Join-Path $kwSniperCardsStage 'index.html') -Raw
$kwSniperCardsVersion = [regex]::Match($kwSniperCardsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwSniperCardsVersion) { throw 'Missing rebuilt entry version' }
$kwSniperCardsRecord = [ordered]@{
    stage = $kwSniperCardsStage; priorPublishedStage = $kwSniperCardsPrior; entryVersion = $kwSniperCardsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=sniper-cards-v1-' + $kwSniperCardsVersion)
    scope = 'sniper card rarities, skill range and piercing, 30 percent ultimate vulnerability with overhead red reticle, three generated icons'; layoutChanged = $false; manualAcceptance = 'pending user manual review'
}
$kwSniperCardsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwSniperCardsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwSniperCardsProxy.ProxyEnable -eq 1 -and $kwSniperCardsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwSniperCardsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwSniperCardsStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwSniperCardsRecord | ConvertTo-Json -Compress
