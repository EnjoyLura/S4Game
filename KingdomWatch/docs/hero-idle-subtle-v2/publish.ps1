$ErrorActionPreference = 'Stop'
$kwSubtleGame = 'D:/AI/S4Game/KingdomWatch'
$kwSubtlePrior = Join-Path $kwSubtleGame 'build/publish-hero-stance-v1-20261013-235415'
$kwSubtleWeb = Join-Path $kwSubtleGame 'build/web-mobile'
$kwSubtleStage = Join-Path $kwSubtleGame ('build/publish-hero-idle-subtle-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwSubtleStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwSubtleStage | Out-Null
Get-ChildItem -LiteralPath $kwSubtleWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwSubtleStage -Recurse -Force
$kwSubtlePreviews = Join-Path $kwSubtleStage 'previews'
New-Item -ItemType Directory -Path $kwSubtlePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwSubtlePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSubtlePreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwSubtleWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSubtlePreviews -Recurse -Force
$kwSubtleHtml = Get-Content -LiteralPath (Join-Path $kwSubtleStage 'index.html') -Raw
$kwSubtleVersion = [regex]::Match($kwSubtleHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwSubtleVersion) { throw 'No built entry cache version in stage' }
$kwSubtleRecord = [ordered]@{ stage = $kwSubtleStage; entryVersion = $kwSubtleVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-subtle-v2-' + $kwSubtleVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-subtle-v2/?v=' + $kwSubtleVersion) }
$kwSubtleRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwSubtleProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwSubtleProxy.ProxyEnable -eq 1 -and $kwSubtleProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwSubtleProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwSubtleStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwSubtleRecord | ConvertTo-Json -Compress
