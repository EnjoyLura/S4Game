$ErrorActionPreference = 'Stop'
$kwShieldProjectileGame = 'D:/AI/S4Game/KingdomWatch'
$kwShieldProjectilePriorRecord = Get-Content -LiteralPath (Join-Path $kwShieldProjectileGame 'docs/basic-launch-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwShieldProjectilePrior = $kwShieldProjectilePriorRecord.stage
$kwShieldProjectileWeb = Join-Path $kwShieldProjectileGame 'build/web-mobile'
$kwShieldProjectileStage = Join-Path $kwShieldProjectileGame ('build/publish-shield-projectile-v2-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwShieldProjectileStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwShieldProjectileStage | Out-Null
Get-ChildItem -LiteralPath $kwShieldProjectileWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwShieldProjectileStage -Recurse -Force
$kwShieldProjectilePreviews = Join-Path $kwShieldProjectileStage 'previews'
New-Item -ItemType Directory -Path $kwShieldProjectilePreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwShieldProjectilePrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwShieldProjectilePreviews -Recurse -Force
$kwShieldProjectileHtml = Get-Content -LiteralPath (Join-Path $kwShieldProjectileStage 'index.html') -Raw
$kwShieldProjectileVersion = [regex]::Match($kwShieldProjectileHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwShieldProjectileVersion) { throw 'Missing rebuilt entry version' }
$kwShieldProjectileRecord = [ordered]@{
    stage = $kwShieldProjectileStage; priorPublishedStage = $kwShieldProjectilePrior; entryVersion = $kwShieldProjectileVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=shield-projectile-v2-' + $kwShieldProjectileVersion)
    scope = 'blue shield shell, stacked HP/shield values, raised health and ult icons; painted basic releases and elemental flight wakes'; layoutChanged = $true; visualAcceptance = 'pending user manual review'
}
$kwShieldProjectileRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwShieldProjectileProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwShieldProjectileProxy.ProxyEnable -eq 1 -and $kwShieldProjectileProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwShieldProjectileProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwShieldProjectileStage --project-name=kingdom-watch --branch=main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwShieldProjectileRecord | ConvertTo-Json -Compress
