$ErrorActionPreference = 'Stop'
$kwDualDamageOut = Join-Path $env:TEMP 'kw-dual-base-damage-v1-20261015-out.log'
$kwDualDamageErr = Join-Path $env:TEMP 'kw-dual-base-damage-v1-20261015-err.log'
$kwDualDamageBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwDualDamageOut -RedirectStandardError $kwDualDamageErr
$kwDualDamageBuild.WaitForExit()
$kwDualDamageBuild.Refresh()
$kwDualDamageCode = $kwDualDamageBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwDualDamageCode)
if ($kwDualDamageCode -ne 0 -and $kwDualDamageCode -ne 36) {
    Get-Content -LiteralPath $kwDualDamageErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwDualDamageOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwDualDamageRecord = [ordered]@{ exitCode = $kwDualDamageCode; log = $kwDualDamageOut; stderr = $kwDualDamageErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'independent attack and skill damage with role growth; remove green death residue'; gameplayValidation = 'user manual' }
$kwDualDamageRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
