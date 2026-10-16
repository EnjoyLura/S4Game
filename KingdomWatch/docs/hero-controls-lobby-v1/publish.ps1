$ErrorActionPreference = 'Stop'
$kwHeroControlsGame = 'D:/AI/S4Game/KingdomWatch'
$kwHeroControlsPriorRecord = Get-Content -LiteralPath (Join-Path $kwHeroControlsGame 'docs/battle-buttons-lobby-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwHeroControlsPrior = $kwHeroControlsPriorRecord.stage
$kwHeroControlsWeb = Join-Path $kwHeroControlsGame 'build/web-mobile'
$kwHeroControlsStage = Join-Path $kwHeroControlsGame ('build/publish-hero-controls-lobby-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwHeroControlsStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwHeroControlsStage | Out-Null
Get-ChildItem -LiteralPath $kwHeroControlsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwHeroControlsStage -Recurse -Force
$kwHeroControlsPreviews = Join-Path $kwHeroControlsStage 'previews'
New-Item -ItemType Directory -Path $kwHeroControlsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwHeroControlsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwHeroControlsPreviews -Recurse -Force
$kwHeroControlsHtml = Get-Content -LiteralPath (Join-Path $kwHeroControlsStage 'index.html') -Raw
$kwHeroControlsVersion = [regex]::Match($kwHeroControlsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwHeroControlsVersion) { throw 'Missing rebuilt entry version' }
$kwHeroControlsRecord = [ordered]@{
    stage = $kwHeroControlsStage; priorPublishedStage = $kwHeroControlsPrior; entryVersion = $kwHeroControlsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-controls-lobby-v1-' + $kwHeroControlsVersion)
    scope = 'hero navigation style, detail action placement and inventory tab centering'; layoutChanged = $true; visualAcceptance = 'pending user manual review'
}
$kwHeroControlsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwHeroControlsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwHeroControlsProxy.ProxyEnable -eq 1 -and $kwHeroControlsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwHeroControlsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwHeroControlsStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwHeroControlsRecord | ConvertTo-Json -Compress





