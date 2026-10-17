$ErrorActionPreference = 'Stop'
$kwV26Root = 'D:/AI/S4Game/KingdomWatch'
$kwV26RecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwV26Record = Get-Content -LiteralPath $kwV26RecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwV26Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwV26Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwV26Log = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwV26Match = [regex]::Match($kwV26Log, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwV26Log.Contains('Deployment complete') -or !$kwV26Match.Success) { throw 'Deployment completion was not confirmed' }
$kwV26Record.published = $true
$kwV26Record | Add-Member -NotePropertyName deployment -NotePropertyValue $kwV26Match.Value -Force
$kwV26Record | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwV26Record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwV26RecordPath -Encoding utf8
