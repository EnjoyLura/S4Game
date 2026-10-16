$ErrorActionPreference = 'Stop'
$kwStageXpOut = Join-Path $env:TEMP 'kw-stage-xp-flow-v1-20261016-out.log'
$kwStageXpErr = Join-Path $env:TEMP 'kw-stage-xp-flow-v1-20261016-err.log'
$kwStageXpBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwStageXpOut -RedirectStandardError $kwStageXpErr
$kwStageXpBuild.WaitForExit()
$kwStageXpBuild.Refresh()
$kwStageXpCode = $kwStageXpBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwStageXpCode)
if ($kwStageXpCode -ne 0 -and $kwStageXpCode -ne 36) {
    Get-Content -LiteralPath $kwStageXpErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwStageXpOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwStageXpRecord = [ordered]@{
    exitCode = $kwStageXpCode; log = $kwStageXpOut; stderr = $kwStageXpErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'unbacked stage level text, steady-color XP bar and battle-clock passive XP'
    gameplayValidation = 'user manual'
}
$kwStageXpRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
