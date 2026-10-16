$ErrorActionPreference = 'Stop'
$kwUnequipOut = Join-Path $env:TEMP 'kw-equipment-unequip-v1-20261015-out.log'
$kwUnequipErr = Join-Path $env:TEMP 'kw-equipment-unequip-v1-20261015-err.log'
$kwUnequipBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwUnequipOut -RedirectStandardError $kwUnequipErr
$kwUnequipBuild.WaitForExit()
$kwUnequipBuild.Refresh()
$kwUnequipCode = $kwUnequipBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwUnequipCode)
if ($kwUnequipCode -ne 0 -and $kwUnequipCode -ne 36) {
    Get-Content -LiteralPath $kwUnequipErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwUnequipOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwUnequipRecord = [ordered]@{ exitCode = $kwUnequipCode; log = $kwUnequipOut; stderr = $kwUnequipErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'equipped-item dialogs: unequip action with inventory, slot and hero-stat refresh'; gameplayValidation = 'user manual' }
$kwUnequipRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
