$ErrorActionPreference = 'Stop'
$kwCardOfferOut = Join-Path $env:TEMP 'kw-card-offer-weights-v1-20261015-out.log'
$kwCardOfferErr = Join-Path $env:TEMP 'kw-card-offer-weights-v1-20261015-err.log'
$kwCardOfferBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwCardOfferOut -RedirectStandardError $kwCardOfferErr
$kwCardOfferBuild.WaitForExit()
$kwCardOfferBuild.Refresh()
$kwCardOfferCode = $kwCardOfferBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwCardOfferCode)
if ($kwCardOfferCode -ne 0 -and $kwCardOfferCode -ne 36) {
    Get-Content -LiteralPath $kwCardOfferErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwCardOfferOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwCardOfferRecord = [ordered]@{ exitCode = $kwCardOfferCode; log = $kwCardOfferOut; stderr = $kwCardOfferErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'upgrade offers: generic stat weight x0.3; normal attack, skill and ultimate weight x2'; gameplayValidation = 'user manual' }
$kwCardOfferRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
