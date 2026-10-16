$ErrorActionPreference = 'Stop'
$kwBattleButtonsGame = 'D:/AI/S4Game/KingdomWatch'
$kwBattleButtonsPriorRecord = Get-Content -LiteralPath (Join-Path $kwBattleButtonsGame 'docs/basic-launch-emphasis-v4/deployment-stage.json') -Raw | ConvertFrom-Json
$kwBattleButtonsPrior = $kwBattleButtonsPriorRecord.stage
$kwBattleButtonsWeb = Join-Path $kwBattleButtonsGame 'build/web-mobile'
$kwBattleButtonsStage = Join-Path $kwBattleButtonsGame ('build/publish-battle-buttons-lobby-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwBattleButtonsStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwBattleButtonsStage | Out-Null
Get-ChildItem -LiteralPath $kwBattleButtonsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwBattleButtonsStage -Recurse -Force
$kwBattleButtonsPreviews = Join-Path $kwBattleButtonsStage 'previews'
New-Item -ItemType Directory -Path $kwBattleButtonsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwBattleButtonsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwBattleButtonsPreviews -Recurse -Force
$kwBattleButtonsHtml = Get-Content -LiteralPath (Join-Path $kwBattleButtonsStage 'index.html') -Raw
$kwBattleButtonsVersion = [regex]::Match($kwBattleButtonsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwBattleButtonsVersion) { throw 'Missing rebuilt entry version' }
$kwBattleButtonsRecord = [ordered]@{
    stage = $kwBattleButtonsStage; priorPublishedStage = $kwBattleButtonsPrior; entryVersion = $kwBattleButtonsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=battle-buttons-lobby-v1-' + $kwBattleButtonsVersion)
    scope = 'reuse lobby button styling in battle panels'; layoutChanged = $false; visualAcceptance = 'pending user manual review'
}
$kwBattleButtonsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwBattleButtonsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwBattleButtonsProxy.ProxyEnable -eq 1 -and $kwBattleButtonsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwBattleButtonsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwBattleButtonsStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwBattleButtonsRecord | ConvertTo-Json -Compress




