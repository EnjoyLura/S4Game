$ErrorActionPreference = 'Stop'
$kwSkillSwipeOut = Join-Path $env:TEMP 'kw-skill-milestone-swipe-v1-20261015-out.log'
$kwSkillSwipeErr = Join-Path $env:TEMP 'kw-skill-milestone-swipe-v1-20261015-err.log'
$kwSkillSwipeBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwSkillSwipeOut -RedirectStandardError $kwSkillSwipeErr
$kwSkillSwipeBuild.WaitForExit()
$kwSkillSwipeBuild.Refresh()
$kwSkillSwipeCode = $kwSkillSwipeBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwSkillSwipeCode)
if ($kwSkillSwipeCode -ne 0 -and $kwSkillSwipeCode -ne 36) {
    Get-Content -LiteralPath $kwSkillSwipeErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwSkillSwipeOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwSkillSwipeRecord = [ordered]@{ exitCode = $kwSkillSwipeCode; log = $kwSkillSwipeOut; stderr = $kwSkillSwipeErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'skill breakthrough cards: horizontal drag, snap, edge resistance and vertical-scroll handoff'; gameplayValidation = 'user manual' }
$kwSkillSwipeRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
