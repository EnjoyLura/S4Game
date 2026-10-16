$ErrorActionPreference = 'Stop'
$kwNoFlashOut = Join-Path $env:TEMP 'kw-page-switch-no-flash-v1-20261015-out.log'
$kwNoFlashErr = Join-Path $env:TEMP 'kw-page-switch-no-flash-v1-20261015-err.log'
$kwNoFlashBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwNoFlashOut -RedirectStandardError $kwNoFlashErr
$kwNoFlashBuild.WaitForExit()
$kwNoFlashBuild.Refresh()
$kwNoFlashCode = $kwNoFlashBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwNoFlashCode)
if ($kwNoFlashCode -ne 0 -and $kwNoFlashCode -ne 36) {
    Get-Content -LiteralPath $kwNoFlashErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwNoFlashOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwNoFlashRecord = [ordered]@{ exitCode = $kwNoFlashCode; log = $kwNoFlashOut; stderr = $kwNoFlashErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'stable page and hero refresh; retain opaque prior surface until replacement art is ready'; gameplayValidation = 'user manual' }
$kwNoFlashRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
