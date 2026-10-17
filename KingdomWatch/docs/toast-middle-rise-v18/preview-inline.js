
'use strict';
const $=id=>document.getElementById(id), clamp=v=>Math.max(0,Math.min(1,v)), out=v=>1-(1-clamp(v))**3;
const specs={
 win:{duration:1400,art:'victory-v18.png',title:'胜利：先确认结果，再呈现收获',rows:[['0–120ms','战场平滑压暗，保留场景辨识。'],['80–440ms','皇冠横幅轻落定，一次小幅回弹；局部暖光短亮。'],['300 / 470 / 640ms','按实际获得星数依次点亮，音高轻递进。'],['440–1120ms','奖励区显现，金币滚到真实值，材料轻显。'],['850–1100ms','按钮上移8像素淡入；结果完整后停止运动。']]},
 lose:{duration:850,art:'defeat-v18.png',title:'失败：清楚交代结果，尽快给出下一步',rows:[['0–160ms','战场平缓压暗，无红色闪屏。'],['100–460ms','银冠蓝缎带短距下落、减速收稳。'],['260–550ms','保底奖励和到账信息渐显，数值直接显示。'],['470–690ms','复活与重试入口轻显，不做庆祝碎光。'],['690–850ms','停在可读状态，等待玩家选择。']]},
 pause:{duration:400,art:'pause-v18.png',title:'暂停：短促、安静，优先读懂和继续',rows:[['0–120ms','战场压暗，标题淡入。'],['60–280ms','奖励圆座和当前数量显现。'],['120–340ms','连体页签与原位置按钮显现。'],['340–400ms','稳定停留，不持续呼吸或闪烁。']]}
};
let screen='win',mode='art',duration=1400,elapsed=0,playing=false,lastNow=0,raf=0,exiting=false;
const stars=Array.from(document.querySelectorAll('.star')),actions=Array.from(document.querySelectorAll('.action'));
const motes=Array.from({length:7},(_,i)=>{const e=document.createElement('i');e.className='mote';e.style.left=(205+(i*83)%490)+'px';e.style.top=(90+(i*51)%260)+'px';$('dialog').appendChild(e);return e;});
const media=window.matchMedia('(prefers-reduced-motion: reduce)');$('quiet').checked=media.matches;
let audio=null,buffers={},sources=[];const sounded=new Set();
async function prepareSound(){
 try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;audio=audio||new A();await audio.resume();
  await Promise.all(['victory','defeat','star'].map(async n=>{if(!buffers[n]){const response=await fetch('assets/'+n+'.wav');if(!response.ok)throw new Error(n);buffers[n]=await audio.decodeAudioData(await response.arrayBuffer());}}));
 }catch(e){$('sound').checked=false;$('closeNote').textContent='音频暂不可用；动效仍可查看。';}
}
function stopSound(){for(const s of sources){try{s.stop();}catch(e){}}sources=[];}
function cue(name,rate=1,volume=.5){if(!$('sound').checked||!audio||audio.state!=='running'||!buffers[name])return;const s=audio.createBufferSource(),g=audio.createGain();s.buffer=buffers[name];s.playbackRate.value=rate;g.gain.value=volume;s.connect(g).connect(audio.destination);s.start();sources.push(s);s.onended=()=>{sources=sources.filter(x=>x!==s);};}
function soundAt(key,at,name,rate=1,gain=.5){if(playing&&elapsed>=at&&!sounded.has(key)){sounded.add(key);cue(name,rate,gain);}}
function fadeMove(el,t,start,span,y=0,scaleFrom=1){const p=out((t-start)/span);el.style.opacity=p;el.style.transform='translateY('+(y*(1-p))+'px) scale('+(scaleFrom+(1-scaleFrom)*p)+')';}
function render(t){
 const quiet=$('quiet').checked,s=quiet?duration:t;
 $('dialog').style.opacity=1;$('dialog').style.transform='';
 $('veil').style.opacity=.67*out(s/140);
 $('halo').style.opacity=screen==='win'&&!quiet?Math.sin(Math.PI*clamp((s-140)/1000))*.6:0;
 if(screen==='pause'){
  fadeMove($('pauseTitle'),s,0,210,5);fadeMove($('pauseRewards'),s,60,220,4);fadeMove($('pauseTabs'),s,120,220,0);fadeMove($('pauseActions'),s,140,200,5);
 }else{
  fadeMove($('crest'),s,80,360,screen==='win'?-16:-10,screen==='win'?.9:1);
  if(screen==='win'){
   const settle=Math.sin(Math.PI*clamp((s-300)/140))*.025;
   $('crest').style.transform+=' scale('+(1+settle)+')';
   stars.forEach((star,i)=>{const at=300+i*170,p=clamp((s-at)/230),z=out(p),settle=Math.sin(Math.PI*clamp((s-at-140)/100))*.05;
    star.style.opacity=out(p/.4);star.style.transform='translateY('+(14*(1-z))+'px) scale('+(.65+.35*z+settle)+')';star.style.setProperty('--glow',Math.sin(Math.PI*p)*.65);
    soundAt('star'+i,at+160,'star',1+i*.12,.4);
   });
  }
  fadeMove($('stageName'),s,screen==='win'?310:220,200,4);fadeMove($('resultNote'),s,screen==='win'?350:250,200,4);
  fadeMove($('paper'),s,screen==='win'?440:260,250,10,.99);
  fadeMove($('goldCard'),s,screen==='win'?550:340,220,5);fadeMove($('xpCard'),s,screen==='win'?630:390,220,5);
  fadeMove($('material'),s,740,230,6,.94);
  $('gold').textContent=screen==='win'?String(Math.round(109*out((s-700)/420))):'27';
  for(const el of [$('ad'),$('back'),$('next')])fadeMove(el,s,screen==='win'?850:470,230,8);
  soundAt('outcome',90,screen==='win'?'victory':'defeat',1,screen==='win'?.65:.45);
 }
 motes.forEach((el,i)=>{const p=clamp((s-230-i*45)/700);el.style.opacity=screen==='win'&&!quiet?Math.sin(Math.PI*p)*.6:0;el.style.transform='translateY('+(-18*p)+'px)';});
 const ready=s>=(screen==='win'?1080:screen==='lose'?690:340);actions.forEach(el=>{el.disabled=!ready;});
 $('scrub').value=t;$('time').textContent=(t/1000).toFixed(2)+' / '+(duration/1000).toFixed(2)+' 秒';
}
function halt(){playing=false;cancelAnimationFrame(raf);stopSound();$('toggle').textContent='继续';}
function tick(now){if(!playing)return;elapsed=Math.min(duration,elapsed+Math.min(80,now-lastNow));lastNow=now;render(elapsed);if(elapsed<duration)raf=requestAnimationFrame(tick);else{playing=false;$('toggle').textContent='继续';}}
function start(reset=true){cancelAnimationFrame(raf);stopSound();if(reset){elapsed=0;sounded.clear();}exiting=false;$('closeNote').textContent='按钮可预览关闭动效。';if($('quiet').checked){elapsed=duration;playing=false;render(elapsed);$('toggle').textContent='继续';return;}playing=true;lastNow=performance.now();render(elapsed);$('toggle').textContent='暂停';raf=requestAnimationFrame(tick);}
function fit(){const w=$('viewport').clientWidth;if(w)$('stage').style.setProperty('--s',w/900);}
function select(next){halt();screen=next;duration=specs[screen].duration;$('scrub').max=duration;$('stage').className='stage '+screen;
 document.querySelectorAll('[data-screen]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.screen===screen)));
 $('still').src=specs[screen].art;$('still').alt=screen==='win'?'胜利弹窗美术效果图':screen==='lose'?'失败弹窗美术效果图':'暂停弹窗美术效果图';
 $('descriptionTitle').textContent=specs[screen].title;$('timings').replaceChildren(...specs[screen].rows.map(r=>{const row=document.createElement('tr');for(const text of r){const cell=document.createElement('td');cell.textContent=text;row.appendChild(cell);}return row;}));
 $('crestImage').src='assets/'+(screen==='lose'?'defeat':'victory')+'-banner.png';$('outcomeTitle').textContent=screen==='lose'?'挑战失败':'挑战成功！';
 $('stageName').textContent=screen==='lose'?'1-5 前哨 · 哨塔争夺 · 普通':'1-4 前哨 · 石桥隘口 · 普通';$('resultNote').textContent=screen==='lose'?'保底奖励 30% · 可复活继续本局':'剩余耐久 100%';
 $('receipt').textContent=screen==='lose'?'金币保底30% · 已到账':'本局累计金币已到账';$('paperNote').textContent=screen==='lose'?'金币已到账 · 复活恢复 30% 耐久 · 重试返回当前关卡':'本局累计金币已到账 · 广告仅加倍金币';
 $('back').textContent=screen==='lose'?'▶ 看广告复活':'返回';$('back').classList.toggle('green',screen==='lose');$('next').textContent=screen==='lose'?'↻ 再来一次':'下一关▶';$('next').classList.toggle('green',screen!=='lose');
 elapsed=duration;render(elapsed);if(mode==='motion')readyAndStart();
}
async function readyAndStart(){const current=screen;await Promise.all(Array.from($('stage').querySelectorAll('img')).map(im=>im.decode?im.decode().catch(()=>{}):Promise.resolve()));if(current===screen&&mode==='motion')start();}
function setMode(next){halt();mode=next;$('still').hidden=mode!=='art';$('viewport').hidden=mode!=='motion';$('controls').hidden=mode!=='motion';$('artMode').setAttribute('aria-pressed',String(mode==='art'));$('motionMode').setAttribute('aria-pressed',String(mode==='motion'));fit();if(mode==='motion')readyAndStart();}
document.querySelectorAll('[data-screen]').forEach(el=>el.addEventListener('click',()=>select(el.dataset.screen)));$('artMode').onclick=()=>setMode('art');$('motionMode').onclick=()=>setMode('motion');$('replay').onclick=()=>start();$('toggle').onclick=()=>{if(playing)halt();else start(elapsed>=duration);};
 $('scrub').oninput=()=>{halt();elapsed=Number($('scrub').value);exiting=false;render(elapsed);};$('quiet').onchange=()=>start();$('sound').onchange=async()=>{if($('sound').checked){await prepareSound();if($('sound').checked)start();}else stopSound();};
actions.forEach(el=>el.addEventListener('click',()=>{if(exiting)return;halt();exiting=true;const begin=performance.now();function exit(now){const p=clamp((now-begin)/140);$('dialog').style.opacity=1-p;$('dialog').style.transform='translateY('+(-6*p)+'px)';$('veil').style.opacity=.67*(1-p);$('halo').style.opacity=0;if(p<1)raf=requestAnimationFrame(exit);else $('closeNote').textContent='已收尾。点击重播重新查看。';}raf=requestAnimationFrame(exit);}));
document.addEventListener('visibilitychange',()=>{if(document.hidden){halt();audio?.suspend();}else if($('sound').checked)audio?.resume();});window.addEventListener('pagehide',halt);new ResizeObserver(fit).observe($('viewport'));select('win');
