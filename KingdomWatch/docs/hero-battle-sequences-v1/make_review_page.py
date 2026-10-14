from pathlib import Path
import json, shutil
ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[1]
ids=["archer","sniper","pyro","volt","mora"]
data={h:json.loads((ROOT/"frames"/h/(h+".frames.json")).read_text(encoding="utf-8")) for h in ids}
for h in ids:
    folder="hero_comic_v1" if h=="archer" else "shop_comic_v1"
    shutil.copy2(GAME/"assets/resources/ux"/folder/("comic_hero_"+h+"_v1.png"),ROOT/"sources"/(h+"-avatar.png"))
html="""<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>新英雄动作素材预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#202b34;color:#f3ead3;font:16px system-ui,"Microsoft YaHei",sans-serif}
main{max-width:1240px;margin:auto;padding:22px}h1{font-size:24px;margin:0 0 8px}p{color:#c7c5ba;margin:8px 0 20px}
.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:20px 0;position:sticky;top:0;background:#202b34;padding:12px 0;z-index:2}
button,select{font:inherit;border:1px solid #c5ad7e;border-radius:7px;background:#f6dfad;color:#27303a;padding:9px 15px;cursor:pointer}
button.active{background:#ffcc4d;font-weight:bold}input{accent-color:#ffcc4d}label{display:flex;gap:8px;align-items:center}
.heroes{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.card{border:1px solid #746a54;background:#f3e5c8;border-radius:10px;overflow:hidden;color:#28343f}
.head{display:flex;align-items:center;gap:9px;padding:12px;font-weight:700;font-size:15px}.head img{width:48px;height:48px;object-fit:contain}
canvas{display:block;width:100%;height:auto}small{display:block;padding:12px;color:#796a4e}.links{display:flex;gap:12px;flex-wrap:wrap}a{color:#f3d589}
.composite{display:block;max-width:750px;width:100%;margin:18px auto;border-radius:8px}.compare{display:block;width:100%;margin:22px 0;border-radius:8px}
@media(max-width:800px){.heroes{grid-template-columns:repeat(2,1fr)}.card:last-child{grid-column:span 2;max-width:50%;margin:auto}main{padding:12px}.head{font-size:14px}}
</style><main><h1>新英雄战斗形象与动作</h1><p>按现有头像重做。上方可切换待机与攻击、暂停、逐帧查看；下方是游戏素材合成预览。</p>
<div class="toolbar"><button id="idle" class="active">待机循环</button><button id="attack">攻击与回位</button><button id="play">暂停</button>
<button id="step">下一帧</button><label>速度<select id="speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label>
<label>帧<input id="frame" type="range" min="0" max="23" value="0"><span id="readout">0</span></label></div>
<div class="heroes" id="heroes"></div><p>人物脚底和取景固定；攻击速度按游戏节奏压缩。选择“暂停”可检查每帧手部和武器。</p>
<div class="links"><a href="all-heroes-preview.gif">五英雄动图</a><a href="battle-composite-preview.gif">游戏原尺寸合成动图</a><a href="identity-comparison.jpg">头像外观对照</a><a href="README.md">素材与制作记录</a></div>
<h2 style="font-size:20px;margin-top:28px">游戏素材合成 · 原显示尺寸</h2><img class="composite" src="battle-composite-preview.gif">
<h2 style="font-size:20px">头像与新战斗形象</h2><img class="compare" src="identity-comparison.jpg">
</main><script>const DATA=__DATA__;const ids=Object.keys(DATA);const images={};const canvases={};let mode='idle',playing=true,time=0,last=0,manual=0;
for(const id of ids){let card=document.createElement('section');card.className='card';card.innerHTML='<div class="head"><img src="sources/'+id+'-avatar.png">'+DATA[id].name+'</div><canvas width="440" height="550"></canvas><small>待机 / 攻击 · 脚底固定</small>';document.querySelector('#heroes').append(card);canvases[id]=card.querySelector('canvas');images[id]=new Image();images[id].src='frames/'+id+'/'+id+'-atlas.png';}
const byId=id=>document.getElementById(id);function setMode(m){mode=m;time=0;manual=0;byId('frame').value=0;byId('idle').classList.toggle('active',m==='idle');byId('attack').classList.toggle('active',m==='attack');}
byId('idle').onclick=()=>setMode('idle');byId('attack').onclick=()=>setMode('attack');byId('play').onclick=()=>{playing=!playing;byId('play').textContent=playing?'暂停':'播放'};byId('step').onclick=()=>{playing=false;byId('play').textContent='播放';manual=(manual+1)%24;byId('frame').value=manual;};byId('frame').oninput=e=>{playing=false;byId('play').textContent='播放';manual=+e.target.value;};
function draw(ts){let dt=last?Math.min(.1,(ts-last)/1000):0;last=ts;if(playing)time+=dt*(+byId('speed').value);let readout=0;
for(const id of ids){const m=DATA[id],a=m.animations[mode];let name;if(playing){let phase=mode==='idle'?time%a.seconds:time%1.55;if(mode==='attack'&&phase>=a.seconds){name=a.frames[0];}else{name=a.frames[Math.min(a.frames.length-1,Math.floor(phase/a.seconds*a.frames.length))];}}else{name=id+'_'+mode+manual;}
const [x,y,w,h]=m.frames[name];let cellIndex=+name.split(mode).pop();readout=cellIndex;const c=canvases[id],ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#c9b894';ctx.beginPath();ctx.ellipse(220,485,65,12,0,0,Math.PI*2);ctx.fill();const s=350/m.readyHeightPx;ctx.imageSmoothingEnabled=true;if(images[id].complete)ctx.drawImage(images[id],x,y,w,h,220-128*s,485-251*s,w*s,h*s);ctx.fillStyle='#796a4e';ctx.font='22px system-ui';ctx.fillText((mode==='idle'?'待机':'攻击')+' · '+cellIndex,20,535);}
byId('readout').textContent=readout;requestAnimationFrame(draw);}requestAnimationFrame(draw);</script></html>"""
(ROOT/"review.html").write_text(html.replace("__DATA__",json.dumps(data,ensure_ascii=False)),encoding="utf-8")
print(ROOT/"review.html")
