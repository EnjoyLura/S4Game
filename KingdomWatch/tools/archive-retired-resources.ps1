param([switch]$Restore)
$ErrorActionPreference = 'Stop'
$kwSlimProject = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$kwSlimAssets = [IO.Path]::GetFullPath((Join-Path $kwSlimProject 'assets'))
$kwSlimResources = [IO.Path]::GetFullPath((Join-Path $kwSlimAssets 'resources'))
$kwSlimWorkspace = [IO.Path]::GetFullPath((Split-Path -Parent $kwSlimProject))
$kwSlimArchiveBase = [IO.Path]::GetFullPath((Join-Path $kwSlimWorkspace '.local-art-archive'))
$kwSlimPlan = Get-Content -LiteralPath (Join-Path $kwSlimProject 'docs/resource-slim-v80/retirement-plan.json') -Raw | ConvertFrom-Json
$kwSlimArchive = [IO.Path]::GetFullPath($kwSlimPlan.archive)
function Assert-KwSlimChild([string]$Child, [string]$Parent) {
    if (-not $Child.StartsWith($Parent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path outside the intended root: $Child"
    }
    $kwSlimCheck = $Child
    while ($kwSlimCheck -and $kwSlimCheck.Length -ge $Parent.Length) {
        if (Test-Path -LiteralPath $kwSlimCheck) {
            if ((Get-Item -LiteralPath $kwSlimCheck -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Linked path is not allowed: $kwSlimCheck"
            }
        }
        $kwSlimCheck = Split-Path -Parent $kwSlimCheck
    }
}
Assert-KwSlimChild $kwSlimArchive $kwSlimArchiveBase
$kwSlimMoves = @()
foreach ($kwSlimFile in $kwSlimPlan.files) {
    $kwSlimOriginal = [IO.Path]::GetFullPath((Join-Path $kwSlimAssets $kwSlimFile.asset))
    $kwSlimLocal = [IO.Path]::GetFullPath((Join-Path $kwSlimArchive $kwSlimFile.asset))
    Assert-KwSlimChild $kwSlimOriginal $kwSlimResources
    Assert-KwSlimChild $kwSlimLocal $kwSlimArchive
    $kwSlimFrom = if ($Restore) { $kwSlimLocal } else { $kwSlimOriginal }
    $kwSlimTo = if ($Restore) { $kwSlimOriginal } else { $kwSlimLocal }
    $kwSlimExistsFrom = Test-Path -LiteralPath $kwSlimFrom -PathType Leaf
    $kwSlimExistsTo = Test-Path -LiteralPath $kwSlimTo -PathType Leaf
    if ($kwSlimExistsFrom -eq $kwSlimExistsTo) { throw "Expected exactly one intact copy: $($kwSlimFile.asset)" }
    $kwSlimExisting = if ($kwSlimExistsFrom) { $kwSlimFrom } else { $kwSlimTo }
    if ((Get-Item -LiteralPath $kwSlimExisting).Length -ne $kwSlimFile.bytes -or
        (Get-FileHash -LiteralPath $kwSlimExisting -Algorithm SHA256).Hash.ToLowerInvariant() -ne $kwSlimFile.sha256) {
        throw "File changed since audit: $kwSlimExisting"
    }
    if ($kwSlimExistsFrom) { $kwSlimMoves += [pscustomobject]@{ From = $kwSlimFrom; To = $kwSlimTo } }
}
# All resolved absolute source/destination paths and hashes are checked before the first move.
foreach ($kwSlimMove in $kwSlimMoves) {
    $kwSlimParent = Split-Path -Parent $kwSlimMove.To
    [IO.Directory]::CreateDirectory($kwSlimParent) | Out-Null
    Move-Item -LiteralPath $kwSlimMove.From -Destination $kwSlimMove.To
}
# No recursive deletion: only explicitly audited, now empty authoring directories.
if (-not $Restore) {
    $kwSlimPolicy = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'retired-resources-v80.json') -Raw | ConvertFrom-Json
    foreach ($kwSlimDirectory in $kwSlimPolicy.directories.PSObject.Properties.Name) {
        $kwSlimEmpty = [IO.Path]::GetFullPath((Join-Path $kwSlimResources $kwSlimDirectory))
        Assert-KwSlimChild $kwSlimEmpty $kwSlimResources
        if (Test-Path -LiteralPath $kwSlimEmpty -PathType Container) {
            if (@(Get-ChildItem -LiteralPath $kwSlimEmpty -Force).Count -ne 0) { throw "Directory is not empty: $kwSlimEmpty" }
            Remove-Item -LiteralPath $kwSlimEmpty -Force
        }
    }
}
Write-Output ("Verified file moves: {0}; restore={1}. Original bytes are preserved." -f $kwSlimMoves.Count, $Restore.IsPresent)
