$ErrorActionPreference = 'Stop'
$kwDeathBurstOut = Join-Path $env:TEMP 'kw-enemy-death-burst-v2-20261015-out.log'
$kwDeathBurstErr = Join-Path $env:TEMP 'kw-enemy-death-burst-v2-20261015-err.log'
$kwDeathBurstBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwDeathBurstOut -RedirectStandardError $kwDeathBurstErr
$kwDeathBurstBuild.WaitForExit()
$kwDeathBurstBuild.Refresh()
$kwDeathBurstCode = $kwDeathBurstBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwDeathBurstCode)
if ($kwDeathBurstCode -ne 0 -and $kwDeathBurstCode -ne 36) {
    Get-Content -LiteralPath $kwDeathBurstErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwDeathBurstOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwDeathBurstRecord = [ordered]@{ exitCode = $kwDeathBurstCode; log = $kwDeathBurstOut; stderr = $kwDeathBurstErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'in-place enemy material burst and fading ground splatter; remove all whole-body falling'; gameplayValidation = 'user manual' }
$kwDeathBurstRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
