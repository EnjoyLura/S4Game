$ErrorActionPreference = 'Stop'
$kwBattleDeathGame = 'D:/AI/S4Game/KingdomWatch'
$kwBattleDeathPriorRecord = Get-Content -LiteralPath (Join-Path $kwBattleDeathGame 'docs/pick-motion-v2/deployment-stage.json') -Raw | ConvertFrom-Json
$kwBattleDeathPrior = $kwBattleDeathPriorRecord.stage
$kwBattleDeathWeb = Join-Path $kwBattleDeathGame 'build/web-mobile'
$kwBattleDeathDir = Join-Path $kwBattleDeathGame ('build/publish-battle-exit-death-v3-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwBattleDeathDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwBattleDeathDir | Out-Null
Get-ChildItem -LiteralPath $kwBattleDeathWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwBattleDeathDir -Recurse -Force
$kwBattleDeathPreviews = Join-Path $kwBattleDeathDir 'previews'
New-Item -ItemType Directory -Path $kwBattleDeathPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwBattleDeathPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwBattleDeathPreviews -Recurse -Force
$kwBattleDeathHtml = Get-Content -LiteralPath (Join-Path $kwBattleDeathDir 'index.html') -Raw
$kwBattleDeathVersion = [regex]::Match($kwBattleDeathHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwBattleDeathVersion) { throw 'Missing rebuilt entry version' }
$kwBattleDeathRecord = [ordered]@{
    stage = $kwBattleDeathDir; priorPublishedStage = $kwBattleDeathPrior; entryVersion = $kwBattleDeathVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=battle-exit-death-v3-' + $kwBattleDeathVersion)
    scope = 'scene exit and retry lifecycle, death audio and burst, wind offset'; layoutChanged = $false
    manualAcceptance = 'pending user manual review'
}
$kwBattleDeathRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwBattleDeathProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwBattleDeathProxy.ProxyEnable -eq 1 -and $kwBattleDeathProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwBattleDeathProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwBattleDeathDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwBattleDeathRecord | ConvertTo-Json -Compress
