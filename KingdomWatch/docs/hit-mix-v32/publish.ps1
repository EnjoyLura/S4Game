$ErrorActionPreference = 'Stop'
$kwV32Root = 'D:/AI/S4Game/KingdomWatch'
$kwV32RecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwV32Record = Get-Content -LiteralPath $kwV32RecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwV32Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwV32Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwV32Log = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwV32Match = [regex]::Match($kwV32Log, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwV32Log.Contains('Deployment complete') -or !$kwV32Match.Success) { throw 'Deployment completion was not confirmed' }
$kwV32Record.published = $true
$kwV32Record | Add-Member -NotePropertyName deployment -NotePropertyValue $kwV32Match.Value -Force
$kwV32Record | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwV32Record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwV32RecordPath -Encoding utf8
