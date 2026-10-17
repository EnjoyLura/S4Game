$ErrorActionPreference = 'Stop'
$kwV28Root = 'D:/AI/S4Game/KingdomWatch'
$kwV28RecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwV28Record = Get-Content -LiteralPath $kwV28RecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwV28Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwV28Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwV28Log = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwV28Match = [regex]::Match($kwV28Log, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwV28Log.Contains('Deployment complete') -or !$kwV28Match.Success) { throw 'Deployment completion was not confirmed' }
$kwV28Record.published = $true
$kwV28Record | Add-Member -NotePropertyName deployment -NotePropertyValue $kwV28Match.Value -Force
$kwV28Record | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwV28Record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwV28RecordPath -Encoding utf8
