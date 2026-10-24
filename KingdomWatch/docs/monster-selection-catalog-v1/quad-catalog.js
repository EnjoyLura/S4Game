(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sheets = window.QUAD_MONSTER_CATALOG?.sheets || [];
  const byId = new Map(sheets.map(sheet => [sheet.id, sheet]));
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state = {chapter:'', search:''};
  let visible = [];
  let detailIds = [];
  let activeId = '';
  let detailTrigger = null;
  let player = null;
  let motionMode = false;

  const chapterLabel = sheet => `第${sheet.chapter}章 · ${sheet.chapterName}`;
  const membersHtml = sheet => sheet.members.map(member => `<div class="quad-member"><span>${esc(member.position)}</span><strong>${esc(member.name)}</strong></div>`).join('');
  const metaLabel = sheet => `${sheet.width} × ${sheet.height} · PNG · ${(sheet.bytes / 1024 / 1024).toFixed(2)} MB`;
  const animatedCount = sheet => sheet.members.filter(member => window.MonsterFramePlayer.hasClip(member.mobId)).length;

  function renderChapters() {
    const chapters = [...new Set(sheets.map(sheet => sheet.chapter))];
    $('quadChapters').innerHTML = [{value:'',label:'全部章节',count:sheets.length}, ...chapters.map(chapter => ({
      value:String(chapter),label:chapterLabel(sheets.find(sheet => sheet.chapter === chapter)),count:sheets.filter(sheet => sheet.chapter === chapter).length
    }))].map(item => `<button class="live-chapter-tab" data-quad-chapter="${item.value}" aria-pressed="${state.chapter === item.value}">${esc(item.label)}<span>${item.count}</span></button>`).join('');
  }
  function render() {
    const terms = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    visible = sheets.filter(sheet => (!state.chapter || String(sheet.chapter) === state.chapter)
      && terms.every(term => [sheet.id,sheet.title,chapterLabel(sheet),sheet.note,...sheet.members.map(member => member.name),...(sheet.tags || [])].join(' ').toLowerCase().includes(term)));
    $('quadGrid').innerHTML = visible.map(sheet => `<article class="quad-card">
      <button class="quad-art" data-quad-view="${esc(sheet.id)}" aria-label="放大 ${esc(sheet.title)}"><img src="${esc(sheet.image)}" alt="${esc(sheet.members.map(member => `${member.position}：${member.name}`).join('；'))}" width="${sheet.width}" height="${sheet.height}" loading="lazy" decoding="async"></button>
      <div class="quad-card-info"><div class="quad-card-heading"><h3>${esc(sheet.title)}</h3><span class="quad-sheet-id">${esc(sheet.id)}</span></div><span class="quad-animation-label">已接入 ${animatedCount(sheet)} / 4 个动作</span><div class="quad-members">${membersHtml(sheet)}</div><p class="quad-note">${esc(sheet.note)}</p><p class="quad-card-meta">${esc(chapterLabel(sheet))} · ${esc(metaLabel(sheet))}</p><div class="quad-card-actions"><button class="button" data-quad-view="${esc(sheet.id)}">查看大图</button><button class="button" data-quad-play="${esc(sheet.id)}"${animatedCount(sheet) ? '' : ' disabled'}>播放已接入动作</button><a class="button" href="${esc(sheet.image)}" target="_blank" rel="noopener">打开原图 ↗</a><a class="button" href="${esc(sheet.image)}" download="${esc(sheet.downloadName)}">下载 PNG</a><button class="text-button" data-copy-quad="${esc(sheet.id)}">复制组合清单</button></div></div>
    </article>`).join('');
    $('quadResults').textContent = `当前显示 ${visible.length} / ${sheets.length} 张四宫格 · 一页连续显示`;
    $('quadEmpty').hidden = visible.length > 0;
    renderChapters();
  }
  function paintDetail() {
    const sheet = byId.get(activeId);
    const index = detailIds.indexOf(activeId);
    $('quadDetailTitle').textContent = sheet.title;
    $('quadDetailMeta').textContent = `${index + 1} / ${detailIds.length} · ${chapterLabel(sheet)} · ${metaLabel(sheet)}`;
    $('quadDetailImage').src = sheet.image;
    $('quadDetailImage').alt = sheet.members.map(member => `${member.position}：${member.name}`).join('；');
    $('quadDetailMembers').innerHTML = membersHtml(sheet);
    $('quadDetailNote').textContent = sheet.note;
    const count = animatedCount(sheet);
    $('quadShowMotion').disabled = !count;
    $('quadShowMotion').textContent = `已接入动作（${count}/4）`;
    const missing = sheet.members.filter(member => !window.MonsterFramePlayer.hasClip(member.mobId));
    $('quadMotionSummary').textContent = missing.length ? `${missing.map(member => member.name).join('、')}尚未接入动画，播放时保留静态。` : '四个怪物均可播放游戏已接入的序列帧。';
    $('quadDetailOpen').href = sheet.image;
    $('quadDetailDownload').href = sheet.image;
    $('quadDetailDownload').download = sheet.downloadName;
    $('prevQuadDetail').disabled = index <= 0;
    $('nextQuadDetail').disabled = index >= detailIds.length - 1;
    paintMode();
  }
  function paintMode() {
    player?.destroy(); player = null;
    const sheet = byId.get(activeId);
    if (!animatedCount(sheet)) motionMode = false;
    $('quadDetailImage').hidden = motionMode;
    $('quadFramePlayer').hidden = !motionMode;
    $('quadShowSource').setAttribute('aria-pressed', String(!motionMode));
    $('quadShowMotion').setAttribute('aria-pressed', String(motionMode));
    if (motionMode) {
      const halfWidth = sheet.width / 2, halfHeight = sheet.height / 2;
      const actors = sheet.members.map((member, index) => ({id:member.mobId,name:member.name,position:member.position,
        fallbackImage:sheet.image,fallbackRect:[(index % 2) * halfWidth,Math.floor(index / 2) * halfHeight,halfWidth,halfHeight]}));
      player = window.MonsterFramePlayer.mount($('quadFramePlayer'), actors, {autoplay:true});
    }
  }
  function showDetail(id, trigger, play = false) {
    if (!byId.has(id)) return;
    activeId = id;
    detailTrigger = trigger;
    motionMode = play;
    detailIds = visible.map(sheet => sheet.id);
    paintDetail();
    if (!$('quadDetailDialog').open) $('quadDetailDialog').showModal();
    document.body.classList.add('modal-open');
  }
  function stepDetail(direction) {
    const next = detailIds[detailIds.indexOf(activeId) + direction];
    if (next) { activeId = next; paintDetail(); }
  }
  async function copySheet(id) {
    const sheet = byId.get(id);
    if (!sheet) return;
    const imageUrl = new URL(sheet.image, document.baseURI);
    const text = [`Kingdom Watch · 四宫格 ${sheet.id}`,sheet.title,chapterLabel(sheet),'',
      ...sheet.members.map(member => `${member.position}：${member.name}`),'',`原图：${imageUrl.href}`,`说明：${sheet.note}`].join('\n');
    $('quadCopyText').value = text;
    $('quadCopyPanel').hidden = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      $('quadCopyHint').textContent = '已复制组合与位置，可以粘贴到聊天。';
    } catch (_) {
      $('quadCopyText').focus(); $('quadCopyText').select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { /* Keep the manual copy field available. */ }
      $('quadCopyHint').textContent = copied ? '已复制组合与位置，可以粘贴到聊天。' : '请在下方按 Ctrl+C 或长按复制，也可以保存为 TXT。';
      $('quadCopyPanel').scrollIntoView({block:'nearest'});
    }
  }

  $('quadChapters').addEventListener('click', event => {
    const button = event.target.closest('[data-quad-chapter]');
    if (button) { state.chapter = button.dataset.quadChapter; render(); }
  });
  $('quadSearch').addEventListener('input', () => { state.search = $('quadSearch').value; render(); });
  $('resetQuadFilters').onclick = () => {
    state.chapter = ''; state.search = ''; $('quadSearch').value = ''; render();
  };
  $('quadGrid').addEventListener('click', event => {
    const play = event.target.closest('[data-quad-play]');
    if (play) { showDetail(play.dataset.quadPlay, play, true); return; }
    const view = event.target.closest('[data-quad-view]');
    if (view) { showDetail(view.dataset.quadView, view); return; }
    const copy = event.target.closest('[data-copy-quad]');
    if (copy) copySheet(copy.dataset.copyQuad);
  });
  $('closeQuadCopy').onclick = () => { $('quadCopyPanel').hidden = true; };
  $('saveQuadList').onclick = () => {
    const url = URL.createObjectURL(new Blob(['\ufeff' + $('quadCopyText').value], {type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url; link.download = '怪物四宫格组合清单.txt';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('closeQuadDetail').onclick = () => $('quadDetailDialog').close();
  $('prevQuadDetail').onclick = () => stepDetail(-1);
  $('nextQuadDetail').onclick = () => stepDetail(1);
  $('quadShowSource').onclick = () => { motionMode = false; paintMode(); };
  $('quadShowMotion').onclick = () => { motionMode = true; paintMode(); };
  $('quadDetailDialog').addEventListener('close', () => {
    player?.destroy(); player = null;
    if (![...document.querySelectorAll('dialog')].some(dialog => dialog.open)) document.body.classList.remove('modal-open');
    if (detailTrigger?.isConnected) detailTrigger.focus();
  });
  $('quadDetailDialog').addEventListener('click', event => {
    if (event.target !== $('quadDetailDialog')) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  });
  document.addEventListener('keydown', event => {
    if (!$('quadDetailDialog').open || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); stepDetail(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); stepDetail(1); }
  });
  render();
})();
