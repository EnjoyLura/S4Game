$ErrorActionPreference = 'Stop'
$env:HTTP_PROXY = 'http://127.0.0.1:10808'
$env:HTTPS_PROXY = 'http://127.0.0.1:10808'
$env:PYTHONUNBUFFERED = '1'
$heroSeqRoot = $PSScriptRoot
$heroPython = 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$heroVideoTool = 'D:/AI/S4Game/美术/tools/art_video_gen.py'
$heroJobs = @()
foreach ($heroId in @('archer','sniper','pyro','volt','mora')) {
    foreach ($heroMode in @('idle','attack')) {
        $heroClipName = "$heroId-$heroMode"
        $heroLog = Join-Path $heroSeqRoot "videos-v2/$heroClipName.log"
        $heroErr = Join-Path $heroSeqRoot "videos-v2/$heroClipName.err"
        $heroVideo = Join-Path $heroSeqRoot "videos-v2/$heroClipName.mp4"
        if (Test-Path -LiteralPath $heroLog) { throw "Refusing duplicate submission: $heroClipName" }
        $heroArgs = @('-u', $heroVideoTool, '--image', "https://kw-vfx-src.pages.dev/hero_seq_v2_$($heroId)_ff.png",
            '--prompt-file', (Join-Path $heroSeqRoot "prompts/$heroClipName-v2.txt"),
            '--model','lens-minimax-h3-768p','--seconds','2','--ratio','9:16','--resolution','768p',
            '--out', $heroVideo, '--max-min','12')
        $heroProcess = Start-Process -FilePath $heroPython -ArgumentList $heroArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput $heroLog -RedirectStandardError $heroErr
        $heroJobs += [pscustomobject]@{hero=$heroId;mode=$heroMode;pid=$heroProcess.Id;output=$heroVideo;log=$heroLog;err=$heroErr}
    }
}
$heroJobs | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $heroSeqRoot 'video-jobs-v2.json') -Encoding utf8
$heroJobs | Select-Object hero,mode,pid | Format-Table
