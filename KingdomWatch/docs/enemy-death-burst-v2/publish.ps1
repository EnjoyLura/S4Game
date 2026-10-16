$ErrorActionPreference = 'Stop'
$kwDeathBurstGame = 'D:/AI/S4Game/KingdomWatch'
$kwDeathBurstPriorRecord = Get-Content -LiteralPath (Join-Path $kwDeathBurstGame 'docs/enemy-death-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwDeathBurstPrior = $kwDeathBurstPriorRecord.stage
$kwDeathBurstWeb = Join-Path $kwDeathBurstGame 'build/web-mobile'
$kwDeathBurstStage = Join-Path $kwDeathBurstGame ('build/publish-enemy-death-burst-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwDeathBurstStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwDeathBurstStage | Out-Null
Get-ChildItem -LiteralPath $kwDeathBurstWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwDeathBurstStage -Recurse -Force
$kwDeathBurstPreviews = Join-Path $kwDeathBurstStage 'previews'
New-Item -ItemType Directory -Path $kwDeathBurstPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwDeathBurstPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwDeathBurstPreviews -Recurse -Force
$kwDeathBurstHtml = Get-Content -LiteralPath (Join-Path $kwDeathBurstStage 'index.html') -Raw
$kwDeathBurstVersion = [regex]::Match($kwDeathBurstHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwDeathBurstVersion) { throw 'Missing rebuilt entry version' }
$kwDeathBurstRecord = [ordered]@{
    stage = $kwDeathBurstStage; priorPublishedStage = $kwDeathBurstPrior; entryVersion = $kwDeathBurstVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=enemy-death-burst-v2-' + $kwDeathBurstVersion)
    scope = 'in-place enemy material burst and fading ground splatter; remove all whole-body falling'; layoutChanged = $false; deathPresentationAcceptance = 'pending user manual review'
}
$kwDeathBurstRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwDeathBurstProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwDeathBurstProxy.ProxyEnable -eq 1 -and $kwDeathBurstProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwDeathBurstProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwDeathBurstStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwDeathBurstRecord | ConvertTo-Json -Compress
