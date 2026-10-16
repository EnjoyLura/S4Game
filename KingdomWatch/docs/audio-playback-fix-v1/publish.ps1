$ErrorActionPreference = 'Stop'
$kwAudioPlaybackFixGame = 'D:/AI/S4Game/KingdomWatch'
$kwAudioPlaybackFixPriorRecord = Get-Content -LiteralPath (Join-Path $kwAudioPlaybackFixGame 'docs/button-feedback-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwAudioPlaybackFixPrior = $kwAudioPlaybackFixPriorRecord.stage
$kwAudioPlaybackFixWeb = Join-Path $kwAudioPlaybackFixGame 'build/web-mobile'
$kwAudioPlaybackFixStage = Join-Path $kwAudioPlaybackFixGame ('build/publish-audio-playback-fix-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwAudioPlaybackFixStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwAudioPlaybackFixStage | Out-Null
Get-ChildItem -LiteralPath $kwAudioPlaybackFixWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwAudioPlaybackFixStage -Recurse -Force
$kwAudioPlaybackFixPreviews = Join-Path $kwAudioPlaybackFixStage 'previews'
New-Item -ItemType Directory -Path $kwAudioPlaybackFixPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwAudioPlaybackFixPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwAudioPlaybackFixPreviews -Recurse -Force
$kwAudioPlaybackFixHtml = Get-Content -LiteralPath (Join-Path $kwAudioPlaybackFixStage 'index.html') -Raw
$kwAudioPlaybackFixVersion = [regex]::Match($kwAudioPlaybackFixHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwAudioPlaybackFixVersion) { throw 'Missing rebuilt entry version' }
$kwAudioPlaybackFixRecord = [ordered]@{
    stage = $kwAudioPlaybackFixStage; priorPublishedStage = $kwAudioPlaybackFixPrior; entryVersion = $kwAudioPlaybackFixVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=audio-playback-fix-v1-' + $kwAudioPlaybackFixVersion)
    scope = 'audio gesture capture, preloading and music recovery'; layoutChanged = $false; audioAcceptance = 'pending user manual review'
}
$kwAudioPlaybackFixRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwAudioPlaybackFixProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwAudioPlaybackFixProxy.ProxyEnable -eq 1 -and $kwAudioPlaybackFixProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwAudioPlaybackFixProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwAudioPlaybackFixStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwAudioPlaybackFixRecord | ConvertTo-Json -Compress







