$ErrorActionPreference = 'Stop'
$kwNoticeGame = 'D:/AI/S4Game/KingdomWatch'
$kwNoticePriorRecord = Get-Content -LiteralPath (Join-Path $kwNoticeGame 'docs/shop-product-details-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwNoticePrior = $kwNoticePriorRecord.stage
$kwNoticeWeb = Join-Path $kwNoticeGame 'build/web-mobile'
$kwNoticeStage = Join-Path $kwNoticeGame ('build/publish-notice-feedback-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwNoticeStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwNoticeStage | Out-Null
Get-ChildItem -LiteralPath $kwNoticeWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwNoticeStage -Recurse -Force
$kwNoticePreviews = Join-Path $kwNoticeStage 'previews'
New-Item -ItemType Directory -Path $kwNoticePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwNoticePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwNoticePreviews -Recurse -Force
$kwNoticeHtml = Get-Content -LiteralPath (Join-Path $kwNoticeStage 'index.html') -Raw
$kwNoticeVersion = [regex]::Match($kwNoticeHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwNoticeVersion) { throw 'Missing rebuilt entry version' }
$kwNoticeRecord = [ordered]@{
    stage = $kwNoticeStage; priorPublishedStage = $kwNoticePrior; entryVersion = $kwNoticeVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=notice-feedback-v1-' + $kwNoticeVersion)
    scope = 'typed non-blocking notifications and growth feedback with actual values, merge behavior and semantic audio'; layoutChanged = $true; interactionAcceptance = 'pending user manual review'
}
$kwNoticeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwNoticeProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwNoticeProxy.ProxyEnable -eq 1 -and $kwNoticeProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwNoticeProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwNoticeStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwNoticeRecord | ConvertTo-Json -Compress
