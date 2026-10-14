$ErrorActionPreference = 'Stop'
$kwBasicLaunchOut = Join-Path $env:TEMP 'kw-basic-launch-v1-20261015-out.log'
$kwBasicLaunchErr = Join-Path $env:TEMP 'kw-basic-launch-v1-20261015-err.log'
$kwBasicLaunchBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwBasicLaunchOut -RedirectStandardError $kwBasicLaunchErr
$kwBasicLaunchBuild.WaitForExit()
$kwBasicLaunchBuild.Refresh()
$kwBasicLaunchCode = $kwBasicLaunchBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwBasicLaunchCode)
if ($kwBasicLaunchCode -ne 0 -and $kwBasicLaunchCode -ne 36) {
    Get-Content -LiteralPath $kwBasicLaunchErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwBasicLaunchOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwBasicLaunchRecord = [ordered]@{ exitCode = $kwBasicLaunchCode; log = $kwBasicLaunchOut; stderr = $kwBasicLaunchErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'five hero basic projectile releases: bow/crossbow wind pressure, fire jet, violet lightning and frost crystals'; gameplayValidation = 'user manual' }
$kwBasicLaunchRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
