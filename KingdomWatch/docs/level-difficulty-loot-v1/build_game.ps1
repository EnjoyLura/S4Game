$ErrorActionPreference = 'Stop'
$kwLootOut = Join-Path $env:TEMP 'kw-level-difficulty-loot-v1-20261016-out.log'
$kwLootErr = Join-Path $env:TEMP 'kw-level-difficulty-loot-v1-20261016-err.log'
$kwLootBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwLootOut -RedirectStandardError $kwLootErr
$kwLootBuild.WaitForExit()
$kwLootBuild.Refresh()
$kwLootCode = $kwLootBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwLootCode)
if ($kwLootCode -ne 0 -and $kwLootCode -ne 36) {
    Get-Content -LiteralPath $kwLootErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwLootOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwLootRecord = [ordered]@{
    exitCode = $kwLootCode; log = $kwLootOut; stderr = $kwLootErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'difficulty formations, kill equipment drops, pickup animation and reward preview'
    gameplayValidation = 'user manual'
}
$kwLootRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
