$ErrorActionPreference = 'Stop'
$kwWebGame = 'D:/AI/S4Game/KingdomWatch'
$kwWebInspection = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'bundle-inspection.json') -Raw | ConvertFrom-Json
if ($kwWebInspection.checks.PSObject.Properties.Value -contains $false) { throw 'Offline inspection incomplete' }
$kwWebPriorRecord = Get-Content -LiteralPath (Join-Path $kwWebGame 'docs/battle-rewards-feather-v20/deployment-stage.json') -Raw | ConvertFrom-Json
$kwWebPrior = $kwWebPriorRecord.stage
$kwWebBuild = Join-Path $kwWebGame 'build/web-mobile'
$kwWebBuildRecord = Get-Content -LiteralPath (Join-Path $kwWebBuild 'build-record.json') -Raw | ConvertFrom-Json
$kwWebRelease = Get-Content -LiteralPath (Join-Path $kwWebBuild 'web-release.json') -Raw | ConvertFrom-Json
if ($kwWebBuildRecord.debug -ne $false -or -not $kwWebRelease.production) { throw 'Prepared production build required' }
$kwWebStage = Join-Path $kwWebGame ('build/publish-audio-overhaul-v21-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwWebStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwWebStage | Out-Null
Get-ChildItem -LiteralPath $kwWebBuild -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwWebStage -Recurse -Force
$kwWebPreviews = Join-Path $kwWebStage 'previews'
New-Item -ItemType Directory -Path $kwWebPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwWebPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwWebPreviews -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $kwWebPreviews 'audio-overhaul-v21') | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'preview') -Force | Copy-Item -Destination (Join-Path $kwWebPreviews 'audio-overhaul-v21') -Recurse -Force
$kwWebVersion = [regex]::Match($kwWebRelease.entry, '\?v=(\d+)').Groups[1].Value
if (-not $kwWebVersion) { throw 'Missing rebuilt entry version' }
$kwWebRecord = [ordered]@{
    stage = $kwWebStage; priorPublishedStage = $kwWebPrior; entryVersion = $kwWebVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=audio-overhaul-v21-' + $kwWebVersion)
    preview = ('https://kingdom-watch.pages.dev/previews/audio-overhaul-v21/?v=' + $kwWebVersion)
    scope = '83 edited licensed audio samples: five-hero combat, distinct card picker, reward/purchase/recruit, victory/defeat and growth; synchronized semantic cues, voice priorities, dynamic mix and manual old/new listening page'
    manualAcceptance = 'pending user manual review'
}
$kwWebRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $kwWebBuild 'build-record.json') -Destination (Join-Path $PSScriptRoot 'build-record.json') -Force
Copy-Item -LiteralPath (Join-Path $kwWebBuild 'web-release.json') -Destination (Join-Path $PSScriptRoot 'web-release.json') -Force
$kwWebProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwWebProxy.ProxyEnable -eq 1 -and $kwWebProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwWebProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwWebStage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwWebRecord | ConvertTo-Json -Compress


