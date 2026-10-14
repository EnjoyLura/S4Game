$ErrorActionPreference = 'Stop'
$kwStanceGame = 'D:/AI/S4Game/KingdomWatch'
$kwStancePrior = Join-Path $kwStanceGame 'build/publish-volt-idle-v1-20261013-232927'
$kwStanceWeb = Join-Path $kwStanceGame 'build/web-mobile'
$kwStanceStage = Join-Path $kwStanceGame ('build/publish-hero-stance-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwStanceStage) { throw 'Publish stage already exists' }
New-Item -ItemType Directory -Path $kwStanceStage | Out-Null
Get-ChildItem -LiteralPath $kwStanceWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwStanceStage -Recurse -Force
$kwStancePreviews = Join-Path $kwStanceStage 'previews'
New-Item -ItemType Directory -Path $kwStancePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwStancePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwStancePreviews -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $kwStanceWeb 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwStancePreviews -Recurse -Force
$kwStanceHtml = Get-Content -LiteralPath (Join-Path $kwStanceStage 'index.html') -Raw
$kwStanceVersion = [regex]::Match($kwStanceHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwStanceVersion) { throw 'No built entry cache version in stage' }
$kwStanceRecord = [ordered]@{ stage = $kwStanceStage; entryVersion = $kwStanceVersion; project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-stance-v1-' + $kwStanceVersion); preview = ('https://kingdom-watch.pages.dev/previews/hero-stance-rebuild-v1/?v=' + $kwStanceVersion) }
$kwStanceRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwStanceProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwStanceProxy.ProxyEnable -eq 1 -and $kwStanceProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwStanceProxy.ProxyServer }
node 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwStanceStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Wrangler publication failed; retain the stage for retry' }
$kwStanceRecord | ConvertTo-Json -Compress
