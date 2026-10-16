$ErrorActionPreference = 'Stop'
$kwSwipeOut = Join-Path $env:TEMP 'kw-level-breakthrough-swipe-v1-20261016-out.log'
$kwSwipeErr = Join-Path $env:TEMP 'kw-level-breakthrough-swipe-v1-20261016-err.log'
$kwSwipeBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwSwipeOut -RedirectStandardError $kwSwipeErr
$kwSwipeBuild.WaitForExit()
$kwSwipeBuild.Refresh()
$kwSwipeCode = $kwSwipeBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwSwipeCode)
if ($kwSwipeCode -ne 0 -and $kwSwipeCode -ne 36) {
    Get-Content -LiteralPath $kwSwipeErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwSwipeOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwSwipeRecord = [ordered]@{
    exitCode = $kwSwipeCode; log = $kwSwipeOut; stderr = $kwSwipeErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'hero level and weapon breakthroughs use the existing skill milestone swipe interaction'
    gameplayValidation = 'user manual'
}
$kwSwipeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
