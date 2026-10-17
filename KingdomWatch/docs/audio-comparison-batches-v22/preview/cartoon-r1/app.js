'use strict';
const revision = 'cartoon-r1';
const storageKey = 'kw-audio-' + revision;
const choices = {undecided:'未决定', old:'保留旧版', A:'选候选 A', B:'选候选 B', neither:'都不满意，再找'};
const player = new Audio();
player.preload = 'none';
player.volume = .7;
const status = document.querySelector('#play-status');
const saveStatus = document.querySelector('#save-status');
let data, selected = {}, notes = {}, queue = [], token = 0, gapTimer = null, storageWorks = true;
const make = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function clearPlaying() {
  document.querySelectorAll('.playing,.is-playing').forEach(n => n.classList.remove('playing','is-playing'));
  document.querySelectorAll('[data-play]').forEach(n => n.setAttribute('aria-pressed','false'));
}
function stop(message = '已停止') {
  token++;
  clearTimeout(gapTimer);
  gapTimer = null;
  queue = [];
  player.onended = null;
  player.onerror = null;
  player.pause();
  player.removeAttribute('src');
  player.load();
  clearPlaying();
  status.textContent = message;
}
async function next(t) {
  if (t !== token) return;
  const job = queue.shift();
  if (!job) {stop('本次试听完毕'); return;}
  player.onended = null;
  player.onerror = null;
  player.pause();
  clearPlaying();
  const card = document.getElementById('cue-' + job.item.id);
  card?.classList.add('is-playing');
  const button = card?.querySelector('[data-play="' + job.playKey + '"]');
  button?.classList.add('playing');
  button?.setAttribute('aria-pressed','true');
  status.textContent = job.item.id + ' ' + job.item.name + ' · ' + job.label + ' · ' + job.audio.seconds.toFixed(2) + ' 秒';
  player.src = job.audio.file;
  player.onended = () => {
    if (t !== token) return;
    clearPlaying();
    if (!queue.length) {stop('本次试听完毕'); return;}
    status.textContent = '短暂间隔 · 接着播放下一条';
    gapTimer = setTimeout(() => {gapTimer = null; void next(t);}, 450);
  };
  player.onerror = () => {if (t === token) stop('音频载入失败，请重新点击');};
  try {await player.play();}
  catch (e) {if (t === token) stop(e?.name === 'AbortError' ? '播放已中止，请重新点击' : '未能播放，请再次点击');}
}
function play(jobs) {stop(); queue = jobs; void next(token);}
function jobsFor(item) {
  return [{item, label:item.old.label, audio:item.old.audio, playKey:'old'},
    ...item.options.map(o => ({item, label:o.label, audio:o.audio, playKey:o.key}))];
}
function resultText() {
  const lines = ['王国守望 · 免费卡通风成长音效','候选版本：' + revision,'旧版基线：当前游戏 v21',''];
  for (const item of data.items) {
    lines.push(item.id + ' ' + item.name + '：' + choices[selected[item.id] || 'undecided']);
    if (notes[item.id]?.trim()) lines.push('  备注：' + notes[item.id].trim());
  }
  return lines.join('\n');
}
function persist() {
  try {localStorage.setItem(storageKey, JSON.stringify({revision, selected, notes}));}
  catch (_) {storageWorks = false;}
  const count = data.items.filter(i => selected[i.id] && selected[i.id] !== 'undecided').length;
  document.querySelector('#choice-count').textContent = '已选 ' + count + ' / ' + data.items.length;
  document.querySelector('#result-text').value = resultText();
  saveStatus.textContent = storageWorks ? '已保存到当前浏览器；复制结果发给我后，我才能收到。' : '浏览器无法保存，请复制或下载结果。';
}
function playButton(job, cls) {
  const b = make('button', undefined, cls);
  b.type = 'button';
  b.dataset.play = job.playKey;
  b.setAttribute('aria-pressed','false');
  b.append(document.createTextNode(job.label), make('small', job.audio.seconds.toFixed(2) + ' 秒'));
  b.setAttribute('aria-label', job.item.id + ' ' + job.label + '，播放 ' + job.audio.seconds.toFixed(2) + ' 秒');
  b.onclick = () => play([job]);
  return b;
}
function render(item) {
  const card = make('article');
  card.id = 'cue-' + item.id;
  const heading = make('h2');
  heading.append(make('code', item.id), document.createTextNode(item.name));
  card.append(heading, make('p', item.purpose, 'purpose'));
  const row = make('div', undefined, 'pair many');
  const jobs = jobsFor(item);
  jobs.forEach(j => row.append(playButton(j, j.playKey === 'old' ? '' : 'gold')));
  const sequential = make('button', '顺序试听：旧版 → A → B', 'ab');
  sequential.type = 'button';
  sequential.onclick = () => play(jobsFor(item));
  row.append(sequential);
  card.append(row);
  if (item.examples?.length) {
    card.append(make('p', '五连升 · 同一音效每 240ms 一次', 'source-chip'));
    const examples = make('div', undefined, 'examples');
    for (const e of item.examples) {
      examples.append(playButton({item, label:e.label, audio:e.audio, playKey:e.key + '-repeat'}, ''));
    }
    card.append(examples);
  }
  const field = make('fieldset', undefined, 'choice');
  field.append(make('legend', '你的选择'));
  for (const [value, label] of Object.entries(choices)) {
    const l = make('label'), input = make('input');
    input.type = 'radio'; input.name = 'choice-' + item.id; input.value = value;
    input.checked = (selected[item.id] || 'undecided') === value;
    input.onchange = () => {selected[item.id] = value; persist();};
    l.append(input, document.createTextNode(label)); field.append(l);
  }
  card.append(field);
  const details = make('details', undefined, 'source-note');
  details.append(make('summary','备注 / 原素材与授权'));
  const note = make('textarea');
  note.rows = 2; note.maxLength = 1000;
  note.placeholder = '选填：音色是否对味，或想更短、更厚、更明亮等';
  note.setAttribute('aria-label',item.id + '备注');
  note.value = notes[item.id] || '';
  note.oninput = () => {notes[item.id] = note.value; persist();};
  details.append(note);
  for (const o of item.options) {
    const p = make('p', o.label + '：' + o.sourceFile + ' · ' + o.author + ' · ' + o.license + ' · ');
    const a = make('a','原作者来源');
    a.href = o.sourceURL; a.target = '_blank'; a.rel = 'noopener noreferrer';
    p.append(a); details.append(p);
  }
  card.append(details);
  return card;
}
async function init() {
  try {
    const response = await fetch('data.json?v=' + revision);
    if (!response.ok) throw new Error('Data unavailable');
    data = await response.json();
    if (data.revision !== revision || !Array.isArray(data.items)) throw new Error('Revision mismatch');
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved?.revision === revision) for (const item of data.items) {
        const choice = saved.selected?.[item.id];
        if (Object.hasOwn(choices, choice)) selected[item.id] = choice;
        if (typeof saved.notes?.[item.id] === 'string') notes[item.id] = saved.notes[item.id].slice(0,1000);
      }
    } catch (_) {storageWorks = false;}
    const cards = document.querySelector('#cards');
    cards.replaceChildren(...data.items.map(render)); cards.setAttribute('aria-busy','false');
    for (const id of ['copy-results','download-results','play-batch-old','play-batch-new']) document.getElementById(id).disabled = false;
    document.querySelector('#play-batch-old').onclick = () => play(data.items.map(i => jobsFor(i)[0]));
    document.querySelector('#play-batch-new').onclick = () => play(data.items.flatMap(i => jobsFor(i).slice(1)));
    persist();
  } catch (_) {
    document.querySelector('#cards').replaceChildren(make('p','清单载入失败，请刷新重试。'));
    document.querySelector('#cards').setAttribute('aria-busy','false');
    status.textContent = '未能载入试听清单';
  }
}
document.querySelector('#volume').oninput = e => {
  player.volume = Number(e.target.value);
  document.querySelector('#volume-value').textContent = Math.round(player.volume * 100) + '%';
};
document.querySelector('#stop').onclick = () => stop();
document.querySelector('#copy-results').onclick = async () => {
  const box = document.querySelector('#result-text'); box.value = resultText();
  try {await navigator.clipboard.writeText(box.value); saveStatus.textContent = '已复制，请粘贴发给我。';}
  catch (_) {box.focus(); box.select(); saveStatus.textContent = '请长按文字或按 Ctrl+C 复制。';}
};
document.querySelector('#download-results').onclick = () => {
  const out = {revision, baseline:data.baseline, selectedAt:new Date().toISOString(),
    items:data.items.map(i => ({id:i.id, name:i.name, choice:selected[i.id] || 'undecided', note:notes[i.id] || ''}))};
  const url = URL.createObjectURL(new Blob([JSON.stringify(out,null,2)], {type:'application/json'}));
  const a = make('a'); a.href = url; a.download = '王国守望-免费卡通音效选择-' + revision + '.json';
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1500);
  saveStatus.textContent = '选择记录已准备下载。';
};
document.addEventListener('visibilitychange', () => {if (document.hidden) stop('页面已隐藏，试听已停止');});
window.addEventListener('pagehide', () => stop());
document.addEventListener('keydown', e => {if (e.key === 'Escape') stop();});
void init();
