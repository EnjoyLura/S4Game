$ErrorActionPreference = 'Stop'
$kwThreatGame = 'D:/AI/S4Game/KingdomWatch'
$kwThreatPriorRecord = Get-Content -LiteralPath (Join-Path $kwThreatGame 'docs/settlement-pause-layout-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwThreatPrior = $kwThreatPriorRecord.stage
$kwThreatWeb = Join-Path $kwThreatGame 'build/web-mobile'
$kwThreatDir = Join-Path $kwThreatGame ('build/publish-boss-warning-base-modal-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwThreatDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwThreatDir | Out-Null
Get-ChildItem -LiteralPath $kwThreatWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwThreatDir -Recurse -Force
$kwThreatPreviews = Join-Path $kwThreatDir 'previews'
New-Item -ItemType Directory -Path $kwThreatPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwThreatPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwThreatPreviews -Recurse -Force
$kwThreatHtml = Get-Content -LiteralPath (Join-Path $kwThreatDir 'index.html') -Raw
$kwThreatVersion = [regex]::Match($kwThreatHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwThreatVersion) { throw 'Missing rebuilt entry version' }
$kwThreatRecord = [ordered]@{
    stage = $kwThreatDir; priorPublishedStage = $kwThreatPrior; entryVersion = $kwThreatVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=boss-warning-base-modal-v1-' + $kwThreatVersion)
    scope = 'central elite/Boss warning, persistent base upgrade/codex modal and two-second entry gate hold'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwThreatRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwThreatProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwThreatProxy.ProxyEnable -eq 1 -and $kwThreatProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwThreatProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwThreatDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwThreatRecord | ConvertTo-Json -Compress
