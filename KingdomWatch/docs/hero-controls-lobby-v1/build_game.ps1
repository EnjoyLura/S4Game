$ErrorActionPreference = 'Stop'
$kwHeroControlsOut = Join-Path $env:TEMP 'kw-hero-controls-lobby-v1-20261015-out.log'
$kwHeroControlsErr = Join-Path $env:TEMP 'kw-hero-controls-lobby-v1-20261015-err.log'
$kwHeroControlsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwHeroControlsOut -RedirectStandardError $kwHeroControlsErr
$kwHeroControlsBuild.WaitForExit()
$kwHeroControlsBuild.Refresh()
$kwHeroControlsCode = $kwHeroControlsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwHeroControlsCode)
if ($kwHeroControlsCode -ne 0 -and $kwHeroControlsCode -ne 36) {
    Get-Content -LiteralPath $kwHeroControlsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwHeroControlsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwHeroControlsRecord = [ordered]@{ exitCode = $kwHeroControlsCode; log = $kwHeroControlsOut; stderr = $kwHeroControlsErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'hero navigation style, detail action placement and inventory tab centering'; gameplayValidation = 'user manual' }
$kwHeroControlsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8





