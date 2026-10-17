'use strict';
const key = 'kw-audio-growth-r1';
const choices = { undecided:'未决定', old:'保留旧版', A:'选候选 A', B:'选候选 B', C:'选候选 C', neither:'都不满意，再找' };
const player = new Audio(); player.preload = 'none'; player.volume = .7;
const status = document.querySelector('#play-status');
const saveStatus = document.querySelector('#save-status');
let data, selected = {}, notes = {}, queue = [], token = 0;
let current = null, storageWorks = true;
const make = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
function stop(message='已停止') {
  token++; queue=[]; player.onended=null; player.onerror=null; player.pause(); player.removeAttribute('src'); player.load(); current=null;
  document.querySelectorAll('.playing,.is-playing').forEach(n=>n.classList.remove('playing','is-playing'));
  status.textContent=message;
}
async function next(t) {
  if(t!==token)return;
  const job=queue.shift();
  if(!job){stop('本次试听完毕');return;}
  current=job; player.onended=null; player.onerror=null; player.pause();
  document.querySelectorAll('.playing,.is-playing').forEach(n=>n.classList.remove('playing','is-playing'));
  const card=document.getElementById('cue-'+job.item.id); card?.classList.add('is-playing');
  card?.querySelector('[data-option="'+job.option.key+'"]')?.classList.add('playing');
  status.textContent=job.item.id+' '+job.item.name+' · '+job.option.label+' · '+job.option.seconds.toFixed(2)+' 秒';
  player.src=job.option.file; player.onended=()=>{if(t===token)void next(t);};
  player.onerror=()=>{if(t===token)stop('载入失败，请点击重试');};
  try{await player.play();}catch(e){if(t!==token)return;stop(e?.name==='AbortError'?'播放已中止，请重新点击':'未能播放，请再次点击');}
}
function play(jobs){stop();queue=jobs;void next(token);}
function resultText(){
  const lines=['王国守望 · 升级音效重选 · growth-r1','旧版基线：当前游戏 v21',''];
  for(const item of data.items){lines.push(item.id+' '+item.name+'：'+choices[selected[item.id]||'undecided']);if(notes[item.id]?.trim())lines.push('  备注：'+notes[item.id].trim());}
  return lines.join('\n');
}
function persist(){
  try{localStorage.setItem(key,JSON.stringify({revision:data.revision,selected,notes}));}catch(_){storageWorks=false;}
  const n=data.items.filter(x=>selected[x.id]&&selected[x.id]!=='undecided').length;
  document.querySelector('#choice-count').textContent='已选 '+n+' / 3';
  document.querySelector('#result-text').value=resultText();
  saveStatus.textContent=storageWorks?'已保存在当前浏览器；复制后发给我。':'浏览器无法保存，请复制或下载选择。';
}
function render(item){
  const card=make('article');card.id='cue-'+item.id;
  const h=make('h2');h.append(make('code',item.id),document.createTextNode(item.name));
  card.append(h,make('p',item.purpose,'purpose'));
  const row=make('div',undefined,'pair many');
  const old={key:'old',label:item.old.label,file:item.old.audio.file,seconds:item.old.audio.seconds};
  for(const option of [old,...item.options.map(o=>({...o,...o.audio,label:'候选 '+o.key}))]){
    const b=make('button',undefined,option.key==='old'?'':'gold');b.type='button';b.dataset.option=option.key;
    b.append(document.createTextNode(option.label),make('small',option.seconds.toFixed(2)+' 秒'));
    b.setAttribute('aria-label',item.id+' '+option.label+'，播放 '+option.seconds.toFixed(2)+' 秒');
    b.onclick=()=>play([{item,option}]);row.append(b);
  }
  const all=make('button','顺序试听旧版 → A → B → C','ab');all.type='button';
  all.onclick=()=>play([old,...item.options.map(o=>({...o,...o.audio,label:'候选 '+o.key}))].map(option=>({item,option})));
  row.append(all);card.append(row);
  const field=make('fieldset',undefined,'choice');field.append(make('legend','你的选择'));
  for(const [value,label] of Object.entries(choices)){
    const l=make('label'),radio=make('input');radio.type='radio';radio.name='choice-'+item.id;radio.value=value;radio.checked=(selected[item.id]||'undecided')===value;
    radio.onchange=()=>{selected[item.id]=value;persist();};l.append(radio,document.createTextNode(label));field.append(l);
  }
  card.append(field);
  const details=make('details',undefined,'source-note');details.append(make('summary','备注 / 新候选来源'));
  const note=make('textarea');note.rows=2;note.maxLength=1000;note.placeholder='选填：不满意的点或想要的感觉';note.value=notes[item.id]||'';
  note.setAttribute('aria-label',item.id+'备注');note.oninput=()=>{notes[item.id]=note.value;persist();};details.append(note);
  for(const o of item.options){
    const p=make('p','候选 '+o.key+'：'+o.sourceFile+' · '+o.author+' · '+o.license+' · ');
    const a=make('a','来源');a.href=o.sourceURL;a.target='_blank';a.rel='noopener noreferrer';p.append(a);details.append(p);
  }
  card.append(details);return card;
}
async function init(){
  try{
    const response=await fetch('data.json?v=growth-r1');if(!response.ok)throw new Error('Data unavailable');data=await response.json();
    try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.revision===data.revision){selected=saved.selected||{};notes=saved.notes||{};}}catch(_){storageWorks=false;}
    const cards=document.querySelector('#cards');cards.replaceChildren(...data.items.map(render));cards.setAttribute('aria-busy','false');
    document.querySelector('#copy-results').disabled=false;document.querySelector('#download-results').disabled=false;persist();
  }catch(_){document.querySelector('#cards').replaceChildren(make('p','清单载入失败，请刷新重试。'));document.querySelector('#cards').setAttribute('aria-busy','false');status.textContent='未能载入试听清单';}
}
document.querySelector('#stop').onclick=()=>stop();
document.querySelector('#copy-results').onclick=async()=>{const box=document.querySelector('#result-text');box.value=resultText();try{await navigator.clipboard.writeText(box.value);saveStatus.textContent='已复制，请粘贴发给我。';}catch(_){box.focus();box.select();saveStatus.textContent='请长按结果文字或按 Ctrl+C 复制。';}};
document.querySelector('#download-results').onclick=()=>{
  const out={revision:data.revision,baseline:data.baseline,selectedAt:new Date().toISOString(),items:data.items.map(x=>({id:x.id,name:x.name,choice:selected[x.id]||'undecided',note:notes[x.id]||''}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));const a=make('a');a.href=url;a.download='王国守望-升级音效选择-growth-r1.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);saveStatus.textContent='选择记录已准备下载。';
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('页面已隐藏，试听已停止');});window.addEventListener('pagehide',()=>stop());document.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
void init();
