$ErrorActionPreference = 'Stop'
$kwIdleCapeGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleCapePrior = Join-Path $kwIdleCapeGame 'build/publish-hero-idle-loop-v2-20261014-004558'
$kwIdleCapeWeb = Join-Path $kwIdleCapeGame 'build/web-mobile'
$kwIdleCapeStage = Join-Path $kwIdleCapeGame ('build/publish-hero-idle-cape-fix-v3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleCapeStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleCapeStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleCapeWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleCapeStage -Recurse -Force
$kwIdleCapePreviews = Join-Path $kwIdleCapeStage 'previews'
New-Item -ItemType Directory -Path $kwIdleCapePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleCapePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleCapePreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleCapeWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleCapePreviews -Recurse -Force
$kwIdleCapeHtml = Get-Content -LiteralPath (Join-Path $kwIdleCapeStage 'index.html') -Raw
$kwIdleCapeVersion = [regex]::Match($kwIdleCapeHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleCapeVersion) { throw 'No built entry cache version in stage' }
$kwIdleCapeRecord = [ordered]@{ stage = $kwIdleCapeStage; entryVersion = $kwIdleCapeVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-cape-fix-v3-' + $kwIdleCapeVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-cape-fix-v3/?v=' + $kwIdleCapeVersion) }
$kwIdleCapeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleCapeProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleCapeProxy.ProxyEnable -eq 1 -and $kwIdleCapeProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleCapeProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleCapeStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleCapeRecord | ConvertTo-Json -Compress
