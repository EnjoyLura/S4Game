$ErrorActionPreference = 'Stop'
$kwMetersGame = 'D:/AI/S4Game/KingdomWatch'
$kwMetersPriorRecord = Get-Content -LiteralPath (Join-Path $kwMetersGame 'docs/pause-comic-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwMetersPrior = $kwMetersPriorRecord.stage
$kwMetersWeb = Join-Path $kwMetersGame 'build/web-mobile'
$kwMetersStage = Join-Path $kwMetersGame ('build/publish-battle-meters-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwMetersStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwMetersStage | Out-Null
Get-ChildItem -LiteralPath $kwMetersWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwMetersStage -Recurse -Force
$kwMetersPreviews = Join-Path $kwMetersStage 'previews'
New-Item -ItemType Directory -Path $kwMetersPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwMetersPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwMetersPreviews -Recurse -Force
$kwMetersHtml = Get-Content -LiteralPath (Join-Path $kwMetersStage 'index.html') -Raw
$kwMetersVersion = [regex]::Match($kwMetersHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwMetersVersion) { throw 'Missing rebuilt entry version' }
$kwMetersRecord = [ordered]@{
    stage = $kwMetersStage; priorPublishedStage = $kwMetersPrior; entryVersion = $kwMetersVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=battle-meters-v1-' + $kwMetersVersion)
    scope = 'battle progress bars and shield display'; layoutChanged = $true; visualAcceptance = 'pending user manual review'
}
$kwMetersRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwMetersProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwMetersProxy.ProxyEnable -eq 1 -and $kwMetersProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwMetersProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwMetersStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwMetersRecord | ConvertTo-Json -Compress
