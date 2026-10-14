$ErrorActionPreference = 'Stop'
$kwIdleFlowGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleFlowPrior = Join-Path $kwIdleFlowGame 'build/publish-hero-idle-full-v4-20261014-012234'
$kwIdleFlowWeb = Join-Path $kwIdleFlowGame 'build/web-mobile'
$kwIdleFlowStage = Join-Path $kwIdleFlowGame ('build/publish-hero-idle-flow-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleFlowStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleFlowStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleFlowWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleFlowStage -Recurse -Force
$kwIdleFlowPreviews = Join-Path $kwIdleFlowStage 'previews'
New-Item -ItemType Directory -Path $kwIdleFlowPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleFlowPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleFlowPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleFlowWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleFlowPreviews -Recurse -Force
$kwIdleFlowHtml = Get-Content -LiteralPath (Join-Path $kwIdleFlowStage 'index.html') -Raw
$kwIdleFlowVersion = [regex]::Match($kwIdleFlowHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleFlowVersion) { throw 'No built entry cache version in stage' }
$kwIdleFlowRecord = [ordered]@{ stage = $kwIdleFlowStage; entryVersion = $kwIdleFlowVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-flow-v1-' + $kwIdleFlowVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-flow-v1/?v=' + $kwIdleFlowVersion) }
$kwIdleFlowRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleFlowProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleFlowProxy.ProxyEnable -eq 1 -and $kwIdleFlowProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleFlowProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleFlowStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleFlowRecord | ConvertTo-Json -Compress
