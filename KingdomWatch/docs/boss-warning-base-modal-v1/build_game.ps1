$ErrorActionPreference = 'Stop'
$kwThreatOut = Join-Path $env:TEMP 'kw-boss-warning-base-modal-v1-20261016-out.log'
$kwThreatErr = Join-Path $env:TEMP 'kw-boss-warning-base-modal-v1-20261016-err.log'
$kwThreatBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwThreatOut -RedirectStandardError $kwThreatErr
$kwThreatBuild.WaitForExit()
$kwThreatBuild.Refresh()
$kwThreatCode = $kwThreatBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwThreatCode)
if ($kwThreatCode -ne 0 -and $kwThreatCode -ne 36) {
    Get-Content -LiteralPath $kwThreatErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwThreatOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwThreatRecord = [ordered]@{
    exitCode = $kwThreatCode; log = $kwThreatOut; stderr = $kwThreatErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'central elite/Boss warning, persistent base upgrade/codex modal and two-second entry gate hold'
    gameplayValidation = 'user manual'
}
$kwThreatRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
