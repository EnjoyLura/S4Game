$ErrorActionPreference = 'Stop'
$kwIdleNaturalGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleNaturalPrior = Join-Path $kwIdleNaturalGame 'build/publish-hero-idle-flow-v1-20261014-013408'
$kwIdleNaturalWeb = Join-Path $kwIdleNaturalGame 'build/web-mobile'
$kwIdleNaturalStage = Join-Path $kwIdleNaturalGame ('build/publish-hero-idle-natural-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleNaturalStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleNaturalStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleNaturalWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleNaturalStage -Recurse -Force
$kwIdleNaturalPreviews = Join-Path $kwIdleNaturalStage 'previews'
New-Item -ItemType Directory -Path $kwIdleNaturalPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleNaturalPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleNaturalPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleNaturalWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleNaturalPreviews -Recurse -Force
$kwIdleNaturalHtml = Get-Content -LiteralPath (Join-Path $kwIdleNaturalStage 'index.html') -Raw
$kwIdleNaturalVersion = [regex]::Match($kwIdleNaturalHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleNaturalVersion) { throw 'No built entry cache version in stage' }
$kwIdleNaturalRecord = [ordered]@{ stage = $kwIdleNaturalStage; entryVersion = $kwIdleNaturalVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-natural-v1-' + $kwIdleNaturalVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-natural-v1/?v=' + $kwIdleNaturalVersion) }
$kwIdleNaturalRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleNaturalProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleNaturalProxy.ProxyEnable -eq 1 -and $kwIdleNaturalProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleNaturalProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleNaturalStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleNaturalRecord | ConvertTo-Json -Compress
