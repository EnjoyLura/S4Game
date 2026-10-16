$ErrorActionPreference = 'Stop'
$kwCardOfferGame = 'D:/AI/S4Game/KingdomWatch'
$kwCardOfferPriorRecord = Get-Content -LiteralPath (Join-Path $kwCardOfferGame 'docs/skill-milestone-swipe-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwCardOfferPrior = $kwCardOfferPriorRecord.stage
$kwCardOfferWeb = Join-Path $kwCardOfferGame 'build/web-mobile'
$kwCardOfferStage = Join-Path $kwCardOfferGame ('build/publish-card-offer-weights-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwCardOfferStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwCardOfferStage | Out-Null
Get-ChildItem -LiteralPath $kwCardOfferWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwCardOfferStage -Recurse -Force
$kwCardOfferPreviews = Join-Path $kwCardOfferStage 'previews'
New-Item -ItemType Directory -Path $kwCardOfferPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwCardOfferPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwCardOfferPreviews -Recurse -Force
$kwCardOfferHtml = Get-Content -LiteralPath (Join-Path $kwCardOfferStage 'index.html') -Raw
$kwCardOfferVersion = [regex]::Match($kwCardOfferHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwCardOfferVersion) { throw 'Missing rebuilt entry version' }
$kwCardOfferRecord = [ordered]@{
    stage = $kwCardOfferStage; priorPublishedStage = $kwCardOfferPrior; entryVersion = $kwCardOfferVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=card-offer-weights-v1-' + $kwCardOfferVersion)
    scope = 'upgrade offers: generic stat weight x0.3; normal attack, skill and ultimate weight x2'; layoutChanged = $false; interactionAcceptance = 'pending user manual review'
}
$kwCardOfferRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwCardOfferProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwCardOfferProxy.ProxyEnable -eq 1 -and $kwCardOfferProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwCardOfferProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwCardOfferStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwCardOfferRecord | ConvertTo-Json -Compress
