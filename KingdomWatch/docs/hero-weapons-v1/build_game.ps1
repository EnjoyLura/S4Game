$ErrorActionPreference = 'Stop'
$kwHeroWeaponsOut = Join-Path $env:TEMP 'kw-hero-weapons-v1-20261016-out.log'
$kwHeroWeaponsErr = Join-Path $env:TEMP 'kw-hero-weapons-v1-20261016-err.log'
$kwHeroWeaponsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwHeroWeaponsOut -RedirectStandardError $kwHeroWeaponsErr
$kwHeroWeaponsBuild.WaitForExit()
$kwHeroWeaponsBuild.Refresh()
$kwHeroWeaponsCode = $kwHeroWeaponsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwHeroWeaponsCode)
if ($kwHeroWeaponsCode -ne 0 -and $kwHeroWeaponsCode -ne 36) {
    Get-Content -LiteralPath $kwHeroWeaponsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwHeroWeaponsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwHeroWeaponsRecord = [ordered]@{
    exitCode = $kwHeroWeaponsCode; log = $kwHeroWeaponsOut; stderr = $kwHeroWeaponsErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'mandatory starter weapons; four green weapons; per-hero shared weapon cultivation and weapon-specific breakthroughs; gate closed hold 1.5s; frost ultimate rain 256; pyro crater size +20%'
    gameplayValidation = 'user manual'
}
$kwHeroWeaponsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
