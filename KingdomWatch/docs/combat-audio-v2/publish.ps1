$ErrorActionPreference = 'Stop'
$kwCombatAudioGame = 'D:/AI/S4Game/KingdomWatch'
$kwCombatAudioPriorRecord = Get-Content -LiteralPath (Join-Path $kwCombatAudioGame 'docs/ui-experience-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwCombatAudioPrior = $kwCombatAudioPriorRecord.stage
$kwCombatAudioWeb = Join-Path $kwCombatAudioGame 'build/web-mobile'
$kwCombatAudioStage = Join-Path $kwCombatAudioGame ('build/publish-combat-audio-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwCombatAudioStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwCombatAudioStage | Out-Null
Get-ChildItem -LiteralPath $kwCombatAudioWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwCombatAudioStage -Recurse -Force
$kwCombatAudioPreviews = Join-Path $kwCombatAudioStage 'previews'
New-Item -ItemType Directory -Path $kwCombatAudioPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwCombatAudioPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwCombatAudioPreviews -Recurse -Force
$kwCombatAudioHtml = Get-Content -LiteralPath (Join-Path $kwCombatAudioStage 'index.html') -Raw
$kwCombatAudioVersion = [regex]::Match($kwCombatAudioHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwCombatAudioVersion) { throw 'Missing rebuilt entry version' }
$kwCombatAudioRecord = [ordered]@{
    stage = $kwCombatAudioStage; priorPublishedStage = $kwCombatAudioPrior; entryVersion = $kwCombatAudioVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=combat-audio-v2-' + $kwCombatAudioVersion)
    scope = 'five-hero combat sound redesign and density-aware mix; prior UI experience retained'; layoutChanged = $false; audioAcceptance = 'pending user manual listening'
}
$kwCombatAudioRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwCombatAudioProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwCombatAudioProxy.ProxyEnable -eq 1 -and $kwCombatAudioProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwCombatAudioProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwCombatAudioStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwCombatAudioRecord | ConvertTo-Json -Compress








