$ErrorActionPreference = 'Stop'
$kwMagesV25Root = 'D:/AI/S4Game/KingdomWatch'
$kwMagesV25Record = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Raw | ConvertFrom-Json
$kwMagesV25Proxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwMagesV25Proxy.ProxyEnable -eq 1 -and $kwMagesV25Proxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwMagesV25Proxy.ProxyServer }
Set-Location -LiteralPath $kwMagesV25Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwMagesV25Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
