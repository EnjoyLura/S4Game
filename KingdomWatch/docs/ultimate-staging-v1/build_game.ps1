$ErrorActionPreference = 'Stop'
$kwUltimateStageOut = Join-Path $env:TEMP 'kw-ultimate-staging-v1-20261015-out.log'
$kwUltimateStageErr = Join-Path $env:TEMP 'kw-ultimate-staging-v1-20261015-err.log'
$kwUltimateStageBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwUltimateStageOut -RedirectStandardError $kwUltimateStageErr
$kwUltimateStageBuild.WaitForExit()
$kwUltimateStageBuild.Refresh()
$kwUltimateStageCode = $kwUltimateStageBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwUltimateStageCode)
if ($kwUltimateStageCode -ne 0 -and $kwUltimateStageCode -ne 36) {
    Get-Content -LiteralPath $kwUltimateStageErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwUltimateStageOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwUltimateStageRecord = [ordered]@{
    exitCode = $kwUltimateStageCode; log = $kwUltimateStageOut; stderr = $kwUltimateStageErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'five-hero ultimate windups, staggered releases, contact accents, afterglow, audio envelopes and interruption protection'
    gameplayValidation = 'user manual'
}
$kwUltimateStageRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
