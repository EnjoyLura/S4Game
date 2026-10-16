$ErrorActionPreference = 'Stop'
$kwShopDetailsOut = Join-Path $env:TEMP 'kw-shop-product-details-v1-20261015-out.log'
$kwShopDetailsErr = Join-Path $env:TEMP 'kw-shop-product-details-v1-20261015-err.log'
$kwShopDetailsBuild = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project','D:/AI/S4Game/KingdomWatch','--build','platform=web-mobile;debug=true' -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwShopDetailsOut -RedirectStandardError $kwShopDetailsErr
$kwShopDetailsBuild.WaitForExit()
$kwShopDetailsBuild.Refresh()
$kwShopDetailsCode = $kwShopDetailsBuild.ExitCode
Write-Output ('Cocos exit code: ' + $kwShopDetailsCode)
if ($kwShopDetailsCode -ne 0 -and $kwShopDetailsCode -ne 36) {
    Get-Content -LiteralPath $kwShopDetailsErr -Tail 25
    throw 'Cocos build failed'
}
Get-Content -LiteralPath $kwShopDetailsOut -Tail 14
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
$kwShopDetailsRecord = [ordered]@{ exitCode = $kwShopDetailsCode; log = $kwShopDetailsOut; stderr = $kwShopDetailsErr; creator = '3.8.8'; platform = 'web-mobile'; dprPatch = 'completed'; scope = 'shop product icons open typed details with attributes, descriptions, quantities and purchase state'; gameplayValidation = 'user manual' }
$kwShopDetailsRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'build-record.json') -Encoding utf8
