"""Package a manual old/new listening page. No playback or browser execution."""
from pathlib import Path
import html
import shutil

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
PAGE = OUT/'preview'
(PAGE/'audio').mkdir(parents=True,exist_ok=True)
rows = [
    ('战斗','弓箭手 · 放箭','bow_1','v2/bow_1'),
    ('战斗','重弩手 · 发射','crossbow_1','v2/crossbow_1'),
    ('战斗','火法师 · 火弹','fire_1','v2/fire_1'),
    ('战斗','雷法师 · 电击','thunder_1','v2/thunder_1'),
    ('战斗','冰法师 · 冰晶','frost_1','v2/frost_1'),
    ('战斗','重弩手 · 技能','snipe','v2/snipe'),
    ('战斗','火法师 · 大招','fire_ult','v2/fire_ult'),
    ('战斗','冰法师 · 大招','frost_ult','v2/frost_ult'),
    ('三选一','卡牌出现','pick_open','v1/ui_confirm'),
    ('三选一','刷新卡牌','pick_refresh','v1/ui_click_2'),
    ('三选一','选中落定','pick_choose','v1/ui_confirm'),
    ('奖励与成长','领取奖励','reward','feedback-v15/reward'),
    ('奖励与成长','购买成功','purchase','feedback-v15/purchase'),
    ('奖励与成长','英雄升级','growth','feedback-v15/growth'),
    ('奖励与成长','长按连续升级','growth_tick','feedback-v15/tick'),
    ('奖励与成长','阶段突破','breakthrough','feedback-v15/breakthrough'),
    ('奖励与成长','主城升级','construction','feedback-v15/construction'),
    ('战斗结算','挑战胜利','victory','v1/victory'),
    ('战斗结算','挑战失败','defeat','v1/defeat'),
]
cards=[]; group=''
for i,(section,name,new,old) in enumerate(rows):
    if section!=group:
        cards.append('<h2>'+html.escape(section)+'</h2>');group=section
    for label,rel in [('new','v21/'+new),('old',old)]:
        shutil.copy2(ROOT/'assets/resources/audio'/(rel+'.wav'),PAGE/'audio'/f'{i}-{label}.wav')
    cards.append(f'<article><span>{html.escape(name)}</span><button data-file="{i}-old.wav">旧版</button>'
                 f'<button class="new" data-file="{i}-new.wav">新版</button></article>')
(PAGE/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>王国守望 · 音效对比 v21</title>
<style>*{box-sizing:border-box}body{margin:0;background:#14202b;color:#f7edda;font:16px/1.6 system-ui}
main{max-width:740px;margin:auto;padding:28px 18px 120px}h1{font-size:27px}h2{margin:30px 0 12px;color:#edc46e;font-size:20px}
p{color:#bcc8ce}article{display:flex;align-items:center;gap:10px;padding:13px 10px;border-bottom:1px solid #344550}
article span{flex:1}button,a{font:inherit}button{padding:8px 16px;border:1px solid #6f8291;border-radius:7px;background:#263a49;color:#f7edda;cursor:pointer}
.new{background:#d9ac4c;color:#15232d;border-color:#ebcb81}button.playing{outline:2px solid white}footer{position:fixed;bottom:0;left:0;right:0;background:#1d303eee;backdrop-filter:blur(10px);padding:12px 18px;display:flex;gap:14px;align-items:center;justify-content:center}
#status{font-size:14px;max-width:300px}a{color:#e9c36d}button:focus-visible{outline:3px solid white}</style>
<main><h1>王国守望 · 音效对比 v21</h1><p>点击手动试听，同一时间只播放一条。这里便于比较单条素材，战斗中的层次与节奏请在正式游戏中体验。</p>
<p><a href="../../?v=audio-overhaul-v21">进入正式游戏</a> · <a href="../../audio-credits.html">音源鸣谢与授权</a></p>
'''+''.join(cards)+'''</main><footer><button id="stop">停止</button><span id="status" aria-live="polite">尚未播放</span></footer>
<script>const player=new Audio();player.preload='none';let current=null;
function stop(){player.pause();player.currentTime=0;if(current)current.classList.remove('playing');current=null;document.querySelector('#status').textContent='已停止'}
document.querySelector('#stop').onclick=stop;document.querySelectorAll('[data-file]').forEach(button=>button.onclick=()=>{stop();current=button;button.classList.add('playing');player.src='audio/'+button.dataset.file;document.querySelector('#status').textContent=button.parentElement.querySelector('span').textContent+' · '+button.textContent;player.play().catch(()=>{document.querySelector('#status').textContent='未能播放，请再次点击'})});
player.onended=()=>{if(current)current.classList.remove('playing');current=null;document.querySelector('#status').textContent='播放完毕'};document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
</script></html>''',encoding='utf-8')
print(f'Manual preview prepared: {len(rows)} old/new pairs. No audio played.')
