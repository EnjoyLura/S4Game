$ErrorActionPreference = 'Stop'
$kwStageXpGame = 'D:/AI/S4Game/KingdomWatch'
$kwStageXpPriorRecord = Get-Content -LiteralPath (Join-Path $kwStageXpGame 'docs/battle-exit-death-v3/deployment-stage.json') -Raw | ConvertFrom-Json
$kwStageXpPrior = $kwStageXpPriorRecord.stage
$kwStageXpWeb = Join-Path $kwStageXpGame 'build/web-mobile'
$kwStageXpDir = Join-Path $kwStageXpGame ('build/publish-stage-xp-flow-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwStageXpDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwStageXpDir | Out-Null
Get-ChildItem -LiteralPath $kwStageXpWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwStageXpDir -Recurse -Force
$kwStageXpPreviews = Join-Path $kwStageXpDir 'previews'
New-Item -ItemType Directory -Path $kwStageXpPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwStageXpPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwStageXpPreviews -Recurse -Force
$kwStageXpHtml = Get-Content -LiteralPath (Join-Path $kwStageXpDir 'index.html') -Raw
$kwStageXpVersion = [regex]::Match($kwStageXpHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwStageXpVersion) { throw 'Missing rebuilt entry version' }
$kwStageXpRecord = [ordered]@{
    stage = $kwStageXpDir; priorPublishedStage = $kwStageXpPrior; entryVersion = $kwStageXpVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=stage-xp-flow-v1-' + $kwStageXpVersion)
    scope = 'stage level HUD and passive XP'; layoutChanged = $false
    manualAcceptance = 'pending user manual review'
}
$kwStageXpRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwStageXpProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwStageXpProxy.ProxyEnable -eq 1 -and $kwStageXpProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwStageXpProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwStageXpDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwStageXpRecord | ConvertTo-Json -Compress
