$ErrorActionPreference = 'Stop'
$kwNoticeOut = Join-Path $env:TEMP 'kw-notice-feedback-v1-20261015-out.log'
$kwNoticeErr = Join-Path $env:TEMP 'kw-notice-feedback-v1-20261015-err.log'
$kwNoticeBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwNoticeOut -RedirectStandardError $kwNoticeErr
$kwNoticeBuild.WaitForExit()
$kwNoticeBuild.Refresh()
$kwNoticeCode = $kwNoticeBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwNoticeCode)
if ($kwNoticeCode -ne 0 -and $kwNoticeCode -ne 36) {
    Get-Content -LiteralPath $kwNoticeErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwNoticeOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwNoticeRecord = [ordered]@{ exitCode = $kwNoticeCode; log = $kwNoticeOut; stderr = $kwNoticeErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'typed non-blocking notifications and growth feedback with actual values, merge behavior and semantic audio'; gameplayValidation = 'user manual' }
$kwNoticeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
