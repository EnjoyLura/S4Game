$ErrorActionPreference = 'Stop'
$kwLaunchEmphasisOut = Join-Path $env:TEMP 'kw-basic-launch-emphasis-v4-20261015-out.log'
$kwLaunchEmphasisErr = Join-Path $env:TEMP 'kw-basic-launch-emphasis-v4-20261015-err.log'
$kwLaunchEmphasisBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwLaunchEmphasisOut -RedirectStandardError $kwLaunchEmphasisErr
$kwLaunchEmphasisBuild.WaitForExit()
$kwLaunchEmphasisBuild.Refresh()
$kwLaunchEmphasisCode = $kwLaunchEmphasisBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwLaunchEmphasisCode)
if ($kwLaunchEmphasisCode -ne 0 -and $kwLaunchEmphasisCode -ne 36) {
    Get-Content -LiteralPath $kwLaunchEmphasisErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwLaunchEmphasisOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwLaunchEmphasisRecord = [ordered]@{ exitCode = $kwLaunchEmphasisCode; log = $kwLaunchEmphasisOut; stderr = $kwLaunchEmphasisErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'larger brighter procedural basic attack releases'; gameplayValidation = 'user manual' }
$kwLaunchEmphasisRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8



