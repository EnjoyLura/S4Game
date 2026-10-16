$ErrorActionPreference = 'Stop'
$kwUIExperienceOut = Join-Path $env:TEMP 'kw-ui-experience-v1-20261015-out.log'
$kwUIExperienceErr = Join-Path $env:TEMP 'kw-ui-experience-v1-20261015-err.log'
$kwUIExperienceBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwUIExperienceOut -RedirectStandardError $kwUIExperienceErr
$kwUIExperienceBuild.WaitForExit()
$kwUIExperienceBuild.Refresh()
$kwUIExperienceCode = $kwUIExperienceBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwUIExperienceCode)
if ($kwUIExperienceCode -ne 0 -and $kwUIExperienceCode -ne 36) {
    Get-Content -LiteralPath $kwUIExperienceErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwUIExperienceOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwUIExperienceRecord = [ordered]@{ exitCode = $kwUIExperienceCode; log = $kwUIExperienceOut; stderr = $kwUIExperienceErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'semantic UI audio, procedural tap feedback and interruptible page/modal motion'; gameplayValidation = 'user manual' }
$kwUIExperienceRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8








