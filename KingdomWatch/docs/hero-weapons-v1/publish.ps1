$ErrorActionPreference = 'Stop'
$kwHeroWeaponsGame = 'D:/AI/S4Game/KingdomWatch'
$kwHeroWeaponsPriorRecord = Get-Content -LiteralPath (Join-Path $kwHeroWeaponsGame 'docs/training-defense-entry-v1/deployment-stage.json') -Raw | ConvertFrom-Json
$kwHeroWeaponsPrior = $kwHeroWeaponsPriorRecord.stage
$kwHeroWeaponsWeb = Join-Path $kwHeroWeaponsGame 'build/web-mobile'
$kwHeroWeaponsDir = Join-Path $kwHeroWeaponsGame ('build/publish-hero-weapons-v1-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-record.json'))) { throw 'Build the new game before publication' }
if (Test-Path -LiteralPath $kwHeroWeaponsDir) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwHeroWeaponsDir | Out-Null
Get-ChildItem -LiteralPath $kwHeroWeaponsWeb -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwHeroWeaponsDir -Recurse -Force
$kwHeroWeaponsPreviews = Join-Path $kwHeroWeaponsDir 'previews'
New-Item -ItemType Directory -Path $kwHeroWeaponsPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwHeroWeaponsPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwHeroWeaponsPreviews -Recurse -Force
$kwHeroWeaponsHtml = Get-Content -LiteralPath (Join-Path $kwHeroWeaponsDir 'index.html') -Raw
$kwHeroWeaponsVersion = [regex]::Match($kwHeroWeaponsHtml, 'index.js\?v=(\d+)').Groups[1].Value
if (-not $kwHeroWeaponsVersion) { throw 'Missing rebuilt entry version' }
$kwHeroWeaponsRecord = [ordered]@{
    stage = $kwHeroWeaponsDir; priorPublishedStage = $kwHeroWeaponsPrior; entryVersion = $kwHeroWeaponsVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=hero-weapons-v1-' + $kwHeroWeaponsVersion)
    scope = 'mandatory starter weapons; four green weapons; per-hero shared weapon cultivation and weapon-specific breakthroughs; gate closed hold 1.5s; frost ultimate rain 256; pyro crater size +20%'; layoutChanged = $true
    manualAcceptance = 'pending user manual review'
}
$kwHeroWeaponsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
$kwHeroWeaponsProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwHeroWeaponsProxy.ProxyEnable -eq 1 -and $kwHeroWeaponsProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwHeroWeaponsProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwHeroWeaponsDir --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwHeroWeaponsRecord | ConvertTo-Json -Compress
