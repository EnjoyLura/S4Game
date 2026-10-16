$ErrorActionPreference = 'Stop'
$kwEntryArtOut = Join-Path $env:TEMP 'kw-battle-entry-art-v2-20261016-out.log'
$kwEntryArtErr = Join-Path $env:TEMP 'kw-battle-entry-art-v2-20261016-err.log'
$kwEntryArtBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwEntryArtOut -RedirectStandardError $kwEntryArtErr
$kwEntryArtBuild.WaitForExit()
$kwEntryArtBuild.Refresh()
$kwEntryArtCode = $kwEntryArtBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwEntryArtCode)
if ($kwEntryArtCode -ne 0 -and $kwEntryArtCode -ne 36) {
    Get-Content -LiteralPath $kwEntryArtErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwEntryArtOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwEntryArtRecord = [ordered]@{
    exitCode = $kwEntryArtCode; log = $kwEntryArtOut; stderr = $kwEntryArtErr
    creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'
    scope = 'painted fast battle entry, meteor shadows and larger craters, no ultimate dimming, decisive pick feedback'
    gameplayValidation = 'user manual'
}
$kwEntryArtRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
