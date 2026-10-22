$ErrorActionPreference = 'Stop'
$kwV31Root = 'D:/AI/S4Game/KingdomWatch'
$kwV31RecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwV31Record = Get-Content -LiteralPath $kwV31RecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwV31Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwV31Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwV31Log = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwV31Match = [regex]::Match($kwV31Log, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwV31Log.Contains('Deployment complete') -or !$kwV31Match.Success) { throw 'Deployment completion was not confirmed' }
$kwV31Record.published = $true
$kwV31Record | Add-Member -NotePropertyName deployment -NotePropertyValue $kwV31Match.Value -Force
$kwV31Record | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwV31Record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwV31RecordPath -Encoding utf8
