$ErrorActionPreference = 'Stop'
$kwPickGame = 'D:/AI/S4Game/KingdomWatch'
$kwPickPriorRecord = Get-Content -LiteralPath (Join-Path $kwPickGame 'docs/settlement-comic-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwPickPrior = $kwPickPriorRecord.stage
$kwPickWeb = Join-Path $kwPickGame 'build/web-mobile'
$kwPickStage = Join-Path $kwPickGame ('build/publish-pick-comic-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwPickStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwPickStage | Out-Null
Get-ChildItem -LiteralPath $kwPickWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwPickStage -Recurse -Force
$kwPickPreviews = Join-Path $kwPickStage 'previews'
New-Item -ItemType Directory -Path $kwPickPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwPickPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwPickPreviews -Recurse -Force
$kwPickHtml = Get-Content -LiteralPath (Join-Path $kwPickStage 'index.html') -Raw
$kwPickVersion = [regex]::Match($kwPickHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwPickVersion) { throw 'Missing rebuilt entry version' }
$kwPickRecord = [ordered]@{
    stage = $kwPickStage; priorPublishedStage = $kwPickPrior; entryVersion = $kwPickVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=pick-comic-v1-' + $kwPickVersion)
    scope = 'original pick artwork and lower placement; ice idle/attack; new fire attack and idle loop; sniper 0.5/s, fire and volt 1/s'; layoutChanged = $true; visualAcceptance = 'pending user manual review'
}
$kwPickRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwPickProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwPickProxy.ProxyEnable -eq 1 -and $kwPickProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwPickProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwPickStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwPickRecord | ConvertTo-Json -Compress
