"""Static gain review and release packaging only; never executes or plays the game."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import shutil
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def write(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')

def review():
    old = (HERE / 'AudioCatalog.before.ts').read_text(encoding='utf8')
    new = (ROOT / 'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    expected = old.replace('gain: 0.126,', 'gain: 0.126 * Math.pow(10, 3 / 20),').replace('gain: 0.135,', 'gain: 0.135 * Math.pow(10, 3 / 20),')
    expected += "/** Per-track playback gain relative to v29, shared by lobby and battle. */\nexport const MUSIC_TRACK_GAIN: Readonly<Record<string, number>> = {\n  'v29/bgm_forest': Math.pow(10, 3 / 20),\n  'v29/bgm_lair': Math.pow(10, 1.5 / 20),\n};\n"
    if expected != new:
        raise ValueError('Unexpected catalog change')
    old = (HERE / 'GameAudio.before.ts').read_text(encoding='utf8')
    new = (ROOT / 'assets/scripts/core/GameAudio.ts').read_text(encoding='utf8')
    expected = old.replace('CHAPTER_MUSIC, MusicScene', 'CHAPTER_MUSIC, MUSIC_TRACK_GAIN, MusicScene').replace('this.ramp(gain.gain, 1, previous ?', 'this.ramp(gain.gain, MUSIC_TRACK_GAIN[track] ?? 1, previous ?')
    expected = expected.replace('  private musicLoading = false;', '  private musicLoading = false;\n  private musicHeldForTransition = false;')
    expected = expected.replace('!this.musicEnabled || this.music?.track', '!this.musicEnabled || this.musicHeldForTransition || this.music?.track')
    expected = expected.replace('!this.musicEnabled || document.hidden || this.ctx.state', '!this.musicEnabled || this.musicHeldForTransition || document.hidden || this.ctx.state')
    expected = expected.replace('    const sceneGain = MUSIC_SCENE_GAIN[this.scene];', '    if (this.musicHeldForTransition && this.musicEnabled) return;\n    const sceneGain = MUSIC_SCENE_GAIN[this.scene];')
    method = '''  /** Keep the current mix until the gate has fully revealed the battle. */
  holdMusicForTransition(hold: boolean): void {
    if (this.musicHeldForTransition === hold) return;
    this.musicHeldForTransition = hold; this.musicRevision++;
    if (!hold) { this.startMusic(); this.musicLevel(1); }
  }

'''
    expected = expected.replace('  private validChapter(', method + '  private validChapter(')
    if expected != new:
        raise ValueError('Unexpected audio service change')
    old = (HERE / 'BattleEntry.before.ts').read_text(encoding='utf8')
    new = (ROOT / 'assets/scripts/ui/BattleEntry.ts').read_text(encoding='utf8')
    expected = old.replace('    this.destination = destination;', "    this.destination = destination;\n    if (destination === 'battle') GameAudio.holdMusicForTransition(true);")
    expected = expected.replace('  private finish(): void {\n    if (active === this) active = null;', "  private finish(): void {\n    if (active === this) active = null;\n    if (this.destination === 'battle') GameAudio.holdMusicForTransition(false);")
    expected = expected.replace('  onDestroy(): void {', "  onDestroy(): void {\n    if (this.destination === 'battle') GameAudio.holdMusicForTransition(false);")
    if expected != new:
        raise ValueError('Unexpected gate change')
    diagnostics = []
    for name in ['types-before.log', 'types-after.log']:
        diagnostics.append(re.findall(r'^([^\r\n]+?)\(\d+,\d+\): error (TS\d+): (.+)$', (HERE / name).read_text(encoding='utf-8-sig'), re.M))
    if diagnostics[0] != diagnostics[1]:
        raise ValueError('New type diagnostics')
    # Check all previously captured audio against the pre-v29 baseline, plus the two v29 additions.
    checked = 0
    for rel, digest in json.loads((ROOT / 'docs/chapter-music-v29/before.json').read_text(encoding='utf8')).items():
        if rel.startswith('assets/resources/audio/') and not rel.endswith(('README.txt', 'CREDITS.txt')):
            if sha(ROOT / rel) != digest:
                raise ValueError('Prior audio modified: ' + rel)
            checked += 1
    for row in json.loads((ROOT / 'docs/chapter-music-v29/manifest.json').read_text(encoding='utf8'))['files']:
        if sha(ROOT / 'assets/resources/audio/v29' / row['file']) != row['sha256']:
            raise ValueError('Music media changed')
    write('source-inspection.json', dict(changedRuntimeFiles=3, priorAudioAndMetadataMatched=checked,
        battleMusicReleasedByActualTransitionFinish=True,
        v29MusicMediaUnchanged=True, newTypeDiagnostics=0, existingTypeDiagnostics=len(diagnostics[1]),
        gains=dict(meteor=dict(before=.126, after=.126 * 10 ** (3 / 20), db=3),
            thunder=dict(before=.135, after=.135 * 10 ** (3 / 20), db=3),
            forest=dict(before=1, after=10 ** (3 / 20), db=3),
            lair=dict(before=1, after=10 ** (1.5 / 20), db=1.5)),
        gameBrowserTestsAndAudioPlaybackPerformed=False))
    print('Only requested gain edits; type diagnostics unchanged; original audio preserved')

def stage():
    web = ROOT / 'build/web-mobile'
    bundle = next((web / 'assets/main').glob('index.*.js')).read_text(encoding='utf8')
    if any(marker not in bundle for marker in ['MUSIC_TRACK_GAIN', 'bgm_forest', 'bgm_lair', 'holdMusicForTransition', 'musicHeldForTransition']):
        raise ValueError('Compiled music gain configuration missing')
    prior_record = json.loads((ROOT / 'docs/chapter-music-v29/deployment-stage.json').read_text(encoding='utf-8-sig'))
    prior = Path(prior_record['stage'])
    release = json.loads((web / 'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']:
        raise ValueError('Production required')
    target = ROOT / 'build' / ('publish-audio-gains-v30-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior / 'previews', target / 'previews')
    files = [f for f in (prior / 'previews').rglob('*') if f.is_file()]
    for f in files:
        if sha(f) != sha(target / 'previews' / f.relative_to(prior / 'previews')):
            raise ValueError('Historical preview changed')
    natives = {sha(f) for f in (web / 'assets/resources/native').rglob('*') if f.is_file()}
    for row in json.loads((ROOT / 'docs/chapter-music-v29/manifest.json').read_text(encoding='utf8'))['files']:
        if row['sha256'] not in natives:
            raise ValueError('Built music media mismatch')
    for f in (ROOT / 'assets/resources/audio/v28').glob('*.wav'):
        if sha(f) not in natives:
            raise ValueError('Built ultimate media mismatch')
    version = re.search(r'\?v=(\d+)', release['entry'])[1]
    write('deployment-stage.json', dict(stage=str(target), entryVersion=version, priorPublishedStage=str(prior),
        project='kingdom-watch', branch='main', published=False,
        game='https://kingdom-watch.pages.dev/?v=audio-gains-v30-' + version,
        priorPreviewFilesPreserved=len(files), compiledMusicGainConfigurationPresent=True,
        builtMusicAndUltimateMediaUnchanged=True, manualAcceptance='User manual; no game/browser/audio playback performed'))
    for name in ['build-record.json', 'web-release.json']:
        shutil.copy2(web / name, HERE / name)
    print('Release staged', target)

if __name__ == '__main__':
    {'review': review, 'stage': stage}[sys.argv[1]]()
