$ErrorActionPreference = 'Stop'
$kwCombatAudioOut = Join-Path $env:TEMP 'kw-combat-audio-v2-20261015-out.log'
$kwCombatAudioErr = Join-Path $env:TEMP 'kw-combat-audio-v2-20261015-err.log'
$kwCombatAudioBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwCombatAudioOut -RedirectStandardError $kwCombatAudioErr
$kwCombatAudioBuild.WaitForExit()
$kwCombatAudioBuild.Refresh()
$kwCombatAudioCode = $kwCombatAudioBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwCombatAudioCode)
if ($kwCombatAudioCode -ne 0 -and $kwCombatAudioCode -ne 36) {
    Get-Content -LiteralPath $kwCombatAudioErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwCombatAudioOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwCombatAudioRecord = [ordered]@{ exitCode = $kwCombatAudioCode; log = $kwCombatAudioOut; stderr = $kwCombatAudioErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'five-hero combat sound redesign and density-aware mix; prior UI experience retained'; gameplayValidation = 'user manual' }
$kwCombatAudioRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8








