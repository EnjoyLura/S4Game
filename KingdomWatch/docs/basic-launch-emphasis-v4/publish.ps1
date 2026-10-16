$ErrorActionPreference = 'Stop'
$kwLaunchEmphasisGame = 'D:/AI/S4Game/KingdomWatch'
$kwLaunchEmphasisPriorRecord = Get-Content -LiteralPath (Join-Path $kwLaunchEmphasisGame 'docs/audio-upgrade-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwLaunchEmphasisPrior = $kwLaunchEmphasisPriorRecord.stage
$kwLaunchEmphasisWeb = Join-Path $kwLaunchEmphasisGame 'build/web-mobile'
$kwLaunchEmphasisStage = Join-Path $kwLaunchEmphasisGame ('build/publish-basic-launch-emphasis-v4-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwLaunchEmphasisStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwLaunchEmphasisStage | Out-Null
Get-ChildItem -LiteralPath $kwLaunchEmphasisWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwLaunchEmphasisStage -Recurse -Force
$kwLaunchEmphasisPreviews = Join-Path $kwLaunchEmphasisStage 'previews'
New-Item -ItemType Directory -Path $kwLaunchEmphasisPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwLaunchEmphasisPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwLaunchEmphasisPreviews -Recurse -Force
$kwLaunchEmphasisHtml = Get-Content -LiteralPath (Join-Path $kwLaunchEmphasisStage 'index.html') -Raw
$kwLaunchEmphasisVersion = [regex]::Match($kwLaunchEmphasisHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwLaunchEmphasisVersion) { throw 'Missing rebuilt entry version' }
$kwLaunchEmphasisRecord = [ordered]@{
    stage = $kwLaunchEmphasisStage; priorPublishedStage = $kwLaunchEmphasisPrior; entryVersion = $kwLaunchEmphasisVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=basic-launch-emphasis-v4-' + $kwLaunchEmphasisVersion)
    scope = 'larger brighter procedural basic attack releases'; layoutChanged = $false; visualAcceptance = 'pending user manual review'
}
$kwLaunchEmphasisRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwLaunchEmphasisProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwLaunchEmphasisProxy.ProxyEnable -eq 1 -and $kwLaunchEmphasisProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwLaunchEmphasisProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwLaunchEmphasisStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwLaunchEmphasisRecord | ConvertTo-Json -Compress



