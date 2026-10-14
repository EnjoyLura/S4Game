$ErrorActionPreference = 'Stop'
$kwLaunchProceduralGame = 'D:/AI/S4Game/KingdomWatch'
$kwLaunchProceduralPriorRecord = Get-Content -LiteralPath (Join-Path $kwLaunchProceduralGame 'docs/shield-projectile-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwLaunchProceduralPrior = $kwLaunchProceduralPriorRecord.stage
$kwLaunchProceduralWeb = Join-Path $kwLaunchProceduralGame 'build/web-mobile'
$kwLaunchProceduralStage = Join-Path $kwLaunchProceduralGame ('build/publish-basic-launch-procedural-v3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwLaunchProceduralStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwLaunchProceduralStage | Out-Null
Get-ChildItem -LiteralPath $kwLaunchProceduralWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwLaunchProceduralStage -Recurse -Force
$kwLaunchProceduralPreviews = Join-Path $kwLaunchProceduralStage 'previews'
New-Item -ItemType Directory -Path $kwLaunchProceduralPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwLaunchProceduralPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwLaunchProceduralPreviews -Recurse -Force
$kwLaunchProceduralHtml = Get-Content -LiteralPath (Join-Path $kwLaunchProceduralStage 'index.html') -Raw
$kwLaunchProceduralVersion = [regex]::Match($kwLaunchProceduralHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwLaunchProceduralVersion) { throw 'Missing rebuilt entry version' }
$kwLaunchProceduralRecord = [ordered]@{
    stage = $kwLaunchProceduralStage; priorPublishedStage = $kwLaunchProceduralPrior; entryVersion = $kwLaunchProceduralVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=basic-launch-procedural-v3-' + $kwLaunchProceduralVersion)
    scope = 'procedural basic releases, measured status icons and right-anchored shield depletion'; layoutChanged = $true; visualAcceptance = 'pending user manual review'
}
$kwLaunchProceduralRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwLaunchProceduralProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwLaunchProceduralProxy.ProxyEnable -eq 1 -and $kwLaunchProceduralProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwLaunchProceduralProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwLaunchProceduralStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwLaunchProceduralRecord | ConvertTo-Json -Compress

