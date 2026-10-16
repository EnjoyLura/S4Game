$ErrorActionPreference = 'Stop'
$kwTrainingFixGame = 'D:/AI/S4Game/KingdomWatch'
$kwTrainingFixPriorRecord = Get-Content -LiteralPath (Join-Path $kwTrainingFixGame 'docs/level-reward-tabs-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwTrainingFixPrior = $kwTrainingFixPriorRecord.stage
$kwTrainingFixWeb = Join-Path $kwTrainingFixGame 'build/web-mobile'
$kwTrainingFixDir = Join-Path $kwTrainingFixGame ('build/publish-training-defense-entry-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwTrainingFixDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwTrainingFixDir | Out-Null
Get-ChildItem -LiteralPath $kwTrainingFixWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwTrainingFixDir -Recurse -Force
$kwTrainingFixPreviews = Join-Path $kwTrainingFixDir 'previews'
New-Item -ItemType Directory -Path $kwTrainingFixPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwTrainingFixPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwTrainingFixPreviews -Recurse -Force
$kwTrainingFixHtml = Get-Content -LiteralPath (Join-Path $kwTrainingFixDir 'index.html') -Raw
$kwTrainingFixVersion = [regex]::Match($kwTrainingFixHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwTrainingFixVersion) { throw 'Missing rebuilt entry version' }
$kwTrainingFixRecord = [ordered]@{
    stage = $kwTrainingFixDir; priorPublishedStage = $kwTrainingFixPrior; entryVersion = $kwTrainingFixVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=training-defense-entry-v1-' + $kwTrainingFixVersion)
    scope = 'smooth milestone gestures; saved keep HP/shield in every new battle; two real foreground seconds of closed-door hold'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwTrainingFixRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwTrainingFixProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwTrainingFixProxy.ProxyEnable -eq 1 -and $kwTrainingFixProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwTrainingFixProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwTrainingFixDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwTrainingFixRecord | ConvertTo-Json -Compress
