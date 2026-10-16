$ErrorActionPreference = 'Stop'
$kwVoltVfxOut = Join-Path $env:TEMP 'kw-volt-vfx-enhance-v1-20261015-out.log'
$kwVoltVfxErr = Join-Path $env:TEMP 'kw-volt-vfx-enhance-v1-20261015-err.log'
$kwVoltVfxBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwVoltVfxOut -RedirectStandardError $kwVoltVfxErr
$kwVoltVfxBuild.WaitForExit()
$kwVoltVfxBuild.Refresh()
$kwVoltVfxCode = $kwVoltVfxBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwVoltVfxCode)
if ($kwVoltVfxCode -ne 0 -and $kwVoltVfxCode -ne 36) {
    Get-Content -LiteralPath $kwVoltVfxErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwVoltVfxOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwVoltVfxRecord = [ordered]@{ exitCode = $kwVoltVfxCode; log = $kwVoltVfxOut; stderr = $kwVoltVfxErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'procedural Volt normal projectile, chain lightning and ultimate thunder effects'; gameplayValidation = 'user manual' }
$kwVoltVfxRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
