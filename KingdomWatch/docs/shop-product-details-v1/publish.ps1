$ErrorActionPreference = 'Stop'
$kwShopDetailsGame = 'D:/AI/S4Game/KingdomWatch'
$kwShopDetailsPriorRecord = Get-Content -LiteralPath (Join-Path $kwShopDetailsGame 'docs/equipment-unequip-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwShopDetailsPrior = $kwShopDetailsPriorRecord.stage
$kwShopDetailsWeb = Join-Path $kwShopDetailsGame 'build/web-mobile'
$kwShopDetailsStage = Join-Path $kwShopDetailsGame ('build/publish-shop-product-details-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwShopDetailsStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwShopDetailsStage | Out-Null
Get-ChildItem -LiteralPath $kwShopDetailsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwShopDetailsStage -Recurse -Force
$kwShopDetailsPreviews = Join-Path $kwShopDetailsStage 'previews'
New-Item -ItemType Directory -Path $kwShopDetailsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwShopDetailsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwShopDetailsPreviews -Recurse -Force
$kwShopDetailsHtml = Get-Content -LiteralPath (Join-Path $kwShopDetailsStage 'index.html') -Raw
$kwShopDetailsVersion = [regex]::Match($kwShopDetailsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwShopDetailsVersion) { throw 'Missing rebuilt entry version' }
$kwShopDetailsRecord = [ordered]@{
    stage = $kwShopDetailsStage; priorPublishedStage = $kwShopDetailsPrior; entryVersion = $kwShopDetailsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=shop-product-details-v1-' + $kwShopDetailsVersion)
    scope = 'shop product icons open typed details with attributes, descriptions, quantities and purchase state'; layoutChanged = $true; interactionAcceptance = 'pending user manual review'
}
$kwShopDetailsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwShopDetailsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwShopDetailsProxy.ProxyEnable -eq 1 -and $kwShopDetailsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwShopDetailsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwShopDetailsStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwShopDetailsRecord | ConvertTo-Json -Compress
