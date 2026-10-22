"""Batch active-segment RMS calibration. Writes gain metadata; never edits or plays audio.

Short impacts often cannot produce a useful integrated LUFS reading. Use gated 50ms
RMS blocks as a repeatable level baseline, not a claim of identical perceived loudness.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import subprocess
import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def number(expression):
    expression = expression.replace('Math.pow', 'pow')
    if not re.fullmatch(r'[\d\s.*+/(),pow-]+', expression):
        raise ValueError('Unsupported numeric expression: ' + expression)
    return float(eval(expression, {'__builtins__': {}, 'pow': pow}))

def category(name, group):
    if name in ['hit']: return 'hit'
    if name in ['crit', 'pierceHeavy']: return 'heavy'
    if name in ['fireUlt', 'thunderUlt', 'frostUlt', 'bowUlt', 'snipe']: return 'ultimate'
    if name in ['victory', 'defeat']: return 'result'
    if group in ['shot', 'cast']: return 'attack'
    if group in ['ui', 'card']: return 'ui'
    if group == 'cue' and name != 'surge': return 'reward'
    return 'world'

def catalog():
    text = (ROOT / 'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    helpers = dict(re.findall(r'const (\w+) = .*?files\.map\(file => \'([^\']+)/\' \+ file\)', text))
    silent = set(re.findall(r"'([^']+)'", text.split('const SILENT_CUES')[1].split(']);')[0]))
    shared = dict(re.findall(r"(\w+): '([^']+)'", text.split('const SHARED_CUES')[1].split('};')[0]))
    cues = {}
    for match in re.finditer(r'^  (\w+): \{ files: (.+?), gain: (.+?), ((?:offset|restart|rate|gap):.+?) \},$', text, re.M):
        name, files, gain, rest = match.groups()
        if name in silent or name in shared: continue
        sources = re.findall(r"'([^']+)'", files)
        helper = re.match(r'(\w+)\(', files)
        prefix = helpers[helper[1]] if helper else 'v1'
        sources = [prefix + '/' + f for f in sources]
        group = re.search(r"group: '([^']+)'", rest)[1]
        offset = re.search(r'offset: ([^,}]+)', rest)
        cues[name] = dict(files=sources, gain=number(gain), group=category(name, group),
            offset=number(offset[1]) if offset else 0)
    if not all(k in cues for k in ['hit', 'crit', 'bow', 'fireUlt', 'thunderUlt', 'ui']):
        raise ValueError('Catalog parsing incomplete')
    return cues

def measure(file, offset):
    path = ROOT / 'assets/resources/audio' / (file + '.wav')
    raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(path),
        '-ss', str(offset), '-ar', '44100', '-ac', '2', '-f', 'f32le', '-'])
    a = np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float64)
    if not len(a) or not np.isfinite(a).all(): raise ValueError('Invalid source: ' + file)
    size = round(44100 * .05)
    blocks = [float(np.mean(a[i:i+size] ** 2)) for i in range(0, len(a), size)]
    gate = max(10 ** (-70/10), max(blocks) * 10 ** (-24/10))
    active = [b for b in blocks if b >= gate]
    if not active: raise ValueError('Silent source: ' + file)
    return dict(activeRmsDBFS=10 * math.log10(sum(active) / len(active)),
        peakDBFS=20 * math.log10(max(float(np.max(abs(a))), 1e-10)),
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(), offsetSeconds=offset,
        seconds=len(a) / 44100)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', default='docs/hit-mix-v32/calibration.json')
    args = parser.parse_args()
    policy = json.loads((ROOT / 'tools/audio-mix-policy.json').read_text(encoding='utf8'))
    cues = catalog()
    measurements = {(name, file): measure(file, cue['offset']) for name, cue in cues.items() for file in cue['files']}
    targets = {}
    for group, reference in policy['references'].items():
        cue = cues[reference]
        targets[group] = sum(measurements[(reference, f)]['activeRmsDBFS'] for f in cue['files']) / len(cue['files']) + 20 * math.log10(cue['gain'])
    trims, rows = {}, []
    for name, cue in cues.items():
        for file in cue['files']:
            m = measurements[(name, file)]
            base_db = 20 * math.log10(cue['gain'])
            current = m['activeRmsDBFS'] + base_db
            trim = max(-policy['maxCorrectionDB'], min(policy['maxCorrectionDB'], targets[cue['group']] - current))
            trim = min(trim, policy['peakCeilingDBFS'] - m['peakDBFS'] - base_db)
            preserved = name in policy['preserveCues']
            if preserved: trim = 0
            trim = round(trim, 4)
            trims[name + ':' + file] = trim
            rows.append(dict(cue=name, file=file, category=cue['group'], baseGain=cue['gain'],
                measurement=m, targetDBFS=targets[cue['group']], trimDB=trim,
                calibratedActiveDBFS=current+trim, preservedUserApprovedLevel=preserved))
    out = ROOT / 'assets/scripts/core/AudioMixCalibration.ts'
    out.write_text('/** Generated by tools/calibrate-audio.py; do not edit individual rows. */\n'
        + 'export const SFX_AUTO_TRIM_DB: Readonly<Record<string, number>> = '
        + json.dumps(trims, indent=2) + ';\n'
        + 'export const SFX_MIX_CATEGORY: Readonly<Record<string, string>> = '
        + json.dumps({n: c['group'] for n, c in cues.items()}, indent=2) + ';\n', encoding='utf8')
    report = ROOT / args.report
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(dict(method='50ms active-segment RMS, -70dBFS absolute / -24dB relative gate; not integrated LUFS',
        policy=policy, categoryTargetsDBFS=targets, cues=len(cues), files=len(rows),
        audioFilesModified=False, audioPlaybackPerformed=False, rows=rows), indent=2), encoding='utf8')
    print('Calibrated', len(cues), 'retained cues /', len(rows), 'cue-file pairs; no media rewritten')

if __name__ == '__main__': main()
