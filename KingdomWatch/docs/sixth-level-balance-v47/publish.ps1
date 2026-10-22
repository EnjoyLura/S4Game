$ErrorActionPreference = 'Stop'
$kwRenderRoot = 'D:/AI/S4Game/KingdomWatch'
$kwRenderRecordPath = Join-Path $PSScriptRoot 'deployment-stage.json'
$kwRenderRecord = Get-Content -LiteralPath $kwRenderRecordPath -Raw | ConvertFrom-Json
Set-Location -LiteralPath $kwRenderRoot
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/user/AppData/Local/npm-cache/_npx/0eedb5afd4158ff3/node_modules/wrangler/bin/wrangler.js' pages deploy $kwRenderRecord.stage --project-name=kingdom-watch --branch=main --commit-dirty=true 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'publish.log')
if ($LASTEXITCODE -ne 0) { throw 'Publication failed; stage preserved' }
$kwRenderLog = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'publish.log') -Raw
$kwRenderMatch = [regex]::Match($kwRenderLog, 'https://[a-z0-9]+\.kingdom-watch\.pages\.dev')
if (!$kwRenderLog.Contains('Deployment complete') -or !$kwRenderMatch.Success) { throw 'Deployment completion was not confirmed' }
$kwRenderRecord.published = $true
$kwRenderRecord | Add-Member -NotePropertyName deployment -NotePropertyValue $kwRenderMatch.Value -Force
$kwRenderRecord | Add-Member -NotePropertyName publicationNote -NotePropertyValue 'Wrangler reported Deployment complete; no game/browser/audio playback performed' -Force
$kwRenderRecord | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $kwRenderRecordPath -Encoding utf8
