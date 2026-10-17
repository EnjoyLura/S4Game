$ErrorActionPreference = 'Stop'
$kwV30Root = 'D:/AI/S4Game/KingdomWatch'
$kwV30RecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwV30Record = Get-Content -LiteralPath $kwV30RecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwV30Root
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwV30Record.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwV30Log = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwV30Match = [regex]::Match($kwV30Log, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwV30Log.Contains('Deployment complete') -or !$kwV30Match.Success) { throw 'Deployment completion was not confirmed' }
$kwV30Record.published = $true
$kwV30Record | Add-Member -NotePropertyName deployment -NotePropertyValue $kwV30Match.Value -Force
$kwV30Record | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwV30Record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwV30RecordPath -Encoding utf8
