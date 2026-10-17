(() => {
  'use strict';
  const player = document.querySelector('#player');
  const title = document.querySelector('#now-title');
  const hint = document.querySelector('#now-hint');
  const version = document.querySelector('#version');
  const error = document.querySelector('#play-error');
  const storageKey = 'kingdom-watch-representatives-r1';
  let data, token = 0;
  let saved = {revision: 'representatives-r1', selections: {}, notes: ''};
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (v && v.revision === saved.revision && v.selections && typeof v.selections === 'object') {
      saved.selections = v.selections;
      saved.notes = typeof v.notes === 'string' ? v.notes : '';
    }
  } catch (_) { /* Storage is optional. */ }
  const notes = document.querySelector('#notes');
  notes.value = saved.notes;
  function save() {
    saved.notes = notes.value;
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch (_) { document.querySelector('#save-status').textContent = '当前浏览器不能保存，请复制反馈发给我。'; }
  }
  notes.addEventListener('input', save);
  function stop() { token++; player.pause(); }
  async function play(file, name, side, message, poster) {
    stop();
    const request = token;
    error.hidden = true;
    player.src = file;
    if (poster) player.poster = poster;
    title.textContent = name;
    version.textContent = side === 'old' ? '旧版 v21' : '新方案 r1';
    hint.textContent = message;
    player.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center'});
    try { await player.play(); }
    catch (e) {
      if (request !== token || e.name === 'AbortError') return;
      error.textContent = '未能播放。请点击播放器的播放键，或换一个浏览器重试。';
      error.hidden = false;
    }
  }
  player.volume = .7;
  document.querySelector('#volume').addEventListener('input', e => { player.volume = Number(e.target.value); });
  player.addEventListener('volumechange', () => { document.querySelector('#volume').value = String(player.volume); });
  document.querySelector('#stop').addEventListener('click', () => { stop(); if (player.readyState) player.currentTime = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  function feedbackText() {
    return ['王国守望 · 代表声音 r1', ...data.items.map(row => `${row.id} ${row.name}：${saved.selections[row.id] || '未决定'}`), '', '整体意见：'+(notes.value || '无')].join('\n');
  }
  document.querySelector('#copy').addEventListener('click', async () => {
    if (!data) return;
    save();
    try {
      await navigator.clipboard.writeText(feedbackText());
      document.querySelector('#save-status').textContent = '已复制。把反馈粘贴发给我后，再按通过的方向扩展。';
    } catch (_) {
      const box = document.createElement('textarea');
      box.value = feedbackText(); document.body.append(box); box.focus(); box.select();
      document.querySelector('#save-status').textContent = '请复制已选中的反馈文字，再粘贴发给我。';
      box.addEventListener('blur', () => box.remove(), {once:true});
    }
  });
  document.querySelector('#export').addEventListener('click', () => {
    if (!data) return;
    save();
    const blob = new Blob([feedbackText()], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = '王国守望-代表声音r1-反馈.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  fetch('data.json').then(r => { if (!r.ok) throw new Error('manifest'); return r.json(); }).then(manifest => {
    data = manifest;
    const list = document.querySelector('#cases'); list.replaceChildren();
    for (const row of data.items) {
      const article = document.createElement('article'); article.className = 'case';
      const description = document.createElement('div');
      const name = document.createElement('div'); name.className = 'case-title';
      const id = document.createElement('span'); id.className = 'case-id'; id.textContent = row.id;
      name.append(id, document.createTextNode(row.name));
      const prompt = document.createElement('p'); prompt.textContent = row.listenFor;
      description.append(name, prompt);
      const buttons = document.createElement('div'); buttons.className = 'buttons';
      for (const side of ['new','old']) {
        const button = document.createElement('button');
        button.textContent = side === 'new' ? '▶ 听新方案' : '听旧版';
        if (side === 'new') button.className = 'primary';
        button.addEventListener('click', () => play(row.clips[side].file, row.id+' '+row.name, side, row.listenFor, row.poster));
        buttons.append(button);
      }
      const field = document.createElement('fieldset');
      const legend = document.createElement('legend'); legend.textContent = row.name+'的选择'; field.append(legend);
      for (const answer of ['这个方向可以','还差一点','不对味','未决定']) {
        const label = document.createElement('label'); label.className = 'choice';
        const input = document.createElement('input'); input.type = 'radio'; input.name = row.id; input.value = answer;
        input.checked = (saved.selections[row.id] || '未决定') === answer;
        input.addEventListener('change', () => { saved.selections[row.id] = answer; save(); });
        label.append(input, document.createTextNode(answer)); field.append(label);
      }
      article.append(description, buttons, field); list.append(article);
    }
    for (const side of ['new','old']) {
      document.querySelector('#all-'+side).addEventListener('click', () => play(data.montage[side], '整组'+(side === 'new' ? '新方案' : '旧版')+' · '+(side === 'new' ? data.montage.seconds : data.montage.oldSeconds)+' 秒', side,
        '弓箭 → 寒冰 → 三选一 → 升级 → 领奖 → 胜利 → 失败。仅确认这组声音方向，不会自动替换游戏。', 'media/R04.jpg'));
    }
  }).catch(() => { document.querySelector('#cases').textContent = '加载失败，请刷新页面重试。'; });
})();
