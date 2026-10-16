$ErrorActionPreference = 'Stop'
$kwTabsGame = 'D:/AI/S4Game/KingdomWatch'
$kwTabsPriorRecord = Get-Content -LiteralPath (Join-Path $kwTabsGame 'docs/level-breakthrough-swipe-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwTabsPrior = $kwTabsPriorRecord.stage
$kwTabsWeb = Join-Path $kwTabsGame 'build/web-mobile'
$kwTabsDir = Join-Path $kwTabsGame ('build/publish-level-reward-tabs-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwTabsDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwTabsDir | Out-Null
Get-ChildItem -LiteralPath $kwTabsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwTabsDir -Recurse -Force
$kwTabsPreviews = Join-Path $kwTabsDir 'previews'
New-Item -ItemType Directory -Path $kwTabsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwTabsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwTabsPreviews -Recurse -Force
$kwTabsHtml = Get-Content -LiteralPath (Join-Path $kwTabsDir 'index.html') -Raw
$kwTabsVersion = [regex]::Match($kwTabsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwTabsVersion) { throw 'Missing rebuilt entry version' }
$kwTabsRecord = [ordered]@{
    stage = $kwTabsDir; priorPublishedStage = $kwTabsPrior; entryVersion = $kwTabsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=level-reward-tabs-v1-' + $kwTabsVersion)
    scope = 'star chests on the left and selected by default; level loot on the right'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwTabsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwTabsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwTabsProxy.ProxyEnable -eq 1 -and $kwTabsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwTabsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwTabsDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwTabsRecord | ConvertTo-Json -Compress
