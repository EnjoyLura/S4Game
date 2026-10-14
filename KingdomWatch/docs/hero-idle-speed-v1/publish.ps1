$ErrorActionPreference = 'Stop'
$kwIdleSpeedGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleSpeedPrior = Join-Path $kwIdleSpeedGame 'build/publish-hero-idle-subtle-v2-20261014-001155'
$kwIdleSpeedWeb = Join-Path $kwIdleSpeedGame 'build/web-mobile'
$kwIdleSpeedStage = Join-Path $kwIdleSpeedGame ('build/publish-hero-idle-speed-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleSpeedStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleSpeedStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleSpeedWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleSpeedStage -Recurse -Force
$kwIdleSpeedPreviews = Join-Path $kwIdleSpeedStage 'previews'
New-Item -ItemType Directory -Path $kwIdleSpeedPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleSpeedPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleSpeedPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleSpeedWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleSpeedPreviews -Recurse -Force
$kwIdleSpeedHtml = Get-Content -LiteralPath (Join-Path $kwIdleSpeedStage 'index.html') -Raw
$kwIdleSpeedVersion = [regex]::Match($kwIdleSpeedHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleSpeedVersion) { throw 'No built entry cache version in stage' }
$kwIdleSpeedRecord = [ordered]@{ stage = $kwIdleSpeedStage; entryVersion = $kwIdleSpeedVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-speed-v1-' + $kwIdleSpeedVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-subtle-v2/?v=' + $kwIdleSpeedVersion) }
$kwIdleSpeedRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleSpeedProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleSpeedProxy.ProxyEnable -eq 1 -and $kwIdleSpeedProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleSpeedProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleSpeedStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleSpeedRecord | ConvertTo-Json -Compress
