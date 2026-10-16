$ErrorActionPreference = 'Stop'
$kwBattleButtonsOut = Join-Path $env:TEMP 'kw-battle-buttons-lobby-v1-20261015-out.log'
$kwBattleButtonsErr = Join-Path $env:TEMP 'kw-battle-buttons-lobby-v1-20261015-err.log'
$kwBattleButtonsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwBattleButtonsOut -RedirectStandardError $kwBattleButtonsErr
$kwBattleButtonsBuild.WaitForExit()
$kwBattleButtonsBuild.Refresh()
$kwBattleButtonsCode = $kwBattleButtonsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwBattleButtonsCode)
if ($kwBattleButtonsCode -ne 0 -and $kwBattleButtonsCode -ne 36) {
    Get-Content -LiteralPath $kwBattleButtonsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwBattleButtonsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwBattleButtonsRecord = [ordered]@{ exitCode = $kwBattleButtonsCode; log = $kwBattleButtonsOut; stderr = $kwBattleButtonsErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'reuse lobby button styling in battle panels'; gameplayValidation = 'user manual' }
$kwBattleButtonsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8




