$ErrorActionPreference = 'Stop'
$kwVoltVfxGame = 'D:/AI/S4Game/KingdomWatch'
$kwVoltVfxPriorRecord = Get-Content -LiteralPath (Join-Path $kwVoltVfxGame 'docs/dual-base-damage-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwVoltVfxPrior = $kwVoltVfxPriorRecord.stage
$kwVoltVfxWeb = Join-Path $kwVoltVfxGame 'build/web-mobile'
$kwVoltVfxStage = Join-Path $kwVoltVfxGame ('build/publish-volt-vfx-enhance-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwVoltVfxStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwVoltVfxStage | Out-Null
Get-ChildItem -LiteralPath $kwVoltVfxWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwVoltVfxStage -Recurse -Force
$kwVoltVfxPreviews = Join-Path $kwVoltVfxStage 'previews'
New-Item -ItemType Directory -Path $kwVoltVfxPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwVoltVfxPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwVoltVfxPreviews -Recurse -Force
$kwVoltVfxHtml = Get-Content -LiteralPath (Join-Path $kwVoltVfxStage 'index.html') -Raw
$kwVoltVfxVersion = [regex]::Match($kwVoltVfxHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwVoltVfxVersion) { throw 'Missing rebuilt entry version' }
$kwVoltVfxRecord = [ordered]@{
    stage = $kwVoltVfxStage; priorPublishedStage = $kwVoltVfxPrior; entryVersion = $kwVoltVfxVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=volt-vfx-enhance-v1-' + $kwVoltVfxVersion)
    scope = 'procedural Volt normal projectile, chain lightning and ultimate thunder effects'; layoutChanged = $false; manualAcceptance = 'pending user manual review'
}
$kwVoltVfxRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwVoltVfxProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwVoltVfxProxy.ProxyEnable -eq 1 -and $kwVoltVfxProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwVoltVfxProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwVoltVfxStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwVoltVfxRecord | ConvertTo-Json -Compress
