$ErrorActionPreference = 'Stop'
$kwUIExperienceGame = 'D:/AI/S4Game/KingdomWatch'
$kwUIExperiencePriorRecord = Get-Content -LiteralPath (Join-Path $kwUIExperienceGame 'docs/audio-playback-fix-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwUIExperiencePrior = $kwUIExperiencePriorRecord.stage
$kwUIExperienceWeb = Join-Path $kwUIExperienceGame 'build/web-mobile'
$kwUIExperienceStage = Join-Path $kwUIExperienceGame ('build/publish-ui-experience-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwUIExperienceStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwUIExperienceStage | Out-Null
Get-ChildItem -LiteralPath $kwUIExperienceWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwUIExperienceStage -Recurse -Force
$kwUIExperiencePreviews = Join-Path $kwUIExperienceStage 'previews'
New-Item -ItemType Directory -Path $kwUIExperiencePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwUIExperiencePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwUIExperiencePreviews -Recurse -Force
$kwUIExperienceHtml = Get-Content -LiteralPath (Join-Path $kwUIExperienceStage 'index.html') -Raw
$kwUIExperienceVersion = [regex]::Match($kwUIExperienceHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwUIExperienceVersion) { throw 'Missing rebuilt entry version' }
$kwUIExperienceRecord = [ordered]@{
    stage = $kwUIExperienceStage; priorPublishedStage = $kwUIExperiencePrior; entryVersion = $kwUIExperienceVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=ui-experience-v1-' + $kwUIExperienceVersion)
    scope = 'semantic UI audio, procedural tap feedback and interruptible page/modal motion'; layoutChanged = $false; interactionAcceptance = 'pending user manual review'
}
$kwUIExperienceRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwUIExperienceProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwUIExperienceProxy.ProxyEnable -eq 1 -and $kwUIExperienceProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwUIExperienceProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwUIExperienceStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwUIExperienceRecord | ConvertTo-Json -Compress








