$ErrorActionPreference = 'Stop'
$kwButtonFeedbackOut = Join-Path $env:TEMP 'kw-button-feedback-v1-20261015-out.log'
$kwButtonFeedbackErr = Join-Path $env:TEMP 'kw-button-feedback-v1-20261015-err.log'
$kwButtonFeedbackBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwButtonFeedbackOut -RedirectStandardError $kwButtonFeedbackErr
$kwButtonFeedbackBuild.WaitForExit()
$kwButtonFeedbackBuild.Refresh()
$kwButtonFeedbackCode = $kwButtonFeedbackBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwButtonFeedbackCode)
if ($kwButtonFeedbackCode -ne 0 -and $kwButtonFeedbackCode -ne 36) {
    Get-Content -LiteralPath $kwButtonFeedbackErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwButtonFeedbackOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwButtonFeedbackRecord = [ordered]@{ exitCode = $kwButtonFeedbackCode; log = $kwButtonFeedbackOut; stderr = $kwButtonFeedbackErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'shared feedback across lobby, battle and modal buttons'; gameplayValidation = 'user manual' }
$kwButtonFeedbackRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8






