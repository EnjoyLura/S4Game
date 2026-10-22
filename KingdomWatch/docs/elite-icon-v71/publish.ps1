$ErrorActionPreference = 'Stop'
$kwCombatRoot = 'D:/AI/S4Game/KingdomWatch'
Set-Location -LiteralPath $kwCombatRoot
$kwCombatBuild = Join-Path $kwCombatRoot 'build/web-mobile'
$kwCombatPrior = 'D:/AI/S4Game/KingdomWatch/build/publish-combat-feedback-fix-v70-20261022-002335'
$kwCombatBuildRecord = Get-Content -LiteralPath (Join-Path $kwCombatBuild 'build-record.json') -Raw | ConvertFrom-Json
$kwCombatRelease = Get-Content -LiteralPath (Join-Path $kwCombatBuild 'web-release.json') -Raw | ConvertFrom-Json
if ($kwCombatBuildRecord.debug -ne $false -or -not $kwCombatRelease.production) { throw 'Prepared production build required' }
$kwCombatStage = Join-Path $kwCombatRoot ('build/publish-elite-icon-v71-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwCombatStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwCombatStage | Out-Null
Get-ChildItem -LiteralPath $kwCombatBuild -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwCombatStage -Recurse -Force
$kwCombatPreviews = Join-Path $kwCombatStage 'previews'
New-Item -ItemType Directory -Path $kwCombatPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwCombatPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwCombatPreviews -Recurse -Force
$kwCombatPreviewMap = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'previews-before.json') -Raw | ConvertFrom-Json
$kwCombatPreviewFiles = @(Get-ChildItem -LiteralPath $kwCombatPreviews -File -Recurse)
if ($kwCombatPreviewFiles.Count -ne 793) { throw 'Historical preview count mismatch' }
foreach ($kwCombatPreviewItem in $kwCombatPreviewMap.PSObject.Properties) {
    $kwCombatPreviewPath = Join-Path $kwCombatPreviews $kwCombatPreviewItem.Name
    if (-not (Test-Path -LiteralPath $kwCombatPreviewPath -PathType Leaf)) { throw 'Historical preview missing' }
    if ((Get-FileHash -LiteralPath $kwCombatPreviewPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $kwCombatPreviewItem.Value) { throw 'Historical preview bytes changed' }
}
$kwCombatMainRelease = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath (Join-Path $kwCombatStage $kwCombatMainRelease.main) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $kwCombatMainRelease.hashes.main) { throw 'Stage main bundle mismatch' }
$kwCombatVersion = [regex]::Match($kwCombatRelease.entry, '\?v=(\d+)').Groups[1].Value
if (-not $kwCombatVersion) { throw 'Missing rebuilt entry version' }
$kwCombatRecord = [ordered]@{
    stage = $kwCombatStage; priorPreviewStage = $kwCombatPrior; entryVersion = $kwCombatVersion
    project = 'kingdom-watch'; branch = 'main'
    game = ('https://kingdom-watch.pages.dev/?v=elite-icon-v71-' + $kwCombatVersion)
    manualAcceptance = 'pending user manual review'
}
$kwCombatRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $kwCombatBuild 'build-record.json') -Destination (Join-Path $PSScriptRoot 'build-record.json') -Force
Copy-Item -LiteralPath (Join-Path $kwCombatBuild 'web-release.json') -Destination (Join-Path $PSScriptRoot 'web-release.json') -Force
$kwCombatProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwCombatProxy.ProxyEnable -eq 1 -and $kwCombatProxy.ProxyServer) {
    $kwCombatProxyAddress = $kwCombatProxy.ProxyServer
    if ($kwCombatProxyAddress -match '(?:^|;)https=([^;]+)') { $kwCombatProxyAddress = $Matches[1] }
    elseif ($kwCombatProxyAddress -match '(?:^|;)http=([^;]+)') { $kwCombatProxyAddress = $Matches[1] }
    if ($kwCombatProxyAddress -notmatch '^https?://') { $kwCombatProxyAddress = 'http://' + $kwCombatProxyAddress }
    $env:HTTPS_PROXY = $kwCombatProxyAddress
}
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js' pages deploy $kwCombatStage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'deploy.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwCombatRecord | ConvertTo-Json -Compress
