$ErrorActionPreference = 'Stop'
$kwSniperLoopCloseGame = 'D:/AI/S4Game/KingdomWatch'
$kwSniperLoopClosePrior = Join-Path $kwSniperLoopCloseGame 'build/publish-hero-idle-natural-v1-20261014-014839'
$kwSniperLoopCloseWeb = Join-Path $kwSniperLoopCloseGame 'build/web-mobile'
$kwSniperLoopCloseStage = Join-Path $kwSniperLoopCloseGame ('build/publish-sniper-idle-loop-close-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwSniperLoopCloseStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwSniperLoopCloseStage | Out-Null
Get-ChildItem -LiteralPath $kwSniperLoopCloseWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwSniperLoopCloseStage -Recurse -Force
$kwSniperLoopClosePreviews = Join-Path $kwSniperLoopCloseStage 'previews'
New-Item -ItemType Directory -Path $kwSniperLoopClosePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwSniperLoopClosePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSniperLoopClosePreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwSniperLoopCloseWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSniperLoopClosePreviews -Recurse -Force
$kwSniperLoopCloseHtml = Get-Content -LiteralPath (Join-Path $kwSniperLoopCloseStage 'index.html') -Raw
$kwSniperLoopCloseVersion = [regex]::Match($kwSniperLoopCloseHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwSniperLoopCloseVersion) { throw 'No built entry cache version in stage' }
$kwSniperLoopCloseRecord = [ordered]@{ stage = $kwSniperLoopCloseStage; entryVersion = $kwSniperLoopCloseVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=sniper-idle-loop-close-v1-' + $kwSniperLoopCloseVersion); preview = ('https://kingdom-watch.pages.dev/previews/sniper-idle-loop-close-v1/?v=' + $kwSniperLoopCloseVersion) }
$kwSniperLoopCloseRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwSniperLoopCloseProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwSniperLoopCloseProxy.ProxyEnable -eq 1 -and $kwSniperLoopCloseProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwSniperLoopCloseProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwSniperLoopCloseStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwSniperLoopCloseRecord | ConvertTo-Json -Compress
