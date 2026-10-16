$ErrorActionPreference = 'Stop'
$kwPickMotionOut = Join-Path $env:TEMP 'kw-pick-motion-v2-20261016-out.log'
$kwPickMotionErr = Join-Path $env:TEMP 'kw-pick-motion-v2-20261016-err.log'
$kwPickMotionBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwPickMotionOut -RedirectStandardError $kwPickMotionErr
$kwPickMotionBuild.WaitForExit()
$kwPickMotionBuild.Refresh()
$kwPickMotionCode = $kwPickMotionBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwPickMotionCode)
if ($kwPickMotionCode -ne 0 -and $kwPickMotionCode -ne 36) {
    Get-Content -LiteralPath $kwPickMotionErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwPickMotionOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwPickMotionRecord = [ordered]@{
    exitCode = $kwPickMotionCode; log = $kwPickMotionOut; stderr = $kwPickMotionErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'charge readiness compiler fix, original picker motion, insufficient funds feedback and full-screen battle entry'
    gameplayValidation = 'user manual'
}
$kwPickMotionRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
