$ErrorActionPreference = 'Stop'
$kwSettlementGame = 'D:/AI/S4Game/KingdomWatch'
$kwSettlementPriorRecord = Get-Content -LiteralPath (Join-Path $kwSettlementGame 'docs/battle-entry-art-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwSettlementPrior = $kwSettlementPriorRecord.stage
$kwSettlementWeb = Join-Path $kwSettlementGame 'build/web-mobile'
$kwSettlementDir = Join-Path $kwSettlementGame ('build/publish-settlement-pause-layout-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwSettlementDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwSettlementDir | Out-Null
Get-ChildItem -LiteralPath $kwSettlementWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwSettlementDir -Recurse -Force
$kwSettlementPreviews = Join-Path $kwSettlementDir 'previews'
New-Item -ItemType Directory -Path $kwSettlementPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwSettlementPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSettlementPreviews -Recurse -Force
$kwSettlementHtml = Get-Content -LiteralPath (Join-Path $kwSettlementDir 'index.html') -Raw
$kwSettlementVersion = [regex]::Match($kwSettlementHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwSettlementVersion) { throw 'Missing rebuilt entry version' }
$kwSettlementRecord = [ordered]@{
    stage = $kwSettlementDir; priorPublishedStage = $kwSettlementPrior; entryVersion = $kwSettlementVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=settlement-pause-layout-v2-' + $kwSettlementVersion)
    scope = 'settlement controls, current-level retry, pause spacing, comic outpost gate, picker response and targeting range'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwSettlementRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwSettlementProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwSettlementProxy.ProxyEnable -eq 1 -and $kwSettlementProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwSettlementProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwSettlementDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwSettlementRecord | ConvertTo-Json -Compress
