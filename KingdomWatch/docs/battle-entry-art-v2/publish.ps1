$ErrorActionPreference = 'Stop'
$kwEntryArtGame = 'D:/AI/S4Game/KingdomWatch'
$kwEntryArtPriorRecord = Get-Content -LiteralPath (Join-Path $kwEntryArtGame 'docs/stage-xp-flow-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwEntryArtPrior = $kwEntryArtPriorRecord.stage
$kwEntryArtWeb = Join-Path $kwEntryArtGame 'build/web-mobile'
$kwEntryArtDir = Join-Path $kwEntryArtGame ('build/publish-battle-entry-art-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwEntryArtDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwEntryArtDir | Out-Null
Get-ChildItem -LiteralPath $kwEntryArtWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwEntryArtDir -Recurse -Force
$kwEntryArtPreviews = Join-Path $kwEntryArtDir 'previews'
New-Item -ItemType Directory -Path $kwEntryArtPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwEntryArtPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwEntryArtPreviews -Recurse -Force
$kwEntryArtHtml = Get-Content -LiteralPath (Join-Path $kwEntryArtDir 'index.html') -Raw
$kwEntryArtVersion = [regex]::Match($kwEntryArtHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwEntryArtVersion) { throw 'Missing rebuilt entry version' }
$kwEntryArtRecord = [ordered]@{
    stage = $kwEntryArtDir; priorPublishedStage = $kwEntryArtPrior; entryVersion = $kwEntryArtVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=battle-entry-art-v2-' + $kwEntryArtVersion)
    scope = 'battle entry art, meteor/picker feedback'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwEntryArtRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwEntryArtProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwEntryArtProxy.ProxyEnable -eq 1 -and $kwEntryArtProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwEntryArtProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwEntryArtDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwEntryArtRecord | ConvertTo-Json -Compress
