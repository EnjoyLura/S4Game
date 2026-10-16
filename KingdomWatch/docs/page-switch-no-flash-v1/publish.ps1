$ErrorActionPreference = 'Stop'
$kwNoFlashGame = 'D:/AI/S4Game/KingdomWatch'
$kwNoFlashPriorRecord = Get-Content -LiteralPath (Join-Path $kwNoFlashGame 'docs/tap-spring-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwNoFlashPrior = $kwNoFlashPriorRecord.stage
$kwNoFlashWeb = Join-Path $kwNoFlashGame 'build/web-mobile'
$kwNoFlashStage = Join-Path $kwNoFlashGame ('build/publish-page-switch-no-flash-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwNoFlashStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwNoFlashStage | Out-Null
Get-ChildItem -LiteralPath $kwNoFlashWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwNoFlashStage -Recurse -Force
$kwNoFlashPreviews = Join-Path $kwNoFlashStage 'previews'
New-Item -ItemType Directory -Path $kwNoFlashPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwNoFlashPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwNoFlashPreviews -Recurse -Force
$kwNoFlashHtml = Get-Content -LiteralPath (Join-Path $kwNoFlashStage 'index.html') -Raw
$kwNoFlashVersion = [regex]::Match($kwNoFlashHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwNoFlashVersion) { throw 'Missing rebuilt entry version' }
$kwNoFlashRecord = [ordered]@{
    stage = $kwNoFlashStage; priorPublishedStage = $kwNoFlashPrior; entryVersion = $kwNoFlashVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=page-switch-no-flash-v1-' + $kwNoFlashVersion)
    scope = 'stable page and hero refresh; retain opaque prior surface until replacement art is ready'; layoutChanged = $false; interactionAcceptance = 'pending user manual review'
}
$kwNoFlashRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwNoFlashProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwNoFlashProxy.ProxyEnable -eq 1 -and $kwNoFlashProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwNoFlashProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwNoFlashStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwNoFlashRecord | ConvertTo-Json -Compress
