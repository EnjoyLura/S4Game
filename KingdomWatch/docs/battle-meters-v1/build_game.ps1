$ErrorActionPreference = 'Stop'
$kwMetersOut = Join-Path $env:TEMP 'kw-battle-meters-v1-20261014-out.log'
$kwMetersErr = Join-Path $env:TEMP 'kw-battle-meters-v1-20261014-err.log'
$kwMetersBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwMetersOut -RedirectStandardError $kwMetersErr
$kwMetersBuild.WaitForExit()
$kwMetersBuild.Refresh()
$kwMetersCode = $kwMetersBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwMetersCode)
if ($kwMetersCode -ne 0 -and $kwMetersCode -ne 36) {
    Get-Content -LiteralPath $kwMetersErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwMetersOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwMetersRecord = [ordered]@{ exitCode = $kwMetersCode; log = $kwMetersOut; stderr = $kwMetersErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'battle progress bars and shield display'; gameplayValidation = 'user manual' }
$kwMetersRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
