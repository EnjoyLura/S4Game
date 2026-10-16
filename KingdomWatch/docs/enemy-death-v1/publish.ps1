$ErrorActionPreference = 'Stop'
$kwDeathGame = 'D:/AI/S4Game/KingdomWatch'
$kwDeathPriorRecord = Get-Content -LiteralPath (Join-Path $kwDeathGame 'docs/notice-feedback-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwDeathPrior = $kwDeathPriorRecord.stage
$kwDeathWeb = Join-Path $kwDeathGame 'build/web-mobile'
$kwDeathStage = Join-Path $kwDeathGame ('build/publish-enemy-death-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwDeathStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwDeathStage | Out-Null
Get-ChildItem -LiteralPath $kwDeathWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwDeathStage -Recurse -Force
$kwDeathPreviews = Join-Path $kwDeathStage 'previews'
New-Item -ItemType Directory -Path $kwDeathPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwDeathPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwDeathPreviews -Recurse -Force
$kwDeathHtml = Get-Content -LiteralPath (Join-Path $kwDeathStage 'index.html') -Raw
$kwDeathVersion = [regex]::Match($kwDeathHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwDeathVersion) { throw 'Missing rebuilt entry version' }
$kwDeathRecord = [ordered]@{
    stage = $kwDeathStage; priorPublishedStage = $kwDeathPrior; entryVersion = $kwDeathVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=enemy-death-v1-' + $kwDeathVersion)
    scope = 'directional enemy death, weighted fall, contact dust and elemental silhouette dissolve on simulation clock'; layoutChanged = $false; deathPresentationAcceptance = 'pending user manual review'
}
$kwDeathRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwDeathProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwDeathProxy.ProxyEnable -eq 1 -and $kwDeathProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwDeathProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwDeathStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwDeathRecord | ConvertTo-Json -Compress
