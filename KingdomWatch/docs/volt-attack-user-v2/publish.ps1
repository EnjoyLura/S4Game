$ErrorActionPreference = 'Stop'
$kwVoltGame = 'D:/AI/S4Game/KingdomWatch'
$kwVoltPriorRecord = Get-Content -LiteralPath (Join-Path $kwVoltGame 'docs/sniper-attack-clean-live-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwVoltPrior = $kwVoltPriorRecord.stage
$kwVoltWeb = Join-Path $kwVoltGame 'build/web-mobile'
$kwVoltStage = Join-Path $kwVoltGame ('build/publish-volt-attack-user-v2-live-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwVoltStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwVoltStage | Out-Null
Get-ChildItem -LiteralPath $kwVoltWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwVoltStage -Recurse -Force
$kwVoltPreviews = Join-Path $kwVoltStage 'previews'
New-Item -ItemType Directory -Path $kwVoltPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwVoltPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwVoltPreviews -Recurse -Force
Copy-Item -LiteralPath (Join-Path $kwVoltWeb 'previews/volt-attack-user-v2') -Destination $kwVoltPreviews -Recurse -Force
$kwVoltHtml = Get-Content -LiteralPath (Join-Path $kwVoltStage 'index.html') -Raw
$kwVoltVersion = [regex]::Match($kwVoltHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwVoltVersion) { throw 'No rebuilt cache entry version in stage' }
$kwVoltRecord = [ordered]@{
    stage = $kwVoltStage
    priorPublishedStage = $kwVoltPrior
    entryVersion = $kwVoltVersion
    project = 'kingdom-watch'
    branch = 'main'
    preview = ('https://kingdom-watch.pages.dev/previews/volt-attack-user-v2/?v=' + $kwVoltVersion)
    game = ('https://kingdom-watch.pages.dev/?v=volt-attack-user-v2-' + $kwVoltVersion)
    previewOnly = $false
    gameChanged = $true
    paidTaskSubmitted = $false
}
$kwVoltRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwVoltProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwVoltProxy.ProxyEnable -eq 1 -and $kwVoltProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwVoltProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwVoltStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; preserve stage for retry' }
$kwVoltRecord | ConvertTo-Json -Compress
