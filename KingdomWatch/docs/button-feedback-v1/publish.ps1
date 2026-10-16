$ErrorActionPreference = 'Stop'
$kwButtonFeedbackGame = 'D:/AI/S4Game/KingdomWatch'
$kwButtonFeedbackPriorRecord = Get-Content -LiteralPath (Join-Path $kwButtonFeedbackGame 'docs/hero-controls-lobby-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwButtonFeedbackPrior = $kwButtonFeedbackPriorRecord.stage
$kwButtonFeedbackWeb = Join-Path $kwButtonFeedbackGame 'build/web-mobile'
$kwButtonFeedbackStage = Join-Path $kwButtonFeedbackGame ('build/publish-button-feedback-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwButtonFeedbackStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwButtonFeedbackStage | Out-Null
Get-ChildItem -LiteralPath $kwButtonFeedbackWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwButtonFeedbackStage -Recurse -Force
$kwButtonFeedbackPreviews = Join-Path $kwButtonFeedbackStage 'previews'
New-Item -ItemType Directory -Path $kwButtonFeedbackPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwButtonFeedbackPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwButtonFeedbackPreviews -Recurse -Force
$kwButtonFeedbackHtml = Get-Content -LiteralPath (Join-Path $kwButtonFeedbackStage 'index.html') -Raw
$kwButtonFeedbackVersion = [regex]::Match($kwButtonFeedbackHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwButtonFeedbackVersion) { throw 'Missing rebuilt entry version' }
$kwButtonFeedbackRecord = [ordered]@{
    stage = $kwButtonFeedbackStage; priorPublishedStage = $kwButtonFeedbackPrior; entryVersion = $kwButtonFeedbackVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=button-feedback-v1-' + $kwButtonFeedbackVersion)
    scope = 'shared feedback across lobby, battle and modal buttons'; layoutChanged = $false; visualAcceptance = 'pending user manual review'
}
$kwButtonFeedbackRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwButtonFeedbackProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwButtonFeedbackProxy.ProxyEnable -eq 1 -and $kwButtonFeedbackProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwButtonFeedbackProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwButtonFeedbackStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwButtonFeedbackRecord | ConvertTo-Json -Compress






