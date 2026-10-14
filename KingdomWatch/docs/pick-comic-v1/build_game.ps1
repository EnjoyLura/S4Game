$ErrorActionPreference = 'Stop'
$kwPickOut = Join-Path $env:TEMP 'kw-pick-comic-v1-20261015-out.log'
$kwPickErr = Join-Path $env:TEMP 'kw-pick-comic-v1-20261015-err.log'
$kwPickBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwPickOut -RedirectStandardError $kwPickErr
$kwPickBuild.WaitForExit()
$kwPickBuild.Refresh()
$kwPickCode = $kwPickBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwPickCode)
if ($kwPickCode -ne 0 -and $kwPickCode -ne 36) {
    Get-Content -LiteralPath $kwPickErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwPickOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwPickRecord = [ordered]@{ exitCode = $kwPickCode; log = $kwPickOut; stderr = $kwPickErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'original pick artwork and lower placement; ice idle/attack; new fire attack and idle loop; sniper 0.5/s, fire and volt 1/s'; gameplayValidation = 'user manual' }
$kwPickRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
