$ErrorActionPreference = 'Stop'
$kwWebGame = 'D:/AI/S4Game/KingdomWatch'
$kwWebPriorRecord = Get-Content -LiteralPath (Join-Path $kwWebGame 'docs/feedback-polish-v17/deployment-stage.json') -Raw | ConvertFrom-Json
$kwWebPrior = $kwWebPriorRecord.stage
$kwWebBuild = Join-Path $kwWebGame 'build/web-mobile'
$kwWebBuildRecord = Get-Content -LiteralPath (Join-Path $kwWebBuild 'build-record.json') -Raw | ConvertFrom-Json
$kwWebRelease = Get-Content -LiteralPath (Join-Path $kwWebBuild 'web-release.json') -Raw | ConvertFrom-Json
if ($kwWebBuildRecord.debug -ne $false -or -not $kwWebRelease.production) { throw 'Prepared production build required' }
$kwWebStage = Join-Path $kwWebGame ('build/publish-toast-middle-rise-v18-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $kwWebStage) { throw 'Publication stage already exists' }
New-Item -ItemType Directory -Path $kwWebStage | Out-Null
Get-ChildItem -LiteralPath $kwWebBuild -Force | Where-Object Name -ne 'previews' | Copy-Item -Destination $kwWebStage -Recurse -Force
$kwWebPreviews = Join-Path $kwWebStage 'previews'
New-Item -ItemType Directory -Path $kwWebPreviews | Out-Null
Get-ChildItem -LiteralPath (Join-Path $kwWebPrior 'previews') -Force | Where-Object Name -ne 'archer-native-v1' | Copy-Item -Destination $kwWebPreviews -Recurse -Force
$kwModalSource = Join-Path $kwWebGame 'docs/battle-modal-art-concept-v18'
$kwModalTarget = Join-Path $kwWebPreviews 'battle-modal-v18'
New-Item -ItemType Directory -Path $kwModalTarget | Out-Null
foreach ($kwModalName in @('index.html','motion-spec.md','pause-v18.png','victory-v18.png','defeat-v18.png','assets')) {
    Copy-Item -LiteralPath (Join-Path $kwModalSource $kwModalName) -Destination $kwModalTarget -Recurse -Force
}
$kwWebVersion = [regex]::Match($kwWebRelease.entry, '\?v=(\d+)').Groups[1].Value
if (-not $kwWebVersion) { throw 'Missing rebuilt entry version' }
$kwWebRecord = [ordered]@{
    stage = $kwWebStage; priorPublishedStage = $kwWebPrior; entryVersion = $kwWebVersion
    project = 'kingdom-watch'; branch = 'main'; game = ('https://kingdom-watch.pages.dev/?v=toast-middle-rise-v18-' + $kwWebVersion)
    scope = 'ordinary and growth toasts appear at screen center, rise to upper-middle, hold, then fade upward; separate battle modal art and motion design preview'
    preview = 'https://kingdom-watch.pages.dev/previews/battle-modal-v18/'
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


