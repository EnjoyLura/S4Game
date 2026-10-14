$ErrorActionPreference = 'Stop'
$kwSettlementOut = Join-Path $env:TEMP 'kw-settlement-comic-v1-20261015-out.log'
$kwSettlementErr = Join-Path $env:TEMP 'kw-settlement-comic-v1-20261015-err.log'
$kwSettlementBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwSettlementOut -RedirectStandardError $kwSettlementErr
$kwSettlementBuild.WaitForExit()
$kwSettlementBuild.Refresh()
$kwSettlementCode = $kwSettlementBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwSettlementCode)
if ($kwSettlementCode -ne 0 -and $kwSettlementCode -ne 36) {
    Get-Content -LiteralPath $kwSettlementErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwSettlementOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwSettlementRecord = [ordered]@{ exitCode = $kwSettlementCode; log = $kwSettlementOut; stderr = $kwSettlementErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'win/lose settlement artwork and fire-mage idle/attack integration'; gameplayValidation = 'user manual' }
$kwSettlementRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
