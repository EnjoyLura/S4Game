$ErrorActionPreference = 'Stop'
$kwPauseOut = Join-Path $env:TEMP 'kw-pause-comic-v1-20261014-out.log'
$kwPauseErr = Join-Path $env:TEMP 'kw-pause-comic-v1-20261014-err.log'
$kwPauseBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwPauseOut -RedirectStandardError $kwPauseErr
$kwPauseBuild.WaitForExit()
$kwPauseBuild.Refresh()
$kwPauseCode = $kwPauseBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwPauseCode)
if ($kwPauseCode -ne 0 -and $kwPauseCode -ne 36) {
    Get-Content -LiteralPath $kwPauseErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwPauseOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwPauseRecord = [ordered]@{ exitCode = $kwPauseCode; log = $kwPauseOut; stderr = $kwPauseErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'pause art only'; gameplayValidation = 'user manual' }
$kwPauseRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
