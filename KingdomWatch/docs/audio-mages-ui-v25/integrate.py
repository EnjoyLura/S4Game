"""Replace only the three rejected mage families; preserve approved weapon cues."""
from pathlib import Path
import json
import re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
path=ROOT/'assets/scripts/core/AudioCatalog.ts'
src=path.read_text(encoding='utf8')
if "const gentle =" in src:raise ValueError('Already integrated')
src=src.replace("const kingdom =", "const gentle = (...files: string[]): readonly string[] => files.map(file => 'v25/' + file);\nconst kingdom =",1)
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
groups={}
for row in manifest['files']:
    groups.setdefault(row['cue'],[]).append(Path(row['file']).stem)
for cue,names in groups.items():
    if cue.startswith('gate'):continue
    files='gentle('+', '.join(repr(n) for n in names)+')'
    src,count=re.subn(r'(^  '+cue+r': \{ files: ).*?(, gain:)',lambda m:m[1]+files+m[2],src,flags=re.M)
    if count!=1:raise ValueError('Unexpected cue '+cue)
src=src.replace('export const AUDIO_CUES = {',"export const AUDIO_CUES = {\n"
    "  gateSlide: { files: gentle('gate_slide'), gain: .7, gap: .3, group: 'transition', priority: 3 },\n"
    "  gateClose: { files: gentle('gate_close'), gain: .8, gap: .3, group: 'transition', priority: 3 },")
src=src.replace("  'uiSelect', 'uiOpen', 'uiClose',\n",'')
src=src.replace("  shoot: 'bow', ult: 'bowUlt',", "  shoot: 'bow', ult: 'bowUlt',\n  uiSelect: 'ui', uiOpen: 'ui', uiClose: 'ui',")
path.write_text(src,encoding='utf8')
credits='''

Mage and interaction audio v25 (2026-10-17)
User-approved archer, crossbow and button-click recordings remain byte-for-byte v24.
18 new softer fire/lightning/frost renderings: short low-register breath, thunder/drum body,
and middle-register harp tones, with fewer layers, restrained levels and smoother attacks.
Existing source credits apply: Varazuvi, Soundopolis, Robert Cordova, Mechanical Wave
(Sonniss GameAudioGDC EULA v2.0), rubberduck (CC0), VSCO 2 CE (CC0).
Added wooden gate closing recording: Coll Anderson — House, official Sonniss GameAudioGDC 2015 bundle.
https://sonniss.com/gameaudiogdc/
https://sonniss.com/gdc-bundle-license/
Modifications: excerpt selection, filtering, pitch, fades, layering and scalar level matching.
Recorded sources, exact recipes and hashes: docs/audio-mages-ui-v25/.
No standalone sound-library redistribution. No author/reference-game endorsement.
'''
cp=ROOT/'assets/resources/audio/v1/CREDITS.txt';cp.write_text(cp.read_text(encoding='utf8')+credits,encoding='utf8')
hp=ROOT/'build-templates/web-mobile/audio-credits.html'
html='''<h2>法师与交互音效 v25</h2><p>弓箭手、重弩手与通用按钮点击保留 v24。
火、雷、冰共 18 条重新设计为短促、层次较少的低中频材质与实录竖琴声；来源署名沿用上文。
新增关门录音：Coll Anderson — House，来自 <a href="https://sonniss.com/gameaudiogdc/">Sonniss GameAudioGDC 2015</a>，
遵循 <a href="https://sonniss.com/gdc-bundle-license/">GameAudioGDC EULA v2.0</a>。
处理包括片段选取、滤波、移调、渐变、分层和音量校准。原作者未参与或认可本游戏。</p>'''
hp.write_text(hp.read_text(encoding='utf8').replace('</html>',html+'</html>'),encoding='utf8')
rp=ROOT/'assets/resources/audio/README.txt'
rp.write_text('''正式游戏音频 v25 · 法师柔化与完整点击反馈
========================================
当前：v24 的弓箭手、重弩手、点击、成长、奖励与结算保留；三法师 18 条音效改为 v25。
v25/ 另含 gate_slide、gate_close，分别跟随门开始滑动和真正闭合，不使用延迟计时器。
所有有效页签/导航/图标/左右切换复用 v24 点击；游戏空白处和未单独配置的组件通过短点按补音。
拖动、长按、取消与关门遮罩不补音；同次按钮/选择/结果反馈优先，避免重复点击。
原普通命中/普通死亡等仍静音，8 声部预算及重要事件优先规则保持。BGM 和主音量保持。
详细来源、配方、散列与发布：docs/audio-mages-ui-v25/。听感待用户人工验收。
\n'''+rp.read_text(encoding='utf8'),encoding='utf8')
print('Installed 18 mage files and 2 gate files; uiSelect/uiOpen/uiClose now share ui')
