$ErrorActionPreference = 'Stop'
$kwIdleFullGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleFullPrior = Join-Path $kwIdleFullGame 'build/publish-hero-idle-cape-fix-v3-20261014-005411'
$kwIdleFullWeb = Join-Path $kwIdleFullGame 'build/web-mobile'
$kwIdleFullStage = Join-Path $kwIdleFullGame ('build/publish-hero-idle-full-v4-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleFullStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleFullStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleFullWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleFullStage -Recurse -Force
$kwIdleFullPreviews = Join-Path $kwIdleFullStage 'previews'
New-Item -ItemType Directory -Path $kwIdleFullPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleFullPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleFullPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleFullWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleFullPreviews -Recurse -Force
$kwIdleFullHtml = Get-Content -LiteralPath (Join-Path $kwIdleFullStage 'index.html') -Raw
$kwIdleFullVersion = [regex]::Match($kwIdleFullHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleFullVersion) { throw 'No built entry cache version in stage' }
$kwIdleFullRecord = [ordered]@{ stage = $kwIdleFullStage; entryVersion = $kwIdleFullVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-full-v4-' + $kwIdleFullVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-full-v4/?v=' + $kwIdleFullVersion) }
$kwIdleFullRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleFullProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleFullProxy.ProxyEnable -eq 1 -and $kwIdleFullProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleFullProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleFullStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleFullRecord | ConvertTo-Json -Compress
