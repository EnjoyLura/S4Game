$ErrorActionPreference = 'Stop'
$kwDeathOut = Join-Path $env:TEMP 'kw-enemy-death-v1-20261015-out.log'
$kwDeathErr = Join-Path $env:TEMP 'kw-enemy-death-v1-20261015-err.log'
$kwDeathBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwDeathOut -RedirectStandardError $kwDeathErr
$kwDeathBuild.WaitForExit()
$kwDeathBuild.Refresh()
$kwDeathCode = $kwDeathBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwDeathCode)
if ($kwDeathCode -ne 0 -and $kwDeathCode -ne 36) {
    Get-Content -LiteralPath $kwDeathErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwDeathOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwDeathRecord = [ordered]@{ exitCode = $kwDeathCode; log = $kwDeathOut; stderr = $kwDeathErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'directional enemy death, weighted fall, contact dust and elemental silhouette dissolve on simulation clock'; gameplayValidation = 'user manual' }
$kwDeathRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
