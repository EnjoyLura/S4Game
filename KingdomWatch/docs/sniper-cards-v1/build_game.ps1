$ErrorActionPreference = 'Stop'
$kwSniperCardsOut = Join-Path $env:TEMP 'kw-sniper-cards-v1-20261015-out.log'
$kwSniperCardsErr = Join-Path $env:TEMP 'kw-sniper-cards-v1-20261015-err.log'
$kwSniperCardsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwSniperCardsOut -RedirectStandardError $kwSniperCardsErr
$kwSniperCardsBuild.WaitForExit()
$kwSniperCardsBuild.Refresh()
$kwSniperCardsCode = $kwSniperCardsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwSniperCardsCode)
if ($kwSniperCardsCode -ne 0 -and $kwSniperCardsCode -ne 36) {
    Get-Content -LiteralPath $kwSniperCardsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwSniperCardsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwSniperCardsRecord = [ordered]@{ exitCode = $kwSniperCardsCode; log = $kwSniperCardsOut; stderr = $kwSniperCardsErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'sniper card rarities, skill range and piercing, 30 percent ultimate vulnerability with overhead red reticle, three generated icons'; gameplayValidation = 'user manual' }
$kwSniperCardsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
