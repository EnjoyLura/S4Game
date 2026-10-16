$ErrorActionPreference = 'Stop'
$kwPickMotionGame = 'D:/AI/S4Game/KingdomWatch'
$kwPickMotionPriorRecord = Get-Content -LiteralPath (Join-Path $kwPickMotionGame 'docs/ultimate-staging-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwPickMotionPrior = $kwPickMotionPriorRecord.stage
$kwPickMotionWeb = Join-Path $kwPickMotionGame 'build/web-mobile'
$kwPickMotionDir = Join-Path $kwPickMotionGame ('build/publish-pick-motion-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwPickMotionDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwPickMotionDir | Out-Null
Get-ChildItem -LiteralPath $kwPickMotionWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwPickMotionDir -Recurse -Force
$kwPickMotionPreviews = Join-Path $kwPickMotionDir 'previews'
New-Item -ItemType Directory -Path $kwPickMotionPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwPickMotionPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwPickMotionPreviews -Recurse -Force
$kwPickMotionHtml = Get-Content -LiteralPath (Join-Path $kwPickMotionDir 'index.html') -Raw
$kwPickMotionVersion = [regex]::Match($kwPickMotionHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwPickMotionVersion) { throw 'Missing rebuilt entry version' }
$kwPickMotionRecord = [ordered]@{
    stage = $kwPickMotionDir; priorPublishedStage = $kwPickMotionPrior; entryVersion = $kwPickMotionVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=pick-motion-v2-' + $kwPickMotionVersion)
    scope = 'ultimate readiness fix, card choreography, purchase feedback and battle entry flags'; layoutChanged = $false
    manualAcceptance = 'pending user manual review'
}
$kwPickMotionRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwPickMotionProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwPickMotionProxy.ProxyEnable -eq 1 -and $kwPickMotionProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwPickMotionProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwPickMotionDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwPickMotionRecord | ConvertTo-Json -Compress
