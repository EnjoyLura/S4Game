param([string]$LogName = 'kw-web-release')
$ErrorActionPreference = 'Stop'
$kwWebRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $kwWebRoot
$kwWebOut = Join-Path $env:TEMP ($LogName + '-out.log')
$kwWebErr = Join-Path $env:TEMP ($LogName + '-err.log')
$kwWebConfig = Join-Path $PSScriptRoot 'web-release-build.json'
$kwWebProcess = Start-Process -FilePath 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe' -ArgumentList '--project',$kwWebRoot,'--build',('configPath=' + $kwWebConfig) -WindowStyle Hidden -PassThru -RedirectStandardOutput $kwWebOut -RedirectStandardError $kwWebErr
$kwWebProcess.WaitForExit()
$kwWebProcess.Refresh()
$kwWebCode = $kwWebProcess.ExitCode
Write-Output ('Cocos exit code: ' + $kwWebCode)
Get-Content -LiteralPath $kwWebOut -Tail 14
if ($kwWebCode -ne 0 -and $kwWebCode -ne 36) {
    Get-Content -LiteralPath $kwWebErr -Tail 20
    throw 'Cocos build failed'
}
$kwWebPython = 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe'
& $kwWebPython tools/patch-web-dpr.py
if ($LASTEXITCODE -ne 0) { throw 'DPR patch failed' }
& $kwWebPython tools/prepare-web-release.py
if ($LASTEXITCODE -ne 0) { throw 'Production cache preparation failed' }
$kwWebRecord = [ordered]@{ exitCode = $kwWebCode; log = $kwWebOut; stderr = $kwWebErr; creator = '3.8.8'; platform = 'web-mobile'; debug = $false; md5Cache = $true; dprPatch = 'completed'; preparation = 'tools/prepare-web-release.py'; gameplayValidation = 'user manual' }
$kwWebRecord | ConvertTo-Json | Set-Content -LiteralPath 'build/web-mobile/build-record.json' -Encoding utf8
