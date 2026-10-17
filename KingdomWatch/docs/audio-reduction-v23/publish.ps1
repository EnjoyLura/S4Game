$ErrorActionPreference = 'Stop'
$kwReductionRoot = 'D:/AI/S4Game/KingdomWatch'
$kwReductionRecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwReductionRecord = Get-Content -LiteralPath $kwReductionRecordPath -Raw | ConvertFrom-Json
$kwReductionProxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwReductionProxy.ProxyEnable -eq 1 -and $kwReductionProxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwReductionProxy.ProxyServer }
Set-Location -LiteralPath $kwReductionRoot
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwReductionRecord.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
