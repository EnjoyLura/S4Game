$ErrorActionPreference = 'Stop'
$kwBasicLaunchGame = 'D:/AI/S4Game/KingdomWatch'
$kwBasicLaunchPriorRecord = Get-Content -LiteralPath (Join-Path $kwBasicLaunchGame 'docs/pick-comic-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwBasicLaunchPrior = $kwBasicLaunchPriorRecord.stage
$kwBasicLaunchWeb = Join-Path $kwBasicLaunchGame 'build/web-mobile'
$kwBasicLaunchStage = Join-Path $kwBasicLaunchGame ('build/publish-basic-launch-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwBasicLaunchStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwBasicLaunchStage | Out-Null
Get-ChildItem -LiteralPath $kwBasicLaunchWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwBasicLaunchStage -Recurse -Force
$kwBasicLaunchPreviews = Join-Path $kwBasicLaunchStage 'previews'
New-Item -ItemType Directory -Path $kwBasicLaunchPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwBasicLaunchPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwBasicLaunchPreviews -Recurse -Force
$kwBasicLaunchHtml = Get-Content -LiteralPath (Join-Path $kwBasicLaunchStage 'index.html') -Raw
$kwBasicLaunchVersion = [regex]::Match($kwBasicLaunchHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwBasicLaunchVersion) { throw 'Missing rebuilt entry version' }
$kwBasicLaunchRecord = [ordered]@{
    stage = $kwBasicLaunchStage; priorPublishedStage = $kwBasicLaunchPrior; entryVersion = $kwBasicLaunchVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=basic-launch-v1-' + $kwBasicLaunchVersion)
    scope = 'five hero basic projectile releases: bow/crossbow wind pressure, fire jet, violet lightning and frost crystals'; layoutChanged = $false; visualAcceptance = 'pending user manual review'
}
$kwBasicLaunchRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwBasicLaunchProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwBasicLaunchProxy.ProxyEnable -eq 1 -and $kwBasicLaunchProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwBasicLaunchProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwBasicLaunchStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwBasicLaunchRecord | ConvertTo-Json -Compress
