$ErrorActionPreference = 'Stop'
$kwSwipeGame = 'D:/AI/S4Game/KingdomWatch'
$kwSwipePriorRecord = Get-Content -LiteralPath (Join-Path $kwSwipeGame 'docs/level-difficulty-loot-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwSwipePrior = $kwSwipePriorRecord.stage
$kwSwipeWeb = Join-Path $kwSwipeGame 'build/web-mobile'
$kwSwipeDir = Join-Path $kwSwipeGame ('build/publish-level-breakthrough-swipe-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwSwipeDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwSwipeDir | Out-Null
Get-ChildItem -LiteralPath $kwSwipeWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwSwipeDir -Recurse -Force
$kwSwipePreviews = Join-Path $kwSwipeDir 'previews'
New-Item -ItemType Directory -Path $kwSwipePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwSwipePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSwipePreviews -Recurse -Force
$kwSwipeHtml = Get-Content -LiteralPath (Join-Path $kwSwipeDir 'index.html') -Raw
$kwSwipeVersion = [regex]::Match($kwSwipeHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwSwipeVersion) { throw 'Missing rebuilt entry version' }
$kwSwipeRecord = [ordered]@{
    stage = $kwSwipeDir; priorPublishedStage = $kwSwipePrior; entryVersion = $kwSwipeVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=level-breakthrough-swipe-v1-' + $kwSwipeVersion)
    scope = 'hero level and weapon breakthroughs use the existing skill milestone swipe interaction'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwSwipeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwSwipeProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwSwipeProxy.ProxyEnable -eq 1 -and $kwSwipeProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwSwipeProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwSwipeDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwSwipeRecord | ConvertTo-Json -Compress
