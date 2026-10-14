$ErrorActionPreference = 'Stop'
$kwAudioOut = Join-Path $env:TEMP 'kw-audio-upgrade-v1-20261015-out.log'
$kwAudioErr = Join-Path $env:TEMP 'kw-audio-upgrade-v1-20261015-err.log'
$kwAudioBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwAudioOut -RedirectStandardError $kwAudioErr
$kwAudioBuild.WaitForExit()
$kwAudioBuild.Refresh()
$kwAudioCode = $kwAudioBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwAudioCode)
if ($kwAudioCode -ne 0 -and $kwAudioCode -ne 36) {
    Get-Content -LiteralPath $kwAudioErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwAudioOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwAudioRecord = [ordered]@{ exitCode = $kwAudioCode; log = $kwAudioOut; stderr = $kwAudioErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'licensed music and sample audio with persistent mixer'; gameplayValidation = 'user manual' }
$kwAudioRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8


