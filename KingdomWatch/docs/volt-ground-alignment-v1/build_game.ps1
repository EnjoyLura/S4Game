$ErrorActionPreference = 'Stop'
$kwVoltGroundOut = Join-Path $env:TEMP 'kw-volt-ground-alignment-v1-20261015-out.log'
$kwVoltGroundErr = Join-Path $env:TEMP 'kw-volt-ground-alignment-v1-20261015-err.log'
$kwVoltGroundBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwVoltGroundOut -RedirectStandardError $kwVoltGroundErr
$kwVoltGroundBuild.WaitForExit()
$kwVoltGroundBuild.Refresh()
$kwVoltGroundCode = $kwVoltGroundBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwVoltGroundCode)
if ($kwVoltGroundCode -ne 0 -and $kwVoltGroundCode -ne 36) {
    Get-Content -LiteralPath $kwVoltGroundErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwVoltGroundOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwVoltGroundRecord = [ordered]@{ exitCode = $kwVoltGroundCode; log = $kwVoltGroundOut; stderr = $kwVoltGroundErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'align thunder ground ring, synchronize sniper multi-target aim, commit pyro meteors to spread-out warned ground points'; gameplayValidation = 'user manual' }
$kwVoltGroundRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
