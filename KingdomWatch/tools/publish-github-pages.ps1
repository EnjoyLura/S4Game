<#
.SYNOPSIS
Build, validate and publish Kingdom Watch to its independent GitHub Pages repository.
.EXAMPLE
./tools/publish-github-pages.ps1
.EXAMPLE
./tools/publish-github-pages.ps1 -ValidateOnly
.EXAMPLE
./tools/publish-github-pages.ps1 -StatusOnly -ProxyUrl http://127.0.0.1:7897
.NOTES
Exit 0: verified. Exit 2: uploaded, Pages pending; use -StatusOnly later.
Only the runtime repository receives Git commits. CF is not deployed.
#>
[CmdletBinding(DefaultParameterSetName = 'Publish')]
param(
    [Parameter(ParameterSetName = 'Publish')][switch]$SkipBuild,
    [Parameter(ParameterSetName = 'Publish')][switch]$PrunePreviousRelease,
    [Parameter(Mandatory, ParameterSetName = 'Validate')][switch]$ValidateOnly,
    [Parameter(Mandatory, ParameterSetName = 'Status')][switch]$StatusOnly,
    [Parameter(ParameterSetName = 'Publish')][string]$PreparedPackage = '',
    [Parameter(ParameterSetName = 'Publish')][ValidateSet('lossless-webp','original-png')][string]$TextureMode = '',
    [ValidateRange(0, 3600)][int]$WaitSeconds = 240,
    [string]$ProxyUrl = '',
    [string]$ConfigPath = ''
)
$ErrorActionPreference = 'Stop'
$kwPagesProject = Split-Path -Parent $PSScriptRoot
$kwPagesPython = 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe'
$kwPagesOldProxy = @{ HTTP_PROXY = $env:HTTP_PROXY; HTTPS_PROXY = $env:HTTPS_PROXY }
$kwPagesExit = 1
if (-not (Test-Path -LiteralPath $kwPagesPython -PathType Leaf)) { throw 'Python runtime not found.' }
if ($ProxyUrl) {
    $kwPagesProxyUri = $null
    if (-not [Uri]::TryCreate($ProxyUrl, [UriKind]::Absolute, [ref]$kwPagesProxyUri) -or
        $kwPagesProxyUri.Scheme -notin @('http', 'https') -or $kwPagesProxyUri.UserInfo) {
        throw 'ProxyUrl must be an HTTP(S) address without embedded credentials.'
    }
}
if ($ConfigPath) { $ConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path }
if ($PreparedPackage) { $PreparedPackage = (Resolve-Path -LiteralPath $PreparedPackage).Path }
if ($PreparedPackage -and $TextureMode) { throw 'PreparedPackage retains its existing texture mode.' }
Push-Location -LiteralPath $kwPagesProject
try {
    if ($ProxyUrl) { $env:HTTP_PROXY = $ProxyUrl; $env:HTTPS_PROXY = $ProxyUrl }
    if (-not $SkipBuild -and -not $StatusOnly -and -not $ValidateOnly -and -not $PreparedPackage) {
        & (Join-Path $PSScriptRoot 'build-web.ps1') -LogName 'kw-github-pages'
        if ($LASTEXITCODE -ne 0) { throw 'Original web build failed' }
    }
    $kwPagesArgs = @('-X', 'utf8', (Join-Path $PSScriptRoot 'github-pages/publish.py'), '--wait-seconds', $WaitSeconds)
    if ($StatusOnly) { $kwPagesArgs += '--status-only' }
    if ($ValidateOnly) { $kwPagesArgs += '--validate-only' }
    if ($PreparedPackage) { $kwPagesArgs += @('--prepared', $PreparedPackage) }
    if ($TextureMode) { $kwPagesArgs += @('--texture-mode', $TextureMode) }
    if ($PrunePreviousRelease) { $kwPagesArgs += '--prune-previous-release' }
    if ($ConfigPath) { $kwPagesArgs += @('--config', $ConfigPath) }
    & $kwPagesPython @kwPagesArgs
    $kwPagesExit = $LASTEXITCODE
    if ($kwPagesExit -eq 2) {
        Write-Warning 'Uploaded successfully; Pages is still pending. Run this script with -StatusOnly to check again.'
    } elseif ($kwPagesExit -ne 0) {
        throw 'GitHub Pages publishing failed; see docs/github-pages-publishing/deployment.json.'
    }
} finally {
    foreach ($kwPagesProxyName in $kwPagesOldProxy.Keys) {
        if ($null -eq $kwPagesOldProxy[$kwPagesProxyName]) {
            Remove-Item -LiteralPath ('Env:' + $kwPagesProxyName) -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($kwPagesProxyName, $kwPagesOldProxy[$kwPagesProxyName], 'Process')
        }
    }
    Pop-Location
}
exit $kwPagesExit
