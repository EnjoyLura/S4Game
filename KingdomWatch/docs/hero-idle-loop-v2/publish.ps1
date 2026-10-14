$ErrorActionPreference = 'Stop'
$kwIdleLoopGame = 'D:/AI/S4Game/KingdomWatch'
$kwIdleLoopPrior = Join-Path $kwIdleLoopGame 'build/publish-hero-idle-lively-v1-20261014-003527'
$kwIdleLoopWeb = Join-Path $kwIdleLoopGame 'build/web-mobile'
$kwIdleLoopStage = Join-Path $kwIdleLoopGame ('build/publish-hero-idle-loop-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwIdleLoopStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwIdleLoopStage | Out-Null
Get-ChildItem -LiteralPath $kwIdleLoopWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwIdleLoopStage -Recurse -Force
$kwIdleLoopPreviews = Join-Path $kwIdleLoopStage 'previews'
New-Item -ItemType Directory -Path $kwIdleLoopPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwIdleLoopPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleLoopPreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwIdleLoopWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwIdleLoopPreviews -Recurse -Force
$kwIdleLoopHtml = Get-Content -LiteralPath (Join-Path $kwIdleLoopStage 'index.html') -Raw
$kwIdleLoopVersion = [regex]::Match($kwIdleLoopHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwIdleLoopVersion) { throw 'No built entry cache version in stage' }
$kwIdleLoopRecord = [ordered]@{ stage = $kwIdleLoopStage; entryVersion = $kwIdleLoopVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-idle-loop-v2-' + $kwIdleLoopVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-idle-loop-v2/?v=' + $kwIdleLoopVersion) }
$kwIdleLoopRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwIdleLoopProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwIdleLoopProxy.ProxyEnable -eq 1 -and $kwIdleLoopProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwIdleLoopProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwIdleLoopStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwIdleLoopRecord | ConvertTo-Json -Compress
