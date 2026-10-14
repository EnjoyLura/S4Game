$ErrorActionPreference = 'Stop'
$kwLaunchProceduralOut = Join-Path $env:TEMP 'kw-basic-launch-procedural-v3-20261015-out.log'
$kwLaunchProceduralErr = Join-Path $env:TEMP 'kw-basic-launch-procedural-v3-20261015-err.log'
$kwLaunchProceduralBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwLaunchProceduralOut -RedirectStandardError $kwLaunchProceduralErr
$kwLaunchProceduralBuild.WaitForExit()
$kwLaunchProceduralBuild.Refresh()
$kwLaunchProceduralCode = $kwLaunchProceduralBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwLaunchProceduralCode)
if ($kwLaunchProceduralCode -ne 0 -and $kwLaunchProceduralCode -ne 36) {
    Get-Content -LiteralPath $kwLaunchProceduralErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwLaunchProceduralOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwLaunchProceduralRecord = [ordered]@{ exitCode = $kwLaunchProceduralCode; log = $kwLaunchProceduralOut; stderr = $kwLaunchProceduralErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'procedural basic releases, measured status icons and right-anchored shield depletion'; gameplayValidation = 'user manual' }
$kwLaunchProceduralRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8

