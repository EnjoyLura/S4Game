$ErrorActionPreference = 'Stop'
$kwAudioGame = 'D:/AI/S4Game/KingdomWatch'
$kwAudioPriorRecord = Get-Content -LiteralPath (Join-Path $kwAudioGame 'docs/basic-launch-procedural-v3/deployment-stage.json') -Raw | ConvertFrom-Json
$kwAudioPrior = $kwAudioPriorRecord.stage
$kwAudioWeb = Join-Path $kwAudioGame 'build/web-mobile'
$kwAudioStage = Join-Path $kwAudioGame ('build/publish-audio-upgrade-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwAudioStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwAudioStage | Out-Null
Get-ChildItem -LiteralPath $kwAudioWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwAudioStage -Recurse -Force
$kwAudioPreviews = Join-Path $kwAudioStage 'previews'
New-Item -ItemType Directory -Path $kwAudioPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwAudioPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwAudioPreviews -Recurse -Force
$kwAudioHtml = Get-Content -LiteralPath (Join-Path $kwAudioStage 'index.html') -Raw
$kwAudioVersion = [regex]::Match($kwAudioHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwAudioVersion) { throw 'Missing rebuilt entry version' }
$kwAudioRecord = [ordered]@{
    stage = $kwAudioStage; priorPublishedStage = $kwAudioPrior; entryVersion = $kwAudioVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=audio-upgrade-v1-' + $kwAudioVersion)
    scope = 'licensed music and sample audio with persistent mixer'; layoutChanged = $true; visualAcceptance = 'pending user manual review'
}
$kwAudioRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwAudioProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwAudioProxy.ProxyEnable -eq 1 -and $kwAudioProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwAudioProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwAudioStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwAudioRecord | ConvertTo-Json -Compress


