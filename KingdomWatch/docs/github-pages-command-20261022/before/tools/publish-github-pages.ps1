param(
    [switch]$SkipBuild,
    [switch]$StatusOnly,
    [int]$WaitSeconds = 240
)
$ErrorActionPreference = 'Stop'
$kwPagesProject = Split-Path -Parent $PSScriptRoot
$kwPagesPython = 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe'
Push-Location -LiteralPath $kwPagesProject
try {
    if (-not $SkipBuild -and -not $StatusOnly) {
        & (Join-Path $PSScriptRoot 'build-web.ps1') -LogName 'kw-github-pages'
        if ($LASTEXITCODE -ne 0) { throw 'Original web build failed' }
    }
    $kwPagesArgs = @((Join-Path $PSScriptRoot 'github-pages/publish.py'), '--wait-seconds', $WaitSeconds)
    if ($StatusOnly) { $kwPagesArgs += '--status-only' }
    & $kwPagesPython @kwPagesArgs
    if ($LASTEXITCODE -ne 0) { throw 'GitHub Pages publishing did not complete; see the saved deployment report.' }
} finally {
    Pop-Location
}
