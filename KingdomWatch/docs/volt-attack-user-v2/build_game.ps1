$ErrorActionPreference = 'Stop'
$kwVoltOut = Join-Path $env:TEMP 'kw-volt-attack-user-v2-20261014-out.log'
$kwVoltErr = Join-Path $env:TEMP 'kw-volt-attack-user-v2-20261014-err.log'
$kwVoltBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwVoltOut -RedirectStandardError $kwVoltErr
$kwVoltBuild.WaitForExit()
$kwVoltBuild.Refresh()
$kwVoltCode = $kwVoltBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwVoltCode)
if ($kwVoltCode -ne 0 -and $kwVoltCode -ne 36) {
    Get-Content -LiteralPath $kwVoltErr -Tail 30
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwVoltOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
& 'C:/Program Files/nodejs/node.exe' docs/volt-attack-user-v2/build_preview.cjs
if ($LASTEXITCODE -ne 0) { throw 'Preview packaging failed' }
$kwVoltBuildRecord = [ordered]@{ exitCode = $kwVoltCode; log = $kwVoltOut; stderr = $kwVoltErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; gameAttackChanged = $true }
$kwVoltBuildRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
