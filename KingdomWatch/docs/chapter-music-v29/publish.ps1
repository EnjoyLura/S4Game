$ErrorActionPreference = 'Stop'
$kwV29Root = 'D:/AI/S4Game/KingdomWatch'
$kwV29RecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwV29Record = Get-Content -LiteralPath $kwV29RecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwV29Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwV29Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwV29Log = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwV29Match = [regex]::Match($kwV29Log, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwV29Log.Contains('Deployment complete') -or !$kwV29Match.Success) { throw 'Deployment completion was not confirmed' }
$kwV29Record.published = $true
$kwV29Record | Add-Member -NotePropertyName deployment -NotePropertyValue $kwV29Match.Value -Force
$kwV29Record | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwV29Record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwV29RecordPath -Encoding utf8
