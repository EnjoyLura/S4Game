$ErrorActionPreference = 'Stop'
$kwVoltGroundGame = 'D:/AI/S4Game/KingdomWatch'
$kwVoltGroundPriorRecord = Get-Content -LiteralPath (Join-Path $kwVoltGroundGame 'docs/hero-ultimate-ui-v3/deployment-stage.json') -Raw | ConvertFrom-Json
$kwVoltGroundPrior = $kwVoltGroundPriorRecord.stage
$kwVoltGroundWeb = Join-Path $kwVoltGroundGame 'build/web-mobile'
$kwVoltGroundStage = Join-Path $kwVoltGroundGame ('build/publish-volt-ground-alignment-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwVoltGroundStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwVoltGroundStage | Out-Null
Get-ChildItem -LiteralPath $kwVoltGroundWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwVoltGroundStage -Recurse -Force
$kwVoltGroundPreviews = Join-Path $kwVoltGroundStage 'previews'
New-Item -ItemType Directory -Path $kwVoltGroundPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwVoltGroundPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwVoltGroundPreviews -Recurse -Force
$kwVoltGroundHtml = Get-Content -LiteralPath (Join-Path $kwVoltGroundStage 'index.html') -Raw
$kwVoltGroundVersion = [regex]::Match($kwVoltGroundHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwVoltGroundVersion) { throw 'Missing rebuilt entry version' }
$kwVoltGroundRecord = [ordered]@{
    stage = $kwVoltGroundStage; priorPublishedStage = $kwVoltGroundPrior; entryVersion = $kwVoltGroundVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=volt-ground-alignment-v1-' + $kwVoltGroundVersion)
    scope = 'align thunder ground ring, synchronize sniper multi-target aim, commit pyro meteors to spread-out warned ground points'; layoutChanged = $false; manualAcceptance = 'pending user manual review'
}
$kwVoltGroundRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwVoltGroundProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwVoltGroundProxy.ProxyEnable -eq 1 -and $kwVoltGroundProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwVoltGroundProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwVoltGroundStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwVoltGroundRecord | ConvertTo-Json -Compress
