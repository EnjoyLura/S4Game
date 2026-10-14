$ErrorActionPreference = 'Stop'
$kwShieldProjectileOut = Join-Path $env:TEMP 'kw-shield-projectile-v2-20261015-out.log'
$kwShieldProjectileErr = Join-Path $env:TEMP 'kw-shield-projectile-v2-20261015-err.log'
$kwShieldProjectileBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwShieldProjectileOut -RedirectStandardError $kwShieldProjectileErr
$kwShieldProjectileBuild.WaitForExit()
$kwShieldProjectileBuild.Refresh()
$kwShieldProjectileCode = $kwShieldProjectileBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwShieldProjectileCode)
if ($kwShieldProjectileCode -ne 0 -and $kwShieldProjectileCode -ne 36) {
    Get-Content -LiteralPath $kwShieldProjectileErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwShieldProjectileOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwShieldProjectileRecord = [ordered]@{ exitCode = $kwShieldProjectileCode; log = $kwShieldProjectileOut; stderr = $kwShieldProjectileErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'blue shield shell, stacked HP/shield values, raised health and ult icons; painted basic releases and elemental flight wakes'; gameplayValidation = 'user manual' }
$kwShieldProjectileRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
