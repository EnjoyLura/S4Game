$ErrorActionPreference = 'Stop'
$kwUltimateUIGame = 'D:/AI/S4Game/KingdomWatch'
$kwUltimateUIPriorRecord = Get-Content -LiteralPath (Join-Path $kwUltimateUIGame 'docs/sniper-cards-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwUltimateUIPrior = $kwUltimateUIPriorRecord.stage
$kwUltimateUIWeb = Join-Path $kwUltimateUIGame 'build/web-mobile'
$kwUltimateUIStage = Join-Path $kwUltimateUIGame ('build/publish-hero-ultimate-ui-v3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwUltimateUIStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwUltimateUIStage | Out-Null
Get-ChildItem -LiteralPath $kwUltimateUIWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwUltimateUIStage -Recurse -Force
$kwUltimateUIPreviews = Join-Path $kwUltimateUIStage 'previews'
New-Item -ItemType Directory -Path $kwUltimateUIPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwUltimateUIPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwUltimateUIPreviews -Recurse -Force
$kwUltimateUIHtml = Get-Content -LiteralPath (Join-Path $kwUltimateUIStage 'index.html') -Raw
$kwUltimateUIVersion = [regex]::Match($kwUltimateUIHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwUltimateUIVersion) { throw 'Missing rebuilt entry version' }
$kwUltimateUIRecord = [ordered]@{
    stage = $kwUltimateUIStage; priorPublishedStage = $kwUltimateUIPrior; entryVersion = $kwUltimateUIVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-ultimate-ui-v3-' + $kwUltimateUIVersion)
    scope = 'violet thunder ultimate, blue sniper ultimate, opaque page handoff and formation close without blank frames'; layoutChanged = $false; manualAcceptance = 'pending user manual review'
}
$kwUltimateUIRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwUltimateUIProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwUltimateUIProxy.ProxyEnable -eq 1 -and $kwUltimateUIProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwUltimateUIProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwUltimateUIStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwUltimateUIRecord | ConvertTo-Json -Compress
