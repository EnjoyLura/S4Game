"""Extract the user's generated audio at their stated boundaries; no audio playback."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
INPUT = Path('C:/Users/user/Downloads/AI视频提示词人物蹲起问题.mp4')
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
CASES = [('01_meteor_0-2s', '火陨石撞地', 0, 2),
         ('02_thunder_2-4s', '雷电落地', 2, 4),
         ('03_ice_4-6s', '冰雨冰晶落地', 4, 6)]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def run(*args):
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)

def main():
    source = HERE/'source/generated-elements-8s.mp4'
    source.parent.mkdir(parents=True,exist_ok=True)
    if source.exists() and sha(source)!=sha(INPUT):
        raise ValueError('Existing extraction belongs to a different source')
    shutil.copy2(INPUT,source)
    raw = subprocess.check_output([FF,'-v','error','-i',str(source),'-map','0:a:0','-vn',
        '-ac','2','-ar',str(SR),'-f','f32le','-'])
    samples = np.frombuffer(raw,'<f4').reshape(-1,2)
    if len(samples)<6*SR or not np.isfinite(samples).all():raise ValueError('Invalid or short audio track')
    # Preserve decoded AAC samples even if the source has intersample peaks above 0 dBFS.
    codec = 'pcm_f32le' if np.max(abs(samples))>=1 else 'pcm_s24le'
    output = HERE/'audio';output.mkdir(exist_ok=True)
    full = output/'00_full_original.wav'
    run('-i',str(source),'-map','0:a:0','-vn','-c:a',codec,str(full))
    original = output/'00_original_aac.m4a'
    run('-i',str(source),'-map','0:a:0','-vn','-c:a','copy',str(original))
    rows=[]
    for name,label,start,end in CASES:
        out=output/(name+'.wav')
        run('-i',str(source),'-map','0:a:0','-vn','-af',
            f'atrim=start_sample={round(start*SR)}:end_sample={round(end*SR)},asetpts=PTS-STARTPTS',
            '-c:a',codec,str(out))
        a=samples[round(start*SR):round(end*SR)]
        rows.append(dict(file=out.name,label=label,start=start,end=end,seconds=len(a)/SR,
            sha256=sha(out),peakDBFS=round(float(20*np.log10(max(float(np.max(abs(a))),1e-12))),3)))
    record=dict(sourceUserPath=str(INPUT),sourceCopy=source.relative_to(HERE).as_posix(),
        sourceSHA256=sha(source),sourceBytes=source.stat().st_size,userGeneratedSource=True,
        sourcePrompt='一个纯黑的游戏音效视频，包含一颗火陨石砸落地面、一束雷电劈到地面、冰雨落到地面的音效。0-2s 是火陨石音效，2-4s 是雷音效，4-6 是冰雨冰晶落地的音效，8s',
        decodedAudioSeconds=len(samples)/SR,sampleRate=SR,channels=2,outputCodec=codec,
        processing='Exact requested sample boundaries; original speed, original levels, original stereo; no EQ, fades, denoising, normalization or layering.',
        originalAACCopiedWithoutReencoding=True,files=rows,remainingTail='6s to end retained in full track',
        gameChanged=False,audioPlayedOrAuditioned=False)
    (HERE/'extraction.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(record,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
