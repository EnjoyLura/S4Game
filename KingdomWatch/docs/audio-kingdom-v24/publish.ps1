$ErrorActionPreference = 'Stop'
$kwAudioV24Root = 'D:/AI/S4Game/KingdomWatch'
$kwAudioV24Record = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deployment-stage.json') -Raw | ConvertFrom-Json
$kwAudioV24Proxy = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Internet Settings'
if ($kwAudioV24Proxy.ProxyEnable -eq 1 -and $kwAudioV24Proxy.ProxyServer) { $env:HTTPS_PROXY = 'http://' + $kwAudioV24Proxy.ProxyServer }
Set-Location -LiteralPath $kwAudioV24Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwAudioV24Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
