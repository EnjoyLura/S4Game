$ErrorActionPreference = 'Stop'
$kwHeroAttackOut = Join-Path $env:TEMP 'kw-sniper-attack-clean-live-v1-20261014-out.log'
$kwHeroAttackErr = Join-Path $env:TEMP 'kw-sniper-attack-clean-live-v1-20261014-err.log'
$kwHeroAttackBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwHeroAttackOut -RedirectStandardError $kwHeroAttackErr
$kwHeroAttackBuild.WaitForExit()
$kwHeroAttackBuild.Refresh()
$kwHeroAttackCode = $kwHeroAttackBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwHeroAttackCode)
if ($kwHeroAttackCode -ne 0 -and $kwHeroAttackCode -ne 36) {
    Get-Content -LiteralPath $kwHeroAttackErr -Tail 30
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwHeroAttackOut -Tail 14
python tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
node docs/sniper-attack-clean-live-v1/build_preview.cjs
if ($LASTEXITCODE -ne 0) { throw 'Preview packaging failed' }
$kwHeroAttackBuildRecord = [ordered]@{ exitCode = $kwHeroAttackCode; log = $kwHeroAttackOut; stderr = $kwHeroAttackErr; dprPatch = 'completed' }
$kwHeroAttackBuildRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
