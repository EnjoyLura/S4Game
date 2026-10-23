(() => {
  'use strict';
  const data = window.MONSTER_CATALOG;
  const $ = id => document.getElementById(id);
  if (!data || !Array.isArray(data.monsters)) {
    $('resultsCount').textContent = '图鉴数据未加载，请保持 HTML 与旁边的文件夹一起打开。';
    return;
  }
  const KEY = 'kingdomwatch.monster-art-selection.v1';
  const byId = new Map(data.monsters.map(m => [m.id, m]));
  const sourceById = new Map(data.sources.map(s => [s.id, s]));
  const chapterById = new Map(data.chapters.map(c => [String(c.number), c.name]));
  const reviewSets = (data.reviewSets || []).filter(set => set && Array.isArray(set.ids));
  const reviewSetById = new Map(reviewSets.map(set => [set.id, set]));
  const appliedReviewSets = new Set();
  const roles = new Set(['', '普通怪', '精英怪', '关底 Boss']);
  const statuses = new Map([['active','候选区'],['archived','已归档'],['deleted','回收站']]);
  let choices = Object.create(null);
  let filters = { search: '', source: '', theme: '', selected: false, status: 'active', reviewSet: '' };
  let filtered = [];
  let managing = false;
  const checked = new Set();
  let activeId = null;
  let detailIds = [];
  let toastTimer;
  let saveNoticeShown = false;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const chapterName = value => chapterById.has(String(value)) ? `第${value}章 · ${chapterById.get(String(value))}` : '暂未分配章节';
  const blankChoice = () => ({ selected: false, chapter: '', role: '', note: '', status: 'active', trashFrom: 'active' });
  const choiceFor = id => choices[id] || blankChoice();
  const selectedItems = () => data.monsters.filter(m => choices[m.id]?.selected && choiceFor(m.id).status === 'active');
  function normalizeChoices(raw) {
    const result = Object.create(null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
    for (const [id, value] of Object.entries(raw)) {
      if (!byId.has(id) || !value || typeof value !== 'object') continue;
      result[id] = {
        selected: value.selected === true,
        chapter: chapterById.has(String(value.chapter)) ? String(value.chapter) : '',
        role: roles.has(value.role) ? value.role : '',
        note: typeof value.note === 'string' ? value.note.slice(0, 5000) : '',
        status: statuses.has(value.status) ? value.status : 'active',
        trashFrom: value.trashFrom === 'archived' ? 'archived' : 'active'
      };
    }
    return result;
  }
  function toast(message, undo) {
    const node = $('toast');
    placeToast();
    clearTimeout(toastTimer);
    node.replaceChildren(document.createTextNode(message));
    if (undo) {
      const button = document.createElement('button');
      button.textContent = '撤销';
      button.onclick = () => { undo(); node.hidden = true; };
      node.appendChild(button);
    }
    node.hidden = false;
    toastTimer = setTimeout(() => { node.hidden = true; }, undo ? 10000 : 4000);
  }
  function placeToast() {
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    const parent = dialogs[dialogs.length-1] || document.body;
    if ($('toast').parentNode !== parent) parent.appendChild($('toast'));
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({version: 2, choices, filters, appliedReviewSets: [...appliedReviewSets]})); }
    catch (_) {
      if (!saveNoticeShown) { saveNoticeShown = true; toast('当前浏览器无法自动保存，请用「导出整理备份」保留记录。'); }
    }
  }
  try {
    const restored = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (restored) {
      choices = normalizeChoices(restored.choices);
      for (const id of Array.isArray(restored.appliedReviewSets) ? restored.appliedReviewSets : []) {
        if (reviewSetById.has(id)) appliedReviewSets.add(id);
      }
      if (restored.filters) {
        filters.search = String(restored.filters.search || '').slice(0, 200);
        filters.source = sourceById.has(restored.filters.source) ? restored.filters.source : '';
        filters.theme = data.sources.some(s => s.theme === restored.filters.theme) ? restored.filters.theme : '';
        filters.selected = restored.filters.selected === true;
        filters.status = statuses.has(restored.filters.status) ? restored.filters.status : 'active';
        filters.reviewSet = reviewSetById.has(restored.filters.reviewSet) ? restored.filters.reviewSet : '';
      }
    }
  } catch (_) { /* A corrupt or inaccessible storage entry never prevents opening the catalogue. */ }
  // Import each explicit chat selection once; later deselection/archival stays under user control.
  for (const set of reviewSets) {
    if (appliedReviewSets.has(set.id)) continue;
    for (const id of set.ids) {
      if (!byId.has(id)) continue;
      const previous = choiceFor(id);
      choices[id] = {...previous, selected: true, status: 'active', trashFrom: 'active', chapter: previous.chapter || (chapterById.has(set.chapter) ? set.chapter : '')};
    }
    appliedReviewSets.add(set.id);
    filters = {search:'', source:'', theme:'', selected:false, status:'active', reviewSet:set.id};
  }
  function chapterOptions() {
    return '<option value="">暂不分配章节</option>' + data.chapters.map(c => `<option value="${c.number}">第${c.number}章 · ${esc(c.name)}</option>`).join('');
  }
  $('detailChapter').innerHTML = chapterOptions();
  $('bulkChapter').innerHTML = chapterOptions();
  $('sourceCount').textContent = `${data.sources.length} 张独立图集`;
  $('monsterCount').textContent = `${data.monsters.length} 个候选形象`;
  $('sourceFilter').innerHTML += data.sources.map(s => `<option value="${s.id}">${s.id} · ${esc(s.theme)} · ${s.count} 只</option>`).join('');
  $('search').value = filters.search;
  $('sourceFilter').value = filters.source;
  $('onlySelected').checked = filters.selected;
  const themes = [...new Set(data.sources.map(s => s.theme))];
  function renderReviewSets() {
    $('reviewSets').hidden = !reviewSets.length;
    $('reviewSets').innerHTML = [{id:'',label:'全部形象'}, ...reviewSets].map(set =>
      `<button class="theme-pill${filters.reviewSet === set.id ? ' active' : ''}" data-review-set="${esc(set.id)}" aria-pressed="${filters.reviewSet === set.id}">${esc(set.label)}</button>`
    ).join('');
  }
  function renderStatuses() {
    $('statusTabs').innerHTML = [...statuses].map(([value,label]) => {
      const count = data.monsters.filter(m => choiceFor(m.id).status === value).length;
      return `<button class="status-tab${filters.status === value ? ' active' : ''}" data-status="${value}" aria-pressed="${filters.status === value}">${label}<span>${count}</span></button>`;
    }).join('');
    $('onlySelected').disabled = filters.status !== 'active';
    $('onlySelected').checked = filters.selected && filters.status === 'active';
  }
  function renderThemes() {
    $('themes').innerHTML = [{name:'全部', value:''}, ...themes.map(name => ({name, value:name}))].map(t => {
      const count = data.monsters.filter(m => choiceFor(m.id).status === filters.status && (!t.value || m.theme === t.value)).length;
      return `<button class="theme-pill${filters.theme === t.value ? ' active' : ''}" data-theme="${esc(t.value)}" aria-pressed="${filters.theme === t.value}">${esc(t.name)}<span>${count}</span></button>`;
    }).join('');
  }
  function applyFilter() {
    const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const reviewSet = reviewSetById.get(filters.reviewSet);
    const reviewIds = reviewSet ? new Set(reviewSet.ids) : null;
    filtered = data.monsters.filter(m => {
      if (reviewIds && !reviewIds.has(m.id)) return false;
      if (choiceFor(m.id).status !== filters.status) return false;
      if (filters.source && m.source !== filters.source) return false;
      if (filters.theme && m.theme !== filters.theme) return false;
      if (filters.selected && filters.status === 'active' && !choices[m.id]?.selected) return false;
      const source = sourceById.get(m.source);
      const pick = choiceFor(m.id);
      const haystack = [m.id,m.name,m.theme,source.filename,...source.aliases,pick.note,pick.role,pick.chapter ? chapterName(pick.chapter) : ''].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
    if (reviewSet) {
      const order = new Map(reviewSet.ids.map((id,index) => [id,index]));
      filtered.sort((a,b) => order.get(a.id) - order.get(b.id));
    }
    const visibleIds = new Set(filtered.map(m => m.id));
    for (const id of checked) if (!visibleIds.has(id)) checked.delete(id);
  }
  function cardHtml(m) {
    const pick = choiceFor(m.id);
    const selected = pick.selected && pick.status === 'active';
    const actions = pick.status === 'active'
      ? `<button data-action="archived" data-target="${m.id}" title="暂时收起，可在已归档中恢复">归档</button><button class="danger" data-action="deleted" data-target="${m.id}" title="移入回收站，可恢复">删除</button>`
      : `<button data-action="restore" data-target="${m.id}">恢复</button>${pick.status === 'archived' ? `<button class="danger" data-action="deleted" data-target="${m.id}">删除</button>` : ''}`;
    return `<article class="monster-card${selected ? ' is-selected' : ''}${checked.has(m.id) ? ' is-checked' : ''}" data-id="${m.id}">
      <button class="monster-art" data-view="${m.id}" aria-label="放大查看 ${m.id} ${esc(m.name)}"><img src="${m.thumb}" alt="${esc(m.name)}" loading="lazy" decoding="async"><span class="card-id">${m.id}</span>${selected ? '<span class="picked-check">✓</span>' : ''}</button>
      ${managing ? `<label class="manage-check"><input type="checkbox" data-check="${m.id}" ${checked.has(m.id) ? 'checked' : ''} aria-label="勾选整理 ${m.id}"><span>整理</span></label>` : ''}
      <div class="card-info"><h3>${esc(m.name)}</h3><p class="card-source">图集 ${m.source} · 第 ${m.row} 行第 ${m.column} 列</p><div class="card-bottom"><span class="card-chapter" title="${esc(selected ? chapterName(pick.chapter) : m.theme)}">${esc(selected ? (pick.chapter ? `第${pick.chapter}章 · ${chapterById.get(pick.chapter)}` : '已选 · 待分配') : m.theme)}</span>${pick.status === 'active' ? `<button class="pick-button" data-pick="${m.id}" aria-pressed="${selected}">${selected ? '✓ 已选' : '+ 选用'}</button>` : `<span class="status-label">${statuses.get(pick.status)}</span>`}</div><div class="card-management">${actions}</div></div></article>`;
  }
  function renderManagement() {
    $('manageBar').hidden = !managing;
    $('manageToggle').textContent = managing ? '完成整理' : '批量整理';
    $('manageToggle').setAttribute('aria-pressed', String(managing));
    $('manageCount').textContent = `已勾选 ${checked.size} 个`;
    $('checkFiltered').disabled = !filtered.length;
    $('uncheckAll').disabled = !checked.size;
    $('archiveChecked').hidden = filters.status !== 'active';
    $('restoreChecked').hidden = filters.status === 'active';
    $('deleteChecked').hidden = filters.status === 'deleted';
    for (const id of ['archiveChecked','restoreChecked','deleteChecked']) $(id).disabled = !checked.size;
  }
  function renderGrid() {
    applyFilter();
    $('grid').innerHTML = filtered.map(cardHtml).join('');
    $('grid').hidden = !filtered.length;
    $('empty').hidden = !!filtered.length;
    $('resultsCount').textContent = `共 ${filtered.length} 个形象 · 一页显示`;
    $('emptyTitle').textContent = filters.status === 'active' ? '没有符合条件的候选' : filters.status === 'archived' ? '这里暂时没有归档形象' : '回收站里没有符合条件的形象';
    $('emptyHint').textContent = '可以清除当前筛选，或切换候选区、已归档、回收站。';
    renderStatuses(); renderThemes(); renderReviewSets(); renderManagement();
  }
  function renderSelection() {
    const items = selectedItems();
    const scrollTop = $('selectedList').scrollTop;
    $('selectionCount').textContent = items.length;
    $('selectionEmpty').hidden = !!items.length;
    $('selectedList').innerHTML = items.map(m => {
      const pick = choiceFor(m.id);
      return `<div class="selected-item"><button data-selected-view="${m.id}" aria-label="编辑 ${m.id}"><img src="${m.thumb}" alt="" loading="lazy"><span class="selected-summary"><strong>${esc(m.name)}</strong><small>${m.id}${pick.role ? ' · '+esc(pick.role) : ''}</small><span class="chapter-tag">${esc(chapterName(pick.chapter))}${pick.note ? ' · 有备注' : ''}</span></span></button><button class="remove-item" data-remove="${m.id}" aria-label="取消 ${m.id}">×</button></div>`;
    }).join('');
    $('selectedList').scrollTop = scrollTop;
    for (const id of ['copySelection','downloadText','clearSelection','applyChapter']) $(id).disabled = !items.length;
  }
  function refresh() { renderGrid(); renderSelection(); persist(); }
  function setSelected(id, selected) {
    if (!byId.has(id)) return;
    choices[id] = {...choiceFor(id), selected, ...(selected ? {status:'active',trashFrom:'active'} : {})};
    refresh();
    if (activeId === id && $('detailDialog').open) paintDetail();
  }
  function paintDetailSelection() {
    const pick = choiceFor(activeId);
    const selected = pick.selected && pick.status === 'active';
    $('detailSelect').textContent = pick.status !== 'active' ? '恢复到候选区并选用' : selected ? '✓ 已选用 · 点击取消' : '+ 选用这个形象';
    $('detailSelect').setAttribute('aria-pressed', String(selected));
  }
  function changeStatus(ids, action, fromDetail = false) {
    const targets = [...new Set(ids)].filter(id => byId.has(id) && (
      action === 'restore' ? choiceFor(id).status !== 'active' :
      action === 'archived' ? choiceFor(id).status === 'active' :
      action === 'deleted' && choiceFor(id).status !== 'deleted'
    ));
    if (!targets.length) return;
    const before = new Map(targets.map(id => [id,{...choiceFor(id)}]));
    const oldIndex = detailIds.indexOf(activeId);
    const contextStatus = choiceFor(activeId).status;
    for (const id of targets) {
      const current = choiceFor(id);
      const status = action === 'restore'
        ? (current.status === 'deleted' ? current.trashFrom : 'active') : action;
      choices[id] = {...current, status, trashFrom: action === 'deleted' ? current.status : 'active'};
      checked.delete(id);
    }
    refresh();
    if (fromDetail && $('detailDialog').open) {
      const remaining = detailIds.filter(id => choiceFor(id).status === contextStatus);
      if (remaining.length) {
        activeId = remaining[Math.min(Math.max(oldIndex,0),remaining.length-1)];
        detailIds = remaining;
        paintDetail();
      } else $('detailDialog').close();
    }
    const message = action === 'deleted' ? `已将 ${targets.length} 个形象移入回收站。`
      : action === 'archived' ? `已归档 ${targets.length} 个形象。`
      : `已恢复 ${targets.length} 个形象${targets.some(id => choiceFor(id).status === 'archived') ? '（原归档项回到已归档）' : '到候选区'}。`;
    toast(message, () => {
      for (const [id,value] of before) choices[id] = value;
      refresh();
      if ($('detailDialog').open) paintDetail();
    });
  }
  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
  }
  function paintDetail() {
    const m = byId.get(activeId);
    if (!m) return;
    const pick = choiceFor(activeId);
    const index = detailIds.indexOf(activeId);
    $('detailImage').src = m.image;
    $('detailImage').alt = `${m.id} ${m.name}`;
    $('detailTheme').textContent = m.theme;
    $('detailName').textContent = m.name;
    $('detailId').textContent = m.id;
    $('detailOrigin').textContent = `图集 ${m.source} · 第 ${m.row} 行第 ${m.column} 列`;
    $('detailChapter').value = pick.chapter;
    $('detailRole').value = pick.role;
    $('detailNote').value = pick.note;
    for (const id of ['detailChapter','detailRole','detailNote']) $(id).disabled = pick.status !== 'active';
    $('detailStatus').textContent = pick.status === 'active'
      ? '暂时不看的归档，不合格的删除。整理后自动查看下一只。'
      : pick.status === 'archived' ? '已归档 · 恢复后可编辑章节与备注。'
      : `回收站 · 恢复后回到${pick.trashFrom === 'archived' ? '已归档' : '候选区'}，原来的章节和备注保留。`;
    $('detailArchive').hidden = pick.status !== 'active';
    $('detailRestore').hidden = pick.status === 'active';
    $('detailDelete').hidden = pick.status === 'deleted';
    $('openCrop').href = m.image;
    $('detailIndex').textContent = `形象详情 · ${index+1} / ${detailIds.length}`;
    $('prevDetail').disabled = index <= 0;
    $('nextDetail').disabled = index >= detailIds.length-1;
    paintDetailSelection();
  }
  function showDetail(id, context) {
    if (!byId.has(id)) return;
    activeId = id;
    detailIds = context?.includes(id) ? [...context] : filtered.some(m => m.id === id) ? filtered.map(m => m.id) : data.monsters.map(m => m.id);
    paintDetail();
    openDialog($('detailDialog'));
  }
  function stepDetail(direction) {
    const next = detailIds[detailIds.indexOf(activeId)+direction];
    if (next) { activeId = next; paintDetail(); }
  }
  function updateDetail() {
    if (!activeId || choiceFor(activeId).status !== 'active') return;
    choices[activeId] = {...choiceFor(activeId), selected: true, chapter: $('detailChapter').value, role: $('detailRole').value, note: $('detailNote').value.slice(0,5000)};
    paintDetailSelection(); refresh();
  }
  function selectionText() {
    const items = selectedItems();
    if (!items.length) return '';
    const lines = [`我挑选了以下 ${items.length} 个怪物形象，请按这些编号对应的原图讨论章节安排。`, ''];
    for (const chapter of ['',...data.chapters.map(c => String(c.number))]) {
      const group = items.filter(m => choiceFor(m.id).chapter === chapter);
      if (!group.length) continue;
      lines.push(chapter ? chapterName(chapter) : '尚未分配章节');
      for (const m of group) {
        const pick = choiceFor(m.id);
        lines.push(`- ${m.id} ${m.name}${pick.role ? '【'+pick.role+'】' : ''}`);
        if (pick.note.trim()) lines.push('  备注：'+pick.note.trim().replace(/\n/g,'\n  '));
      }
      lines.push('');
    }
    lines.push('图鉴目录：D:/AI/S4Game/KingdomWatch/docs/monster-selection-catalog-v1/',
      '编号对应 monsters/ 下的同名 PNG；catalog.json 记录原图集、源文件名和裁切位置。');
    return lines.join('\n');
  }
  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }
  function download(text, filename, type='text/plain;charset=utf-8') {
    const blob = new Blob([text], {type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function saveText() {
    const text = selectionText();
    if (text) download('\ufeff'+text,`怪物选择清单-${dateStamp()}.txt`);
  }
  async function copySelection() {
    const text = selectionText();
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast(`已复制 ${selectedItems().length} 个形象，粘贴到聊天即可。`);
    } catch (_) {
      $('copyText').value = text;
      $('copyHint').textContent = '本地页面可能无法直接访问剪贴板。下方文字已选中，可按 Ctrl+C 或长按复制。';
      openDialog($('copyDialog'));
      $('copyText').focus(); $('copyText').select();
      try {
        if (document.execCommand('copy')) $('copyHint').textContent = '已复制清单，可以粘贴到聊天。你也可以在这里再次复制或保存。';
      } catch (_) { /* Manual selection remains available. */ }
    }
  }
  $('reviewSets').addEventListener('click', event => {
    const button = event.target.closest('[data-review-set]');
    if (!button || (button.dataset.reviewSet && !reviewSetById.has(button.dataset.reviewSet))) return;
    filters = {search:'',source:'',theme:'',selected:false,status:'active',reviewSet:button.dataset.reviewSet};
    $('search').value=''; $('sourceFilter').value=''; $('onlySelected').checked=false;
    checked.clear(); renderGrid(); persist();
  });
  $('themes').addEventListener('click', event => {
    const button = event.target.closest('[data-theme]'); if (!button) return;
    filters.theme = button.dataset.theme; renderGrid(); persist();
  });
  $('statusTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-status]'); if (!button) return;
    filters.status = button.dataset.status;
    filters.selected = false;
    checked.clear(); renderGrid(); persist();
  });
  $('search').addEventListener('input', () => { filters.search=$('search').value; renderGrid(); persist(); });
  $('sourceFilter').addEventListener('change', () => { filters.source=$('sourceFilter').value; renderGrid(); persist(); });
  $('onlySelected').addEventListener('change', () => { filters.selected=$('onlySelected').checked; renderGrid(); persist(); });
  $('resetFilters').onclick = () => {
    filters={search:'',source:'',theme:'',selected:false,status:filters.status,reviewSet:''};
    $('search').value=''; $('sourceFilter').value=''; $('onlySelected').checked=false;
    renderGrid(); persist();
  };
  $('grid').addEventListener('click', event => {
    const view = event.target.closest('[data-view]');
    if (view) { showDetail(view.dataset.view); return; }
    const pick = event.target.closest('[data-pick]');
    if (pick) { setSelected(pick.dataset.pick, !choiceFor(pick.dataset.pick).selected); return; }
    const action = event.target.closest('[data-action]');
    if (action) changeStatus([action.dataset.target],action.dataset.action);
  });
  $('grid').addEventListener('change', event => {
    const input = event.target.closest('[data-check]'); if (!input) return;
    if (input.checked) checked.add(input.dataset.check); else checked.delete(input.dataset.check);
    input.closest('.monster-card').classList.toggle('is-checked',input.checked);
    renderManagement();
  });
  $('selectedList').addEventListener('click', event => {
    const view=event.target.closest('[data-selected-view]');
    if (view) { showDetail(view.dataset.selectedView, selectedItems().map(m=>m.id)); return; }
    const remove=event.target.closest('[data-remove]');
    if (remove) setSelected(remove.dataset.remove,false);
  });
  function toggleManagement() {
    managing = !managing;
    checked.clear(); renderGrid();
  }
  $('manageToggle').onclick = toggleManagement;
  $('finishManage').onclick = toggleManagement;
  $('checkFiltered').onclick = () => {
    for (const m of filtered) checked.add(m.id);
    renderGrid();
  };
  $('uncheckAll').onclick = () => {checked.clear(); renderGrid();};
  $('archiveChecked').onclick = () => changeStatus([...checked],'archived');
  $('restoreChecked').onclick = () => changeStatus([...checked],'restore');
  $('deleteChecked').onclick = () => changeStatus([...checked],'deleted');
  $('applyChapter').onclick = () => {
    const items = selectedItems(); if (!items.length) return;
    for (const m of items) choices[m.id].chapter = $('bulkChapter').value;
    refresh(); toast(`已为 ${items.length} 个所选形象设置章节。`);
  };
  $('clearSelection').onclick = () => {
    const previous = JSON.stringify(choices);
    for (const m of selectedItems()) choices[m.id].selected=false;
    refresh(); toast('已清空勾选，章节与备注仍保留。', () => { choices=normalizeChoices(JSON.parse(previous)); refresh(); });
  };
  $('detailSelect').onclick=()=>setSelected(activeId,choiceFor(activeId).status !== 'active' || !choiceFor(activeId).selected);
  $('detailArchive').onclick=()=>changeStatus([activeId],'archived',true);
  $('detailRestore').onclick=()=>changeStatus([activeId],'restore',true);
  $('detailDelete').onclick=()=>changeStatus([activeId],'deleted',true);
  $('detailChapter').onchange=updateDetail; $('detailRole').onchange=updateDetail;
  $('detailNote').oninput=updateDetail;
  $('prevDetail').onclick=()=>stepDetail(-1); $('nextDetail').onclick=()=>stepDetail(1);
  $('closeDetail').onclick=()=>$('detailDialog').close();
  $('closeSource').onclick=()=>$('sourceDialog').close();
  $('closeCopy').onclick=()=>$('copyDialog').close();
  $('viewSource').onclick=()=>{
    const m=byId.get(activeId), source=sourceById.get(m.source);
    $('sourceTitle').textContent=`原图集 ${source.id} · ${source.theme}`;
    $('sourceFilename').textContent=source.filename+(source.aliases.length ? `（另有 ${source.aliases.length} 张同图文件）` : '');
    $('sourceImage').src=source.path;
    const [x0,y0,x1,y1]=m.box;
    Object.assign($('cropHighlight').style,{left:(x0/source.width*100)+'%',top:(y0/source.height*100)+'%',width:((x1-x0)/source.width*100)+'%',height:((y1-y0)/source.height*100)+'%'});
    openDialog($('sourceDialog'));
  };
  for (const dialog of [$('detailDialog'),$('sourceDialog'),$('copyDialog')]) {
    dialog.addEventListener('click', event => {
      if (event.target!==dialog) return;
      const r=dialog.getBoundingClientRect();
      if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close();
    });
    dialog.addEventListener('close',()=>{
      placeToast();
      if (![...document.querySelectorAll('dialog')].some(d=>d.open)) document.body.classList.remove('modal-open');
    });
  }
  document.addEventListener('keydown',event=>{
    if (!$('detailDialog').open||$('sourceDialog').open||$('copyDialog').open) return;
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.key==='ArrowLeft') {event.preventDefault();stepDetail(-1);}
    if (event.key==='ArrowRight') {event.preventDefault();stepDetail(1);}
  });
  $('copySelection').onclick=copySelection; $('downloadText').onclick=saveText; $('saveCopyText').onclick=saveText;
  $('retryCopy').onclick=async()=>{
    const text=$('copyText').value;
    try { await navigator.clipboard.writeText(text); $('copyHint').textContent='已复制，可以粘贴到聊天。'; }
    catch (_) {
      $('copyText').focus(); $('copyText').select();
      let ok=false; try {ok=document.execCommand('copy');} catch (_) {}
      $('copyHint').textContent=ok?'已复制，可以粘贴到聊天。':'请按 Ctrl+C，或长按已选中的文字复制。';
    }
  };
  $('exportBackup').onclick=()=>{
    const backup={kind:'kingdomwatch-monster-selection',version:2,exportedAt:new Date().toISOString(),choices,appliedReviewSets:[...appliedReviewSets],
      selections:selectedItems().map(m=>({...m,...choiceFor(m.id),originalSource:sourceById.get(m.source).original}))};
    download(JSON.stringify(backup,null,2),`怪物整理备份-${dateStamp()}.json`,'application/json;charset=utf-8');
    toast('整理备份已导出，包含选择、章节、备注、归档和回收站记录。');
  };
  $('importBackup').onclick=()=>$('importFile').click();
  $('importFile').onchange=async()=>{
    const file=$('importFile').files[0]; if (!file) return;
    try {
      if (file.size>10*1024*1024) throw new Error('备份文件过大');
      const imported=JSON.parse(await file.text());
      if (imported.kind!=='kingdomwatch-monster-selection'||![1,2].includes(imported.version)||!imported.choices) throw new Error('请选择本图鉴导出的 JSON 备份');
      const previous=JSON.stringify(choices);
      choices=normalizeChoices(imported.choices); checked.clear(); refresh();
      toast(`已导入整理记录，当前选用 ${selectedItems().length} 个形象。`,()=>{choices=normalizeChoices(JSON.parse(previous));refresh();});
    } catch(error) {toast('导入失败：'+error.message);}
    finally {$('importFile').value='';}
  };
  renderGrid(); renderSelection(); persist();
})();
