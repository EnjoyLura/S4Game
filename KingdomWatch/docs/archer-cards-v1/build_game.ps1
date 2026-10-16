$ErrorActionPreference = 'Stop'
$kwArcherCardsOut = Join-Path $env:TEMP 'kw-archer-cards-v1-20261015-out.log'
$kwArcherCardsErr = Join-Path $env:TEMP 'kw-archer-cards-v1-20261015-err.log'
$kwArcherCardsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwArcherCardsOut -RedirectStandardError $kwArcherCardsErr
$kwArcherCardsBuild.WaitForExit()
$kwArcherCardsBuild.Refresh()
$kwArcherCardsCode = $kwArcherCardsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwArcherCardsCode)
if ($kwArcherCardsCode -ne 0 -and $kwArcherCardsCode -ne 36) {
    Get-Content -LiteralPath $kwArcherCardsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwArcherCardsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwArcherCardsRecord = [ordered]@{ exitCode = $kwArcherCardsCode; log = $kwArcherCardsOut; stderr = $kwArcherCardsErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'archer four-rarity cards, attack tradeoffs, five-stack serial and fan, shared per-hero numeric cards'; gameplayValidation = 'user manual' }
$kwArcherCardsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
