$ErrorActionPreference = 'Stop'
$kwIdleLivelyGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleLivelyPrior = Join-Path $kwIdleLivelyGame 'build/publish-hero-idle-speed-v1-20261014-001858'
$kwIdleLivelyWeb = Join-Path $kwIdleLivelyGame 'build/web-mobile'
$kwIdleLivelyStage = Join-Path $kwIdleLivelyGame ('build/publish-hero-idle-lively-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleLivelyStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleLivelyStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleLivelyWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleLivelyStage -Recurse -Force
$kwIdleLivelyPreviews = Join-Path $kwIdleLivelyStage 'previews'
New-Item -ItemType Directory -Path $kwIdleLivelyPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleLivelyPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleLivelyPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleLivelyWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleLivelyPreviews -Recurse -Force
$kwIdleLivelyHtml = Get-Content -LiteralPath (Join-Path $kwIdleLivelyStage 'index.html') -Raw
$kwIdleLivelyVersion = [regex]::Match($kwIdleLivelyHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleLivelyVersion) { throw 'No built entry cache version in stage' }
$kwIdleLivelyRecord = [ordered]@{ stage = $kwIdleLivelyStage; entryVersion = $kwIdleLivelyVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-lively-v1-' + $kwIdleLivelyVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-lively-v1/?v=' + $kwIdleLivelyVersion) }
$kwIdleLivelyRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleLivelyProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleLivelyProxy.ProxyEnable -eq 1 -and $kwIdleLivelyProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleLivelyProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleLivelyStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleLivelyRecord | ConvertTo-Json -Compress
