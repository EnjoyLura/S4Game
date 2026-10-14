$ErrorActionPreference = 'Stop'
$kwPauseGame = 'D:/AI/S4Game/KingdomWatch'
$kwPausePriorRecord = Get-Content -LiteralPath (Join-Path $kwPauseGame 'docs/volt-attack-user-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwPausePrior = $kwPausePriorRecord.stage
$kwPauseWeb = Join-Path $kwPauseGame 'build/web-mobile'
$kwPauseStage = Join-Path $kwPauseGame ('build/publish-pause-comic-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwPauseStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwPauseStage | Out-Null
Get-ChildItem -LiteralPath $kwPauseWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwPauseStage -Recurse -Force
$kwPausePreviews = Join-Path $kwPauseStage 'previews'
New-Item -ItemType Directory -Path $kwPausePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwPausePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwPausePreviews -Recurse -Force
$kwPauseHtml = Get-Content -LiteralPath (Join-Path $kwPauseStage 'index.html') -Raw
$kwPauseVersion = [regex]::Match($kwPauseHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwPauseVersion) { throw 'Missing rebuilt entry version' }
$kwPauseRecord = [ordered]@{
    stage = $kwPauseStage; priorPublishedStage = $kwPausePrior; entryVersion = $kwPauseVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=pause-comic-v1-' + $kwPauseVersion)
    scope = 'pause menu art only'; layoutChanged = $false; visualAcceptance = 'pending user manual review'
}
$kwPauseRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwPauseProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwPauseProxy.ProxyEnable -eq 1 -and $kwPauseProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwPauseProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwPauseStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwPauseRecord | ConvertTo-Json -Compress
