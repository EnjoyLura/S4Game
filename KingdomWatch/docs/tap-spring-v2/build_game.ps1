$ErrorActionPreference = 'Stop'
$kwTapSpringOut = Join-Path $env:TEMP 'kw-tap-spring-v2-20261015-out.log'
$kwTapSpringErr = Join-Path $env:TEMP 'kw-tap-spring-v2-20261015-err.log'
$kwTapSpringBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwTapSpringOut -RedirectStandardError $kwTapSpringErr
$kwTapSpringBuild.WaitForExit()
$kwTapSpringBuild.Refresh()
$kwTapSpringCode = $kwTapSpringBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwTapSpringCode)
if ($kwTapSpringCode -ne 0 -and $kwTapSpringCode -ne 36) {
    Get-Content -LiteralPath $kwTapSpringErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwTapSpringOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwTapSpringRecord = [ordered]@{ exitCode = $kwTapSpringCode; log = $kwTapSpringOut; stderr = $kwTapSpringErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'whole-game tap feedback and elastic buttons without whitening'; gameplayValidation = 'user manual' }
$kwTapSpringRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8








