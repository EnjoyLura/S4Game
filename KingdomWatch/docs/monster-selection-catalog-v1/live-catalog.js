(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const candidates = window.MONSTER_CATALOG;
  const data = window.LIVE_MONSTER_CATALOG;
  const KEY = 'kingdomwatch.monster-art-selection.v1.live-view';
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state = {view:'live', chapter:'', search:''};
  const byId = new Map((data?.monsters || []).map(m => [m.id, m]));
  const chapters = data?.chapters || [];
  const chapterById = new Map(chapters.map(c => [String(c.number),c]));
  const kindNames = {melee:'近战', ranged:'远程', heal:'治疗支援'};
  let visibleGroups = [];
  let detailIds = [];
  let activeId = '';
  let activePhase = false;

  try {
    const restored = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (restored?.view === 'candidate') state.view = 'candidate';
    if (chapterById.has(String(restored?.chapter))) state.chapter = String(restored.chapter);
  } catch (_) { /* Browsing remains available without local storage. */ }

  function persistView() {
    try { localStorage.setItem(KEY, JSON.stringify({view:state.view,chapter:state.chapter})); }
    catch (_) { /* Candidate choices continue to use their original storage entry. */ }
  }
  function chapterName(number) {
    const chapter = chapterById.get(String(number));
    return chapter ? `第${number}章 · ${chapter.name}` : `第${number}章`;
  }
  function setView(view) {
    state.view = view === 'candidate' ? 'candidate' : 'live';
    const live = state.view === 'live';
    $('candidatePanel').hidden = live;
    $('livePanel').hidden = !live;
    $('candidateBackupActions').hidden = live;
    for (const button of $('catalogViews').querySelectorAll('[data-catalog-view]')) {
      const selected = button.dataset.catalogView === state.view;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    $('introTitle').textContent = live ? '查看游戏各章正在使用的怪物。' : '挑选你想放进游戏的怪物。';
    $('introDescription').textContent = live
      ? '按章节查看现用形象，点击查看大图、兵种定位与章节归属。'
      : '全部形象在一页连续浏览。暂时不看的归档，不合格的删除；已归档和回收站都能恢复。';
    $('sourceCount').textContent = live ? `${chapters.length} 个实际使用章节` : `${candidates?.sources?.length || 0} 张独立图集`;
    $('monsterCount').textContent = live ? `${byId.size} 种现用怪物` : `${candidates?.monsters?.length || 0} 个候选形象`;
    persistView();
  }
  function badges(m) {
    const roleClass = m.role === '关底 Boss' ? ' boss' : m.role === '精英怪' ? ' elite' : '';
    return `<span class="live-badge${roleClass}">${esc(m.role)}</span>`
      + `<span class="live-badge">${esc(kindNames[m.kind] || m.kind)}</span>`
      + (m.airborne ? '<span class="live-badge">飞行</span>' : '')
      + (m.animation ? `<span class="live-badge animated">序列帧 · ${m.animation.frames} 帧</span>` : '');
  }
  function renderChapters() {
    $('liveChapters').innerHTML = [{number:'',name:'全部章节',ids:[...byId.keys()]}, ...chapters].map(chapter => {
      const number = String(chapter.number);
      return `<button class="live-chapter-tab" data-live-chapter="${number}" aria-pressed="${state.chapter === number}">${chapter.number ? esc(chapterName(chapter.number)) : '全部章节'}<span>${chapter.ids.length}</span></button>`;
    }).join('');
  }
  function matches(m, terms) {
    const text = [m.id,m.name,m.role,kindNames[m.kind],m.description,...m.traits,
      ...m.chapters.map(chapterName),m.animation ? '序列帧 动画' : '静态立绘',m.airborne ? '飞行' : ''].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  }
  function cardHtml(m) {
    return `<article class="monster-card live-card" data-live-id="${esc(m.id)}">
      <button class="monster-art" data-live-view="${esc(m.id)}" aria-label="查看现用怪物 ${esc(m.name)}"><img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" decoding="async"><span class="live-in-use">游戏实际使用</span></button>
      <div class="card-info"><h3>${esc(m.name)}</h3><code class="live-game-id">${esc(m.id)}</code><div class="live-badges">${badges(m)}</div><div class="live-card-bottom"><span class="muted">${m.animation ? '当前行走形象' : '当前立绘'}${m.phase ? ' · 含强化形态' : ''}</span><button class="pick-button" data-live-view="${esc(m.id)}">查看大图</button></div></div>
    </article>`;
  }
  function render() {
    const terms = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    visibleGroups = chapters.filter(c => !state.chapter || String(c.number) === state.chapter).map(chapter => ({
      chapter, monsters:chapter.ids.map(id => byId.get(id)).filter(m => m && matches(m, terms))
    })).filter(group => group.monsters.length);
    $('liveSections').innerHTML = visibleGroups.map(({chapter,monsters}) => {
      const bosses = monsters.filter(m => m.role === '关底 Boss').length;
      const elites = monsters.filter(m => m.role === '精英怪').length;
      const animated = monsters.filter(m => m.animation).length;
      const summary = [`${monsters.length} 种怪物`,bosses ? `${bosses} 个 Boss` : '',elites ? `${elites} 种精英` : '',animated ? `${animated} 套序列帧` : ''].filter(Boolean).join(' · ');
      return `<section class="live-chapter-section" aria-labelledby="liveChapter${chapter.number}"><div class="live-section-heading"><div><h3 id="liveChapter${chapter.number}">${esc(chapterName(chapter.number))}</h3><span class="muted">${summary}</span></div><button class="button small" data-copy-live-chapter="${chapter.number}">复制本章清单</button></div><div class="grid live-grid">${monsters.map(cardHtml).join('')}</div></section>`;
    }).join('');
    const uniqueIds = new Set(visibleGroups.flatMap(group => group.monsters.map(m => m.id)));
    $('liveResults').textContent = `当前显示 ${visibleGroups.length} 个章节 · ${uniqueIds.size} 种怪物 · 一页连续显示`;
    $('liveEmpty').hidden = uniqueIds.size > 0;
    $('copyLiveRoster').disabled = uniqueIds.size === 0;
    renderChapters();
  }
  function closeModalBody() {
    if (![...document.querySelectorAll('dialog')].some(dialog => dialog.open)) document.body.classList.remove('modal-open');
  }
  function paintArt() {
    const m = byId.get(activeId);
    const art = activePhase && m.phase ? m.phase : m;
    $('liveDetailImage').src = art.image;
    $('liveDetailImage').alt = `${m.name}${activePhase ? ' · 强化形态' : ''}`;
    $('openLiveCrop').href = art.image;
    $('liveArtVariants').hidden = !m.phase;
    $('liveArtVariants').innerHTML = m.phase
      ? `<button class="button small" data-live-phase="base" aria-pressed="${!activePhase}">常态</button><button class="button small" data-live-phase="phase" aria-pressed="${activePhase}">强化形态</button>` : '';
  }
  function paintDetail() {
    const m = byId.get(activeId);
    if (!m) return;
    activePhase = false;
    const index = detailIds.indexOf(activeId);
    $('liveDetailIndex').textContent = `实际使用详情 · ${index + 1} / ${detailIds.length}`;
    $('liveDetailName').textContent = m.name;
    $('liveDetailId').textContent = m.id;
    $('liveDetailChapter').textContent = m.chapters.map(chapterName).join(' / ');
    $('liveDetailBadges').innerHTML = badges(m);
    $('liveDetailDescription').textContent = m.description || (m.kind === 'heal' ? '为附近伤员提供治疗支援。' : m.kind === 'ranged' ? '从远处攻击防线。' : '向防线推进并发动近战攻击。');
    $('liveDetailTraits').innerHTML = m.traits.map(text => `<li>${esc(text)}</li>`).join('');
    $('liveDetailTraits').hidden = !m.traits.length;
    $('liveDetailAnimation').textContent = m.animation
      ? `已使用 ${m.animation.frames} 帧行走序列，当前展示该序列的首帧。`
      : '当前展示游戏使用的立绘。';
    $('prevLiveDetail').disabled = index <= 0;
    $('nextLiveDetail').disabled = index >= detailIds.length - 1;
    paintArt();
  }
  function showDetail(id) {
    if (!byId.has(id)) return;
    activeId = id;
    detailIds = [...new Set(visibleGroups.flatMap(group => group.monsters.map(m => m.id)))];
    if (!detailIds.includes(id)) detailIds = [...byId.keys()];
    paintDetail();
    if (!$('liveDetailDialog').open) $('liveDetailDialog').showModal();
    document.body.classList.add('modal-open');
  }
  function stepDetail(direction) {
    const next = detailIds[detailIds.indexOf(activeId) + direction];
    if (next) { activeId = next; paintDetail(); }
  }
  function rosterText(number) {
    const groups = number ? visibleGroups.filter(group => String(group.chapter.number) === String(number)) : visibleGroups;
    const lines = ['Kingdom Watch · 游戏实际使用怪物清单', ''];
    for (const {chapter,monsters} of groups) {
      lines.push(chapterName(chapter.number));
      for (const m of monsters) {
        lines.push(`- ${m.id} ${m.name}【${m.role} · ${kindNames[m.kind]}${m.airborne ? ' · 飞行' : ''}】`);
        lines.push(`  现用图片：${m.image}`);
      }
      lines.push('');
    }
    lines.push('图鉴目录：D:/AI/S4Game/KingdomWatch/docs/monster-selection-catalog-v1/');
    return lines.join('\n');
  }
  async function copyRoster(number) {
    const text = rosterText(number);
    $('liveCopyText').value = text;
    $('liveCopyPanel').hidden = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      $('liveCopyHint').textContent = '已复制，可以粘贴到聊天。';
    } catch (_) {
      $('liveCopyText').focus();
      $('liveCopyText').select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { /* Manual copy stays available. */ }
      $('liveCopyHint').textContent = copied ? '已复制，可以粘贴到聊天。' : '请在下方按 Ctrl+C 或长按复制，也可以保存为 TXT。';
    }
  }

  $('catalogViews').addEventListener('click', event => {
    const button = event.target.closest('[data-catalog-view]');
    if (button) setView(button.dataset.catalogView);
  });
  $('catalogViews').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const view = event.key === 'Home' ? 'live' : event.key === 'End' ? 'candidate' : state.view === 'live' ? 'candidate' : 'live';
    setView(view);
    $(view === 'live' ? 'liveTab' : 'candidateTab').focus();
  });
  $('liveChapters').addEventListener('click', event => {
    const button = event.target.closest('[data-live-chapter]');
    if (!button) return;
    state.chapter = button.dataset.liveChapter;
    state.search = '';
    $('liveSearch').value = '';
    $('liveCopyPanel').hidden = true;
    render(); persistView();
  });
  $('liveSearch').addEventListener('input', () => { state.search = $('liveSearch').value; render(); });
  $('resetLiveFilters').onclick = () => {
    state.chapter = ''; state.search = ''; $('liveSearch').value = '';
    $('liveCopyPanel').hidden = true;
    render(); persistView();
  };
  $('liveSections').addEventListener('click', event => {
    const view = event.target.closest('[data-live-view]');
    if (view) { showDetail(view.dataset.liveView); return; }
    const copy = event.target.closest('[data-copy-live-chapter]');
    if (copy) copyRoster(copy.dataset.copyLiveChapter);
  });
  $('copyLiveRoster').onclick = () => copyRoster();
  $('closeLiveCopy').onclick = () => { $('liveCopyPanel').hidden = true; };
  $('saveLiveRoster').onclick = () => {
    const url = URL.createObjectURL(new Blob(['\ufeff' + $('liveCopyText').value], {type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url; link.download = '游戏实际使用怪物清单.txt';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('closeLiveDetail').onclick = () => $('liveDetailDialog').close();
  $('prevLiveDetail').onclick = () => stepDetail(-1);
  $('nextLiveDetail').onclick = () => stepDetail(1);
  $('liveArtVariants').addEventListener('click', event => {
    const button = event.target.closest('[data-live-phase]');
    if (button) { activePhase = button.dataset.livePhase === 'phase'; paintArt(); }
  });
  $('liveDetailDialog').addEventListener('close', closeModalBody);
  $('liveDetailDialog').addEventListener('click', event => {
    if (event.target !== $('liveDetailDialog')) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  });
  document.addEventListener('keydown', event => {
    if (!$('liveDetailDialog').open || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); stepDetail(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); stepDetail(1); }
  });
  $('candidateTabCount').textContent = candidates?.monsters?.length || 0;
  $('liveTabCount').textContent = byId.size;
  if (!data || !Array.isArray(data.monsters) || !Array.isArray(data.chapters)) {
    $('liveSummary').textContent = '现用怪物数据未加载，请保持 HTML 与旁边的文件一起打开。';
    $('copyLiveRoster').disabled = true;
  } else {
    $('liveSummary').textContent = `${chapters.length} 章 · ${byId.size} 种怪物 · ${data.counts.animated} 套序列帧`;
    render();
  }
  setView(state.view);
})();
