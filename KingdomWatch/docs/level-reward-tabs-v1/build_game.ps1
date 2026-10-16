$ErrorActionPreference = 'Stop'
$kwTabsOut = Join-Path $env:TEMP 'kw-level-reward-tabs-v1-20261016-out.log'
$kwTabsErr = Join-Path $env:TEMP 'kw-level-reward-tabs-v1-20261016-err.log'
$kwTabsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwTabsOut -RedirectStandardError $kwTabsErr
$kwTabsBuild.WaitForExit()
$kwTabsBuild.Refresh()
$kwTabsCode = $kwTabsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwTabsCode)
if ($kwTabsCode -ne 0 -and $kwTabsCode -ne 36) {
    Get-Content -LiteralPath $kwTabsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwTabsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwTabsRecord = [ordered]@{
    exitCode = $kwTabsCode; log = $kwTabsOut; stderr = $kwTabsErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'star chests on the left and selected by default; level loot on the right'
    gameplayValidation = 'user manual'
}
$kwTabsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
