'use strict';
// Preview only: one native audio element, no game modules, autoplay or network writes.
const storageKey = 'kw-audio-selection-batch-01-r1';
const choiceNames = { undecided: '未决定', old: '保留旧版', new: '选新候选 A', neither: '都不满意，再找' };
const player = new Audio();
player.preload = 'none';
player.volume = .7;
const status = document.querySelector('#play-status');
const saveStatus = document.querySelector('#save-status');
let data = null;
let selections = {};
let notes = {};
let queue = [];
let current = null;
let generation = 0;
let storageWorks = true;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function clearPlaying() {
  document.querySelectorAll('.playing,.is-playing').forEach(node => node.classList.remove('playing', 'is-playing'));
}

function stop(message = '已停止') {
  generation++;
  queue = [];
  player.onended = null;
  player.onerror = null;
  player.pause();
  player.removeAttribute('src');
  player.load();
  current = null;
  clearPlaying();
  status.textContent = message;
}

async function playNext(token) {
  if (token !== generation) return;
  const entry = queue.shift();
  if (!entry) { stop('本次播放完毕'); return; }
  current = entry;
  player.onended = null;
  player.onerror = null;
  player.pause();
  clearPlaying();
  const article = document.getElementById('cue-' + entry.item.id);
  article?.classList.add('is-playing');
  article?.querySelector('[data-side="' + entry.side + '"]')?.classList.add('playing');
  status.textContent = entry.item.id + ' ' + entry.item.name + ' · ' + entry.item[entry.side].label;
  player.src = entry.item[entry.side].file;
  player.onended = () => { if (token === generation) void playNext(token); };
  player.onerror = () => { if (token === generation) stop('音频载入失败，请点击重试'); };
  try {
    await player.play();
  } catch (error) {
    if (token !== generation) return;
    const interrupted = error && error.name === 'AbortError';
    stop(interrupted ? '播放已中止，请重新点击' : '未能播放，请再次点击；也可以逐条试听');
  }
}

function start(entries) {
  stop();
  queue = entries;
  void playNext(generation);
}

function buildResult() {
  const lines = ['王国守望 · 第 1 批：奖励与成长', '候选版本：' + data.revision, '旧版基线：当前游戏 v21', ''];
  data.items.forEach(item => {
    lines.push(item.id + ' ' + item.name + '：' + choiceNames[selections[item.id] || 'undecided']);
    if (notes[item.id]?.trim()) lines.push('  备注：' + notes[item.id].trim());
  });
  return lines.join('\n');
}

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ revision: data.revision, selections, notes })); }
  catch (_) { storageWorks = false; }
  const count = data.items.filter(item => selections[item.id] && selections[item.id] !== 'undecided').length;
  document.querySelector('#choice-count').textContent = '已选 ' + count + ' / ' + data.items.length;
  document.querySelector('#result-text').value = buildResult();
  saveStatus.textContent = storageWorks ? '已保存在当前浏览器；请复制结果发给我。' : '当前浏览器无法保存，请复制或下载选择记录。';
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && saved.revision === data.revision) {
      for (const item of data.items) {
        const value = saved.selections?.[item.id];
        if (Object.prototype.hasOwnProperty.call(choiceNames, value)) selections[item.id] = value;
        const note = saved.notes?.[item.id];
        if (typeof note === 'string') notes[item.id] = note.slice(0, 1000);
      }
    }
  } catch (_) { storageWorks = false; }
}

function renderCard(item) {
  const article = element('article');
  article.id = 'cue-' + item.id;
  const heading = element('h2');
  heading.append(element('code', item.id), document.createTextNode(item.name));
  article.append(heading, element('p', item.purpose, 'purpose'));
  const pair = element('div', undefined, 'pair');
  for (const side of ['old', 'new']) {
    const button = element('button', item[side].label, side === 'new' ? 'gold' : '');
    button.type = 'button';
    button.dataset.side = side;
    button.setAttribute('aria-label', item.id + ' ' + item.name + '，播放' + item[side].label);
    button.append(element('small', item[side].seconds.toFixed(2) + ' 秒'));
    button.onclick = () => start([{ item, side }]);
    pair.append(button);
  }
  const ab = element('button', '旧 → 新 连听', 'ab');
  ab.type = 'button';
  ab.setAttribute('aria-label', item.id + ' 先听旧版，再听新候选');
  ab.onclick = () => start([{ item, side: 'old' }, { item, side: 'new' }]);
  pair.append(ab);
  article.append(pair);
  const choice = element('fieldset', undefined, 'choice');
  choice.append(element('legend', '你的选择'));
  for (const [value, label] of Object.entries(choiceNames)) {
    const field = element('label');
    const input = element('input');
    input.type = 'radio';
    input.name = 'choice-' + item.id;
    input.value = value;
    input.checked = (selections[item.id] || 'undecided') === value;
    input.onchange = () => { selections[item.id] = value; persist(); };
    field.append(input, document.createTextNode(label));
    choice.append(field);
  }
  article.append(choice);
  const details = element('details', undefined, 'source-note');
  details.append(element('summary', '备注 / 音源'));
  const note = element('textarea');
  note.rows = 2;
  note.maxLength = 1000;
  note.placeholder = '选填：太长、太尖、尾音太多，或你想要的方向…';
  note.setAttribute('aria-label', item.id + ' 试听备注');
  note.value = notes[item.id] || '';
  note.oninput = () => { notes[item.id] = note.value; persist(); };
  const source = element('p', '新候选原文件：' + item.new.source.split('/').pop() + ' · ');
  const sourceLink = element('a', '作者源页面');
  sourceLink.href = item.new.sourceURL;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  source.append(sourceLink);
  details.append(note, source, element('p', item.new.edits));
  if (item.note) details.append(element('p', item.note));
  article.append(details);
  return article;
}

async function init() {
  try {
    const response = await fetch('data.json?v=batch-01-r1');
    if (!response.ok) throw new Error('Manifest HTTP ' + response.status);
    data = await response.json();
    restore();
    document.querySelector('#batch-count').textContent = '本批 ' + data.items.length + ' 项';
    const cards = document.querySelector('#cards');
    cards.replaceChildren(...data.items.map(renderCard));
    cards.setAttribute('aria-busy', 'false');
    const plan = document.querySelector('#batch-plan');
    const inventory = document.querySelector('#inventory');
    for (const group of data.batches) {
      plan.append(element('li', group.title + ' · ' + group.ids.length + ' 项 · ' + (group.status === 'ready' ? '本批已准备' : '待制作'), group.status === 'ready' ? 'ready' : ''));
      inventory.append(element('h3', '第 ' + group.number + ' 批 · ' + group.title));
      for (const item of data.inventory.filter(item => item.batch === group.number)) {
        inventory.append(element('p', item.id + ' ' + item.name));
      }
    }
    document.querySelector('#play-batch-old').onclick = () => start(data.items.map(item => ({ item, side: 'old' })));
    document.querySelector('#play-batch-new').onclick = () => start(data.items.map(item => ({ item, side: 'new' })));
    document.querySelector('#copy-results').disabled = false;
    document.querySelector('#download-results').disabled = false;
    persist();
  } catch (_) {
    document.querySelector('#cards').replaceChildren(element('p', '清单载入失败，请刷新重试。'));
    document.querySelector('#cards').setAttribute('aria-busy', 'false');
    status.textContent = '未能载入本批试听';
    document.querySelector('#play-batch-old').disabled = true;
    document.querySelector('#play-batch-new').disabled = true;
  }
}

document.querySelector('#stop').onclick = () => stop();
document.querySelector('#volume').oninput = event => {
  player.volume = Number(event.target.value);
  document.querySelector('#volume-value').textContent = Math.round(player.volume * 100) + '%';
};
document.querySelector('#copy-results').onclick = async () => {
  const box = document.querySelector('#result-text');
  box.value = buildResult();
  try {
    await navigator.clipboard.writeText(box.value);
    saveStatus.textContent = '已复制，请把结果粘贴发给我。';
  } catch (_) {
    box.focus(); box.select();
    saveStatus.textContent = '请长按结果文字或按 Ctrl+C 手动复制。';
  }
};
document.querySelector('#download-results').onclick = () => {
  const record = { revision: data.revision, baseline: data.baseline,
    selectedAt: new Date().toISOString(), items: data.items.map(item => ({ id: item.id, name: item.name,
      choice: selections[item.id] || 'undecided', note: notes[item.id] || '',
      candidateSHA256: item.new.sha256, baselineSourceSHA256: item.old.sourceSHA256 })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = element('a'); link.href = url; link.download = '王国守望-音效选择-第1批-r1.json';
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  saveStatus.textContent = '选择记录已准备下载，可发给我。';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) stop('页面已隐藏，播放已停止'); });
window.addEventListener('pagehide', () => stop('已停止'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') stop(); });
void init();
