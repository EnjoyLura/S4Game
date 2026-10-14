$ErrorActionPreference = 'Stop'
$kwVoltGame = 'D:/AI/S4Game/KingdomWatch'
$kwVoltPriorRecord = Get-Content -LiteralPath (Join-Path $kwVoltGame 'docs/sniper-attack-clean-live-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwVoltPrior = $kwVoltPriorRecord.stage
$kwVoltPreview = Join-Path $kwVoltGame 'build/web-mobile/previews/volt-attack-user-v2'
$kwVoltStage = Join-Path $kwVoltGame ('build/publish-volt-attack-user-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $kwVoltPreview 'attack.frames.json'))) { throw 'Complete preview must be packaged first' }
if (-not (Test-Path -LiteralPath (Join-Path $kwVoltPrior 'index.html'))) { throw 'Previously published game must be preserved' }
if (Test-Path -LiteralPath $kwVoltStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwVoltStage | Out-Null
Get-ChildItem -LiteralPath $kwVoltPrior -Force | Copy-Item -Destination $kwVoltStage -Recurse -Force
Copy-Item -LiteralPath $kwVoltPreview -Destination (Join-Path $kwVoltStage 'previews') -Recurse -Force
$kwVoltVersion = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$kwVoltRecord = [ordered]@{
    stage = $kwVoltStage
    priorPublishedStage = $kwVoltPrior
    previewVersion = $kwVoltVersion
    project = 'kingdom-watch'
    branch = 'main'
    preview = ('https://kingdom-watch.pages.dev/previews/volt-attack-user-v2/?v=' + $kwVoltVersion)
    game = $kwVoltPriorRecord.game
    previewOnly = $true
    gameChanged = $false
    paidTaskSubmitted = $false
}
$kwVoltRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwVoltProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwVoltProxy.ProxyEnable -eq 1 -and $kwVoltProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwVoltProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwVoltStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; preserve stage for retry' }
$kwVoltRecord | ConvertTo-Json -Compress
