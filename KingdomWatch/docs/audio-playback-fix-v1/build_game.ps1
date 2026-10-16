$ErrorActionPreference = 'Stop'
$kwAudioPlaybackFixOut = Join-Path $env:TEMP 'kw-audio-playback-fix-v1-20261015-out.log'
$kwAudioPlaybackFixErr = Join-Path $env:TEMP 'kw-audio-playback-fix-v1-20261015-err.log'
$kwAudioPlaybackFixBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwAudioPlaybackFixOut -RedirectStandardError $kwAudioPlaybackFixErr
$kwAudioPlaybackFixBuild.WaitForExit()
$kwAudioPlaybackFixBuild.Refresh()
$kwAudioPlaybackFixCode = $kwAudioPlaybackFixBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwAudioPlaybackFixCode)
if ($kwAudioPlaybackFixCode -ne 0 -and $kwAudioPlaybackFixCode -ne 36) {
    Get-Content -LiteralPath $kwAudioPlaybackFixErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwAudioPlaybackFixOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwAudioPlaybackFixRecord = [ordered]@{ exitCode = $kwAudioPlaybackFixCode; log = $kwAudioPlaybackFixOut; stderr = $kwAudioPlaybackFixErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'audio gesture capture, preloading and music recovery'; gameplayValidation = 'user manual' }
$kwAudioPlaybackFixRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8







