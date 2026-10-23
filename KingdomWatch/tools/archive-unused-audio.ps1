param([switch]$Restore)
$ErrorActionPreference = 'Stop'
$kwAudioProject = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$kwAudioAssets = [IO.Path]::GetFullPath((Join-Path $kwAudioProject 'assets'))
$kwAudioRoot = [IO.Path]::GetFullPath((Join-Path $kwAudioAssets 'resources/audio'))
$kwAudioArchiveBase = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $kwAudioProject) '.local-art-archive'))
$kwAudioPlan = Get-Content -LiteralPath (Join-Path $kwAudioProject 'docs/resource-other-v89/retirement-plan.json') -Raw | ConvertFrom-Json
$kwAudioArchive = [IO.Path]::GetFullPath($kwAudioPlan.archive)
function Assert-KwAudioChild([string]$Child, [string]$Parent) {
    if (-not $Child.StartsWith($Parent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Outside expected root: $Child" }
    $kwAudioCheck = $Child
    while ($kwAudioCheck -and $kwAudioCheck.Length -ge $Parent.Length) {
        if ((Test-Path -LiteralPath $kwAudioCheck) -and ((Get-Item -LiteralPath $kwAudioCheck -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Linked path is not allowed: $kwAudioCheck" }
        $kwAudioCheck = Split-Path -Parent $kwAudioCheck
    }
}
Assert-KwAudioChild $kwAudioArchive $kwAudioArchiveBase
$kwAudioCatalog = Join-Path $kwAudioProject 'assets/scripts/core/AudioCatalog.ts'
if ((Get-FileHash -LiteralPath $kwAudioCatalog -Algorithm SHA256).Hash.ToLowerInvariant() -ne $kwAudioPlan.catalogSha256) { throw 'Audio catalog changed; regenerate the retirement plan' }
$kwAudioMoves = @()
foreach ($kwAudioFile in $kwAudioPlan.files) {
    $kwAudioOriginal = [IO.Path]::GetFullPath((Join-Path $kwAudioAssets $kwAudioFile.asset))
    $kwAudioLocal = [IO.Path]::GetFullPath((Join-Path $kwAudioArchive $kwAudioFile.asset))
    Assert-KwAudioChild $kwAudioOriginal $kwAudioRoot
    Assert-KwAudioChild $kwAudioLocal $kwAudioArchive
    if ($kwAudioFile.asset -notmatch '\.(wav|mp3)(\.meta)?$') { throw 'Unexpected audio archive extension' }
    $kwAudioFrom = if ($Restore) { $kwAudioLocal } else { $kwAudioOriginal }
    $kwAudioTo = if ($Restore) { $kwAudioOriginal } else { $kwAudioLocal }
    $kwAudioFromExists = Test-Path -LiteralPath $kwAudioFrom -PathType Leaf
    $kwAudioToExists = Test-Path -LiteralPath $kwAudioTo -PathType Leaf
    if ($kwAudioFromExists -eq $kwAudioToExists) { throw "Expected one intact copy: $($kwAudioFile.asset)" }
    $kwAudioExisting = if ($kwAudioFromExists) { $kwAudioFrom } else { $kwAudioTo }
    if ((Get-Item -LiteralPath $kwAudioExisting).Length -ne $kwAudioFile.bytes -or (Get-FileHash -LiteralPath $kwAudioExisting -Algorithm SHA256).Hash.ToLowerInvariant() -ne $kwAudioFile.sha256) { throw "Audio changed since audit: $kwAudioExisting" }
    if ($kwAudioFromExists) { $kwAudioMoves += [pscustomobject]@{ From = $kwAudioFrom; To = $kwAudioTo } }
}
# Every absolute source/destination and hash is verified before the first move.
foreach ($kwAudioMove in $kwAudioMoves) {
    [IO.Directory]::CreateDirectory((Split-Path -Parent $kwAudioMove.To)) | Out-Null
    Move-Item -LiteralPath $kwAudioMove.From -Destination $kwAudioMove.To
}
Write-Output ("Verified local audio moves: {0}; restore={1}" -f $kwAudioMoves.Count, $Restore.IsPresent)
