$ErrorActionPreference = 'Stop'
$kwUnequipGame = 'D:/AI/S4Game/KingdomWatch'
$kwUnequipPriorRecord = Get-Content -LiteralPath (Join-Path $kwUnequipGame 'docs/card-offer-weights-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwUnequipPrior = $kwUnequipPriorRecord.stage
$kwUnequipWeb = Join-Path $kwUnequipGame 'build/web-mobile'
$kwUnequipStage = Join-Path $kwUnequipGame ('build/publish-equipment-unequip-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwUnequipStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwUnequipStage | Out-Null
Get-ChildItem -LiteralPath $kwUnequipWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwUnequipStage -Recurse -Force
$kwUnequipPreviews = Join-Path $kwUnequipStage 'previews'
New-Item -ItemType Directory -Path $kwUnequipPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwUnequipPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwUnequipPreviews -Recurse -Force
$kwUnequipHtml = Get-Content -LiteralPath (Join-Path $kwUnequipStage 'index.html') -Raw
$kwUnequipVersion = [regex]::Match($kwUnequipHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwUnequipVersion) { throw 'Missing rebuilt entry version' }
$kwUnequipRecord = [ordered]@{
    stage = $kwUnequipStage; priorPublishedStage = $kwUnequipPrior; entryVersion = $kwUnequipVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=equipment-unequip-v1-' + $kwUnequipVersion)
    scope = 'equipped-item dialogs: unequip action with inventory, slot and hero-stat refresh'; layoutChanged = $true; interactionAcceptance = 'pending user manual review'
}
$kwUnequipRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwUnequipProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwUnequipProxy.ProxyEnable -eq 1 -and $kwUnequipProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwUnequipProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwUnequipStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwUnequipRecord | ConvertTo-Json -Compress
