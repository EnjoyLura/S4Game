$ErrorActionPreference = 'Stop'
$kwBattleDeathOut = Join-Path $env:TEMP 'kw-battle-exit-death-v3-20261016-out.log'
$kwBattleDeathErr = Join-Path $env:TEMP 'kw-battle-exit-death-v3-20261016-err.log'
$kwBattleDeathBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwBattleDeathOut -RedirectStandardError $kwBattleDeathErr
$kwBattleDeathBuild.WaitForExit()
$kwBattleDeathBuild.Refresh()
$kwBattleDeathCode = $kwBattleDeathBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwBattleDeathCode)
if ($kwBattleDeathCode -ne 0 -and $kwBattleDeathCode -ne 36) {
    Get-Content -LiteralPath $kwBattleDeathErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwBattleDeathOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwBattleDeathRecord = [ordered]@{
    exitCode = $kwBattleDeathCode; log = $kwBattleDeathOut; stderr = $kwBattleDeathErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'scene exit ownership fix, kill audio and death snap, forward weapon wind'
    gameplayValidation = 'user manual'
}
$kwBattleDeathRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
