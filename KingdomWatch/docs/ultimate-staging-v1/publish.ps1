$ErrorActionPreference = 'Stop'
$kwUltimateStageGame = 'D:/AI/S4Game/KingdomWatch'
$kwUltimateStagePriorRecord = Get-Content -LiteralPath (Join-Path $kwUltimateStageGame 'docs/volt-ground-alignment-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwUltimateStagePrior = $kwUltimateStagePriorRecord.stage
$kwUltimateStageWeb = Join-Path $kwUltimateStageGame 'build/web-mobile'
$kwUltimateStageDir = Join-Path $kwUltimateStageGame ('build/publish-ultimate-staging-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwUltimateStageDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwUltimateStageDir | Out-Null
Get-ChildItem -LiteralPath $kwUltimateStageWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwUltimateStageDir -Recurse -Force
$kwUltimateStagePreviews = Join-Path $kwUltimateStageDir 'previews'
New-Item -ItemType Directory -Path $kwUltimateStagePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwUltimateStagePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwUltimateStagePreviews -Recurse -Force
$kwUltimateStageHtml = Get-Content -LiteralPath (Join-Path $kwUltimateStageDir 'index.html') -Raw
$kwUltimateStageVersion = [regex]::Match($kwUltimateStageHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwUltimateStageVersion) { throw 'Missing rebuilt entry version' }
$kwUltimateStageRecord = [ordered]@{
    stage = $kwUltimateStageDir; priorPublishedStage = $kwUltimateStagePrior; entryVersion = $kwUltimateStageVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=ultimate-staging-v1-' + $kwUltimateStageVersion)
    scope = 'five-hero ultimate presentation and battle-clock integration'; layoutChanged = $false
    manualAcceptance = 'pending user manual review'
}
$kwUltimateStageRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwUltimateStageProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwUltimateStageProxy.ProxyEnable -eq 1 -and $kwUltimateStageProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwUltimateStageProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwUltimateStageDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwUltimateStageRecord | ConvertTo-Json -Compress
