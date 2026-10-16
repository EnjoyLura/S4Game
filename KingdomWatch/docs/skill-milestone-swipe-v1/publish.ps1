$ErrorActionPreference = 'Stop'
$kwSkillSwipeGame = 'D:/AI/S4Game/KingdomWatch'
$kwSkillSwipePriorRecord = Get-Content -LiteralPath (Join-Path $kwSkillSwipeGame 'docs/page-switch-no-flash-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwSkillSwipePrior = $kwSkillSwipePriorRecord.stage
$kwSkillSwipeWeb = Join-Path $kwSkillSwipeGame 'build/web-mobile'
$kwSkillSwipeStage = Join-Path $kwSkillSwipeGame ('build/publish-skill-milestone-swipe-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwSkillSwipeStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwSkillSwipeStage | Out-Null
Get-ChildItem -LiteralPath $kwSkillSwipeWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwSkillSwipeStage -Recurse -Force
$kwSkillSwipePreviews = Join-Path $kwSkillSwipeStage 'previews'
New-Item -ItemType Directory -Path $kwSkillSwipePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwSkillSwipePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwSkillSwipePreviews -Recurse -Force
$kwSkillSwipeHtml = Get-Content -LiteralPath (Join-Path $kwSkillSwipeStage 'index.html') -Raw
$kwSkillSwipeVersion = [regex]::Match($kwSkillSwipeHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwSkillSwipeVersion) { throw 'Missing rebuilt entry version' }
$kwSkillSwipeRecord = [ordered]@{
    stage = $kwSkillSwipeStage; priorPublishedStage = $kwSkillSwipePrior; entryVersion = $kwSkillSwipeVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=skill-milestone-swipe-v1-' + $kwSkillSwipeVersion)
    scope = 'skill breakthrough cards: horizontal drag, snap, edge resistance and vertical-scroll handoff'; layoutChanged = $false; interactionAcceptance = 'pending user manual review'
}
$kwSkillSwipeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwSkillSwipeProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwSkillSwipeProxy.ProxyEnable -eq 1 -and $kwSkillSwipeProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwSkillSwipeProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwSkillSwipeStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwSkillSwipeRecord | ConvertTo-Json -Compress
