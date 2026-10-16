$ErrorActionPreference = 'Stop'
$kwTrainingFixOut = Join-Path $env:TEMP 'kw-training-defense-entry-v1-20261016-out.log'
$kwTrainingFixErr = Join-Path $env:TEMP 'kw-training-defense-entry-v1-20261016-err.log'
$kwTrainingFixBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwTrainingFixOut -RedirectStandardError $kwTrainingFixErr
$kwTrainingFixBuild.WaitForExit()
$kwTrainingFixBuild.Refresh()
$kwTrainingFixCode = $kwTrainingFixBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwTrainingFixCode)
if ($kwTrainingFixCode -ne 0 -and $kwTrainingFixCode -ne 36) {
    Get-Content -LiteralPath $kwTrainingFixErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwTrainingFixOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwTrainingFixRecord = [ordered]@{
    exitCode = $kwTrainingFixCode; log = $kwTrainingFixOut; stderr = $kwTrainingFixErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'smooth milestone gestures; saved keep HP/shield in every new battle; two real foreground seconds of closed-door hold'
    gameplayValidation = 'user manual'
}
$kwTrainingFixRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
