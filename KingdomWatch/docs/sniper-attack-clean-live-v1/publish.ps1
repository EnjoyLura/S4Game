$ErrorActionPreference = 'Stop'
$kwCleanLiveGame = 'D:/AI/S4Game/KingdomWatch'
$kwCleanLivePrior = Join-Path $kwCleanLiveGame 'build/publish-sniper-attack-clean-v1-20261014-124050'
$kwCleanLiveWeb = Join-Path $kwCleanLiveGame 'build/web-mobile'
$kwCleanLiveStage = Join-Path $kwCleanLiveGame ('build/publish-sniper-attack-clean-live-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwCleanLiveStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwCleanLiveStage | Out-Null
Get-ChildItem -LiteralPath $kwCleanLiveWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwCleanLiveStage -Recurse -Force
$kwCleanLivePreviews = Join-Path $kwCleanLiveStage 'previews'
New-Item -ItemType Directory -Path $kwCleanLivePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwCleanLivePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwCleanLivePreviews -Recurse -Force
# Only copy this request's updated preview; old pages come from the latest published stage.
Copy-Item -LiteralPath (Join-Path $kwCleanLiveWeb 'previews/sniper-attack-clean-v1') -Destination $kwCleanLivePreviews -Recurse -Force
$kwCleanLiveHtml = Get-Content -LiteralPath (Join-Path $kwCleanLiveStage 'index.html') -Raw
$kwCleanLiveVersion = [regex]::Match($kwCleanLiveHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwCleanLiveVersion) { throw 'No rebuilt cache entry version in stage' }
$kwCleanLiveRecord = [ordered]@{ stage = $kwCleanLiveStage; entryVersion = $kwCleanLiveVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=sniper-attack-clean-live-v1-' + $kwCleanLiveVersion); preview = ('https://kingdom-watch.pages.dev/previews/sniper-attack-clean-v1/?v=' + $kwCleanLiveVersion) }
$kwCleanLiveRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwCleanLiveProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwCleanLiveProxy.ProxyEnable -eq 1 -and $kwCleanLiveProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwCleanLiveProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwCleanLiveStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; preserve stage for retry' }
$kwCleanLiveRecord | ConvertTo-Json -Compress
