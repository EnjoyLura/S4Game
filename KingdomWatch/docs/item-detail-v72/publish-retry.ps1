param([string]$ProxyUrl = '')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'D:/AI/S4Game/KingdomWatch'
if ($ProxyUrl) { $env:HTTPS_PROXY = $ProxyUrl; $env:HTTP_PROXY = $ProxyUrl }
$kwItemDetailStage = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Raw | ConvertFrom-Json).stage
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js' pages deploy $kwItemDetailStage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'deploy-retry.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication retry failed; prepared stage preserved' }
