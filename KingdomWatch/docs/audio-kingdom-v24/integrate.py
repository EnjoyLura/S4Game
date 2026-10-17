"""Install the 31 active cues without changing v23 event density or game logic."""
from pathlib import Path
import json
import re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
CAT=ROOT/'assets/scripts/core/AudioCatalog.ts'
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
groups={}
for row in manifest['files']:
    groups.setdefault(row['cue'],[]).append(Path(row['file']).stem)
source=CAT.read_text(encoding='utf8')
original=(HERE/'before/assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
if source != original:
    raise ValueError('Catalog changed after snapshot; inspect before integrating')
source=source.replace('/** Sample families share a mix budget; variants keep repeated volleys from sounding identical. */',
    '/** v24 material foley and acoustic motifs; the v23 reduced-event policy stays in place. */\n'
    "const kingdom = (...files: string[]): readonly string[] => files.map(file => 'v24/' + file);")
for cue,names in groups.items():
    files="kingdom("+', '.join(repr(name) for name in names)+")"
    source,count=re.subn(r'(^  '+cue+r': \{ files: ).*?(, gain:)',lambda m:m[1]+files+m[2],source,flags=re.M)
    if count!=1: raise ValueError('Missing or duplicate cue '+cue)
CAT.write_text(source,encoding='utf8')
(ROOT/'assets/resources/audio/README.txt').write_text('''正式游戏音频 v24 · 漫画奇幻
============================
GameAudio.ts 统一混音，AudioCatalog.ts 配置实际事件与声音路径。
v24/：44 条新制 WAV，覆盖 31 个实际发声入口；五英雄普攻各三变体、精英倒地三变体、通用点击两变体。
采用授权实录材质的重新设计，以及 VSCO 2 CE 实录乐器的原创短句。
31 入口沿用 v23 精简策略：21 静音、9 共用；没有恢复普通命中、死亡、数字、弹窗装饰和大部队提示。
单声道战斗、立体声关键界面反馈，44.1 kHz / 16 bit；最多 8 声部，关键事件让普通攻击/背景音乐退让。
v1/ 的两首背景音乐保持；v1/v2/v21 等旧资源作为历史保留，不删除或冒充本轮新作。
来源、作者、许可、逐条编辑参数、原文件与输出散列：docs/audio-kingdom-v24/。
Sonniss 音源只在本游戏及同步画面的项目成片中使用，不作音效素材包公开分发。
设置内 /audio-credits.html 保留完整历史署名与新增来源。
已制作和接入不代表用户已确认达到参考作品品质；实际听感待用户人工验收。
''',encoding='utf8')
credit='''

Comic fantasy audio v24 (2026-10-17)
Original editing, sound design and short orchestral arrangements for Kingdom Watch.
Sonniss GameAudioGDC 2015 official free recordings:
Mechanical Wave, NoizBoy, Mattia Cellotto, Eiravaein Works, Soundopolis,
Varazuvi and Robert Cordova. Licensed under the GameAudioGDC EULA v2.0.
https://sonniss.com/gameaudiogdc/
https://sonniss.com/gdc-bundle-license/
Used only within this game and synchronized audiovisual project demonstrations.
No sound-library redistribution or AI/ML training. Original recording authorship remains with the owners.

VSCO 2 Community Edition (CC0 1.0): Versilian Studios / Sam Gossner and contributors.
https://github.com/sgossner/VSCO-2-CE
Pinned source revision: 440300901dfe9275fd84e0b7763af1f8443ae62e.
Original D-major action/reward/fanfare phrases and D-minor defeat phrase.
Additional recordings: Still North Media (Ben Jaszczak & Brian Nelson), rubberduck,
and Kenney (all CC0; source URLs and previous credits retained above).
Modifications: excerpt selection, high/low-pass filtering, slight pitch changes, layered foley,
sampled note arrangement, fades, scalar level matching, at most 4 dB offline look-ahead peak reduction.
Complete per-file sources and editing recipes: docs/audio-kingdom-v24/used-sources.json and manifest.json.
No source author or reference-game endorsement is implied.
'''
cp=ROOT/'assets/resources/audio/v1/CREDITS.txt'
cp.write_text(cp.read_text(encoding='utf8')+credit,encoding='utf8')
hp=ROOT/'build-templates/web-mobile/audio-credits.html'
html=hp.read_text(encoding='utf8')
section='''<h2>漫画奇幻音效 v24</h2>
<p>为《王国守望》重新设计的材质音效与原创短乐句，覆盖全部 31 个实际发声入口，共 44 条。</p>
<p>专业录音来自 <a href="https://sonniss.com/gameaudiogdc/">Sonniss GameAudioGDC 2015</a>：
Mechanical Wave、NoizBoy、Mattia Cellotto、Eiravaein Works、Soundopolis、Varazuvi、Robert Cordova。
遵循 <a href="https://sonniss.com/gdc-bundle-license/">GameAudioGDC EULA v2.0</a>，
只用于本游戏与同步画面的项目成片；不作为音效素材包分发，不用于 AI 训练。原始录音版权归各作者。</p>
<p>实录乐器：<a href="https://github.com/sgossner/VSCO-2-CE">VSCO 2 Community Edition</a>，
Versilian Studios / Sam Gossner 与贡献者，CC0 1.0。短乐句为本项目重新编排。
另使用既有 CC0 武器与拟音录音：Still North Media（Ben Jaszczak、Brian Nelson）、rubberduck、Kenney。</p>
<p>处理包括片段选取、滤波、移调、采样乐器编排、叠层、渐变、音量校准及最多 4 dB 离线峰值控制。
作者与参考游戏未参与或认可本项目。原始来源、许可、散列与逐条配方均保存在 docs/audio-kingdom-v24/。</p>
'''
hp.write_text(html.replace('</html>',section+'</html>'),encoding='utf8')
print('Installed',len(groups),'active cues; reduction policy and playback code unchanged')
