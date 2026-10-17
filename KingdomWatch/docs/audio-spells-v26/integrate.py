"""Preserve prior credits and append the new source attribution."""
import prepare as q

credits = '''

Elemental spell and common-contact audio v26 (2026-10-17)
Fantasy SFX Pack Vol 1 — JC Sounds. CC BY 4.0 — Credit: JC Sounds.
https://opengameart.org/content/jc-sounds-fantasy-sfx-pack-vol-1
https://creativecommons.org/licenses/by/4.0/
18 elemental spell edits: one original source per file, original playback speed,
excerpt selection, mono conversion, gentle EQ, fades and level matching.
The author has not endorsed this game or the modifications.
Common normal-damage contact: NoizBoy / Hong Kong Action Kit, official Sonniss 2015 free bundle.
https://sonniss.com/gameaudiogdc/ — GameAudioGDC EULA v2.0.
Existing archer/crossbow samples are unchanged. UI uses only the first existing v24 click.
Source archive, attribution snapshot, source/output hashes and exact recipes: docs/audio-spells-v26/.
'''
out = q.ROOT/'assets/resources/audio/v1/CREDITS.txt'
text = out.read_text(encoding='utf8')
if 'Elemental spell and common-contact audio v26' not in text:
    out.write_text(text+credits, encoding='utf8')
out = q.ROOT/'assets/resources/audio/README.txt'
text = out.read_text(encoding='utf8')
if 'v26:' not in text:
    out.write_text(text+'\nv26: 18 single-source elemental spell edits and 1 common normal-damage contact.\n'
        +'Archer/crossbow recordings unchanged. All click aliases use only v24/ui_click_1.\n'
        +'JC Sounds CC BY 4.0 and NoizBoy Sonniss EULA attribution: v1/CREDITS.txt.\n', encoding='utf8')
out = q.ROOT/'build-templates/web-mobile/audio-credits.html'
text = out.read_text(encoding='utf8')
if '法术与通用受击 v26' not in text:
    addition = '''<h2>法术与通用受击 v26</h2>
<p>火、雷、冰的 18 条法术采用 <a href="https://opengameart.org/content/jc-sounds-fantasy-sfx-pack-vol-1">Fantasy SFX Pack Vol 1 — JC Sounds</a>。
<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0 — Credit: JC Sounds</a>。
每条只用一个原始素材，处理包括截取、单声道转换、均衡、渐变和音量校准；原作者未参与或认可本游戏及修改。</p>
<p>普通伤害通用受击沿用 NoizBoy 的 Sonniss GameAudioGDC 2015 免费授权录音，许可见上文。
弓箭手和重弩手录音保留，点击统一使用原第一条样本。逐条来源和参数保存在 docs/audio-spells-v26/。</p>'''
    out.write_text(text.replace('</html>',addition+'</html>'), encoding='utf8')
print('Credits updated')
