$ErrorActionPreference = 'Stop'
$kwLootGame = 'D:/AI/S4Game/KingdomWatch'
$kwLootPriorRecord = Get-Content -LiteralPath (Join-Path $kwLootGame 'docs/boss-warning-base-modal-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwLootPrior = $kwLootPriorRecord.stage
$kwLootWeb = Join-Path $kwLootGame 'build/web-mobile'
$kwLootDir = Join-Path $kwLootGame ('build/publish-level-difficulty-loot-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwLootDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwLootDir | Out-Null
Get-ChildItem -LiteralPath $kwLootWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwLootDir -Recurse -Force
$kwLootPreviews = Join-Path $kwLootDir 'previews'
New-Item -ItemType Directory -Path $kwLootPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwLootPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwLootPreviews -Recurse -Force
$kwLootHtml = Get-Content -LiteralPath (Join-Path $kwLootDir 'index.html') -Raw
$kwLootVersion = [regex]::Match($kwLootHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwLootVersion) { throw 'Missing rebuilt entry version' }
$kwLootRecord = [ordered]@{
    stage = $kwLootDir; priorPublishedStage = $kwLootPrior; entryVersion = $kwLootVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=level-difficulty-loot-v1-' + $kwLootVersion)
    scope = 'difficulty formations, kill equipment drops, pickup animation and reward preview'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwLootRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwLootProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwLootProxy.ProxyEnable -eq 1 -and $kwLootProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwLootProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwLootDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwLootRecord | ConvertTo-Json -Compress
