$ErrorActionPreference = 'Stop'
$kwUltimateUIOut = Join-Path $env:TEMP 'kw-hero-ultimate-ui-v3-20261015-out.log'
$kwUltimateUIErr = Join-Path $env:TEMP 'kw-hero-ultimate-ui-v3-20261015-err.log'
$kwUltimateUIBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwUltimateUIOut -RedirectStandardError $kwUltimateUIErr
$kwUltimateUIBuild.WaitForExit()
$kwUltimateUIBuild.Refresh()
$kwUltimateUICode = $kwUltimateUIBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwUltimateUICode)
if ($kwUltimateUICode -ne 0 -and $kwUltimateUICode -ne 36) {
    Get-Content -LiteralPath $kwUltimateUIErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwUltimateUIOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwUltimateUIRecord = [ordered]@{ exitCode = $kwUltimateUICode; log = $kwUltimateUIOut; stderr = $kwUltimateUIErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'violet thunder ultimate, blue sniper ultimate, opaque page handoff and formation close without blank frames'; gameplayValidation = 'user manual' }
$kwUltimateUIRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
