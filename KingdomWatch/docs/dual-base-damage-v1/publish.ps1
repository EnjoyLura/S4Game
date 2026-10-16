$ErrorActionPreference = 'Stop'
$kwDualDamageGame = 'D:/AI/S4Game/KingdomWatch'
$kwDualDamagePriorRecord = Get-Content -LiteralPath (Join-Path $kwDualDamageGame 'docs/enemy-death-burst-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwDualDamagePrior = $kwDualDamagePriorRecord.stage
$kwDualDamageWeb = Join-Path $kwDualDamageGame 'build/web-mobile'
$kwDualDamageStage = Join-Path $kwDualDamageGame ('build/publish-dual-base-damage-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwDualDamageStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwDualDamageStage | Out-Null
Get-ChildItem -LiteralPath $kwDualDamageWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwDualDamageStage -Recurse -Force
$kwDualDamagePreviews = Join-Path $kwDualDamageStage 'previews'
New-Item -ItemType Directory -Path $kwDualDamagePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwDualDamagePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwDualDamagePreviews -Recurse -Force
$kwDualDamageHtml = Get-Content -LiteralPath (Join-Path $kwDualDamageStage 'index.html') -Raw
$kwDualDamageVersion = [regex]::Match($kwDualDamageHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwDualDamageVersion) { throw 'Missing rebuilt entry version' }
$kwDualDamageRecord = [ordered]@{
    stage = $kwDualDamageStage; priorPublishedStage = $kwDualDamagePrior; entryVersion = $kwDualDamageVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=dual-base-damage-v1-' + $kwDualDamageVersion)
    scope = 'independent attack and skill damage with role growth; remove green death residue'; layoutChanged = $false; manualAcceptance = 'pending user manual review'
}
$kwDualDamageRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwDualDamageProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwDualDamageProxy.ProxyEnable -eq 1 -and $kwDualDamageProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwDualDamageProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwDualDamageStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwDualDamageRecord | ConvertTo-Json -Compress
