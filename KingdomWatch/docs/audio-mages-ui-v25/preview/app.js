'use strict';
const player=document.getElementById('player');
const title=document.getElementById('title');
const detail=document.getElementById('detail');
const status=document.getElementById('status');
let requestId=0;
player.volume=.8;
async function playScene(src,heading,description,poster,id){
  const current=++requestId;
  player.pause();
  player.src=src;
  player.poster=poster;
  title.textContent=heading;
  detail.textContent=description;
  document.querySelectorAll('.scene').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
  status.textContent='载入中…';
  try{await player.play();if(current===requestId)status.textContent='正在播放';}
  catch(e){if(current===requestId)status.textContent=e.name==='NotAllowedError'?'请点视频播放按钮':'播放未开始，请重试';}
}
document.getElementById('all').addEventListener('click',()=>playScene('media/all.mp4','本次更新连听','约 24 秒 · 同步画面的项目分镜，不是实机录像。','media/pyro.jpg','all'));
document.getElementById('stop').addEventListener('click',()=>{requestId++;player.pause();player.currentTime=0;status.textContent='已停止';});
document.getElementById('volume').addEventListener('input',e=>{player.volume=Number(e.target.value);});
player.addEventListener('volumechange',()=>{document.getElementById('volume').value=String(player.volume);});
player.addEventListener('play',()=>{status.textContent='正在播放';});
player.addEventListener('pause',()=>{if(!player.ended)status.textContent='已暂停';});
player.addEventListener('ended',()=>{status.textContent='播放结束';});
player.addEventListener('error',()=>{status.textContent='载入失败，请重试';});
document.addEventListener('visibilitychange',()=>{if(document.hidden){requestId++;player.pause();}});
window.addEventListener('pagehide',()=>{requestId++;player.pause();});
fetch('scenes.json').then(r=>{if(!r.ok)throw new Error('Load failed');return r.json();}).then(scenes=>{
  const grid=document.getElementById('scenes');
  scenes.forEach((scene,index)=>{
    const button=document.createElement('button');button.className='scene';button.dataset.id=scene.id;button.setAttribute('aria-pressed','false');
    const number=document.createElement('span');number.className='number';number.textContent=String(index+1).padStart(2,'0');
    const body=document.createElement('span');const name=document.createElement('b');name.textContent=scene.title;
    const sub=document.createElement('small');sub.textContent=scene.detail+' · '+scene.seconds+' 秒';
    body.append(name,sub);button.append(number,body);grid.append(button);
    button.addEventListener('click',()=>playScene(scene.video,scene.title,scene.detail,scene.poster,scene.id));
  });
}).catch(()=>{status.textContent='场景列表载入失败；仍可使用全套连听。';});
