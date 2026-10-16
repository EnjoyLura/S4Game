$ErrorActionPreference = 'Stop'
$kwTapSpringGame = 'D:/AI/S4Game/KingdomWatch'
$kwTapSpringPriorRecord = Get-Content -LiteralPath (Join-Path $kwTapSpringGame 'docs/combat-audio-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwTapSpringPrior = $kwTapSpringPriorRecord.stage
$kwTapSpringWeb = Join-Path $kwTapSpringGame 'build/web-mobile'
$kwTapSpringStage = Join-Path $kwTapSpringGame ('build/publish-tap-spring-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwTapSpringStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwTapSpringStage | Out-Null
Get-ChildItem -LiteralPath $kwTapSpringWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwTapSpringStage -Recurse -Force
$kwTapSpringPreviews = Join-Path $kwTapSpringStage 'previews'
New-Item -ItemType Directory -Path $kwTapSpringPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwTapSpringPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwTapSpringPreviews -Recurse -Force
$kwTapSpringHtml = Get-Content -LiteralPath (Join-Path $kwTapSpringStage 'index.html') -Raw
$kwTapSpringVersion = [regex]::Match($kwTapSpringHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwTapSpringVersion) { throw 'Missing rebuilt entry version' }
$kwTapSpringRecord = [ordered]@{
    stage = $kwTapSpringStage; priorPublishedStage = $kwTapSpringPrior; entryVersion = $kwTapSpringVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=tap-spring-v2-' + $kwTapSpringVersion)
    scope = 'whole-game tap feedback and elastic buttons without whitening'; layoutChanged = $false; interactionAcceptance = 'pending user manual review'
}
$kwTapSpringRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwTapSpringProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwTapSpringProxy.ProxyEnable -eq 1 -and $kwTapSpringProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwTapSpringProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwTapSpringStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwTapSpringRecord | ConvertTo-Json -Compress








