$ErrorActionPreference = 'Stop'
$kwAudioReviewRoot = 'D:/AI/S4Game/KingdomWatch'
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' -X utf8 (Join-Path $PSScriptRoot 'stage.py')
if ($LASTEXITCODE -ne 0) { throw 'Offline preview stage inspection failed' }
$kwAudioReviewRecord = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Raw | ConvertFrom-Json
$kwAudioReviewProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwAudioReviewProxy.ProxyEnable -eq 1 -and $kwAudioReviewProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwAudioReviewProxy.ProxyServer }
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwAudioReviewRecord.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Preview publication failed; stage preserved' }
$kwAudioReviewRecord | ConvertTo-Json -Compress
