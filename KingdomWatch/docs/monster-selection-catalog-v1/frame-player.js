(() => {
  'use strict';
  const data = window.MONSTER_ANIMATION_CATALOG || {atlases:{},clips:{}};
  const imageCache = new Map();
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let playerCount = 0;

  function loadImage(path) {
    if (imageCache.has(path)) return imageCache.get(path);
    const pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片未能加载，请保持图鉴目录完整。'));
      image.src = path;
    });
    imageCache.set(path, pending);
    pending.catch(() => { if (imageCache.get(path) === pending) imageCache.delete(path); });
    // At most two decoded sheets are retained; active players keep their own reference.
    while (imageCache.size > 2) imageCache.delete(imageCache.keys().next().value);
    return pending;
  }

  function mount(root, actors, {autoplay = false} = {}) {
    const playerId = `motionPlayer${++playerCount}`;
    let destroyed = false, ready = false, playing = false, elapsed = 0, speed = 1;
    let raf = 0, lastTime = 0;
    const slots = actors.map(actor => ({...actor, clip:data.clips[actor.id] || null, image:null, index:-1}));
    const reference = slots.find(slot => slot.clip);
    root.classList.add('frame-player');
    root.innerHTML = `<div class="motion-stage${actors.length > 1 ? ' is-quad' : ''}">${slots.map(slot => `<div class="motion-cell"><canvas width="${slot.clip?.width || 320}" height="${slot.clip?.height || 320}" role="img" aria-label="${esc(slot.name)}${slot.clip ? '已接入序列帧' : '静态形象'}"></canvas><div class="motion-cell-caption"><strong>${esc(slot.position ? slot.position + ' · ' + slot.name : slot.name)}</strong><span data-frame-caption>${slot.clip ? '正在加载…' : '未接入 · 静态'}</span></div></div>`).join('')}</div>
      <div class="motion-controls"><button class="button small primary" data-motion="play" disabled aria-pressed="false">播放</button><button class="button small" data-motion="reset" disabled>回到首帧</button><label for="${playerId}Speed">速度 <select id="${playerId}Speed" data-motion-speed><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1× 默认</option><option value="2">2×</option></select></label></div>
      ${actors.length === 1 && reference ? `<div class="motion-progress"><input type="range" min="0" max="${reference.clip.frames.length - 1}" value="0" step="1" data-motion-seek aria-label="逐帧定位"><output data-motion-position>1 / ${reference.clip.frames.length}</output></div><div class="motion-frame-step"><button class="button small" data-motion="previous" disabled>← 上一帧</button><button class="button small" data-motion="next" disabled>下一帧 →</button></div>` : ''}
      <p class="motion-status" data-motion-status role="status">正在读取游戏已接入的序列帧…</p>`;
    const canvases = root.querySelectorAll('canvas');
    const captions = root.querySelectorAll('[data-frame-caption]');
    const playButton = root.querySelector('[data-motion="play"]');
    const status = root.querySelector('[data-motion-status]');
    const seek = root.querySelector('[data-motion-seek]');
    const position = root.querySelector('[data-motion-position]');
    const buttons = root.querySelectorAll('[data-motion]');
    slots.forEach((slot, index) => { slot.canvas = canvases[index]; slot.context = canvases[index].getContext('2d'); slot.caption = captions[index]; });

    function draw(force = false) {
      if (!ready || destroyed) return;
      for (const slot of slots) {
        const clip = slot.clip;
        const index = clip ? Math.floor(elapsed / clip.effectiveCycleSeconds * clip.frames.length + 1e-7) % clip.frames.length : 0;
        if (!force && index === slot.index) continue;
        slot.index = index;
        const {canvas,context,image} = slot;
        context.clearRect(0,0,canvas.width,canvas.height);
        const rect = clip ? clip.frames[index] : slot.fallbackRect || [0,0,image.naturalWidth,image.naturalHeight];
        const [x,y,width,height] = rect;
        const scale = Math.min(canvas.width / width, canvas.height / height);
        const targetWidth = width * scale, targetHeight = height * scale;
        // Fixed source rectangles and canvas; no per-frame centering, scaling, blending or extra movement.
        context.drawImage(image,x,y,width,height,(canvas.width - targetWidth) / 2,(canvas.height - targetHeight) / 2,targetWidth,targetHeight);
        slot.caption.textContent = clip ? `${index + 1} / ${clip.frames.length} 帧` : '未接入 · 静态';
      }
      if (seek) { seek.value = reference.index; position.textContent = `${reference.index + 1} / ${reference.clip.frames.length}`; }
    }
    function tick(time) {
      if (!playing || destroyed) return;
      if (document.hidden || !root.isConnected) { pause(); return; }
      elapsed += Math.min((time - lastTime) / 1000, 0.1) * speed;
      lastTime = time;
      draw();
      raf = requestAnimationFrame(tick);
    }
    function pause() {
      playing = false; cancelAnimationFrame(raf); raf = 0;
      playButton.textContent = '播放'; playButton.setAttribute('aria-pressed','false');
    }
    function play() {
      if (!ready || destroyed || playing || !reference) return;
      playing = true; lastTime = performance.now();
      playButton.textContent = '暂停'; playButton.setAttribute('aria-pressed','true');
      raf = requestAnimationFrame(tick);
    }
    function onClick(event) {
      const action = event.target.closest('[data-motion]')?.dataset.motion;
      if (!ready || !action) return;
      if (action === 'play') { if (playing) pause(); else play(); }
      else if (action === 'reset') { elapsed = 0; lastTime = performance.now(); draw(true); }
      else if (reference && (action === 'previous' || action === 'next')) {
        pause();
        const count = reference.clip.frames.length;
        const index = (reference.index + (action === 'next' ? 1 : -1) + count) % count;
        elapsed = index / count * reference.clip.effectiveCycleSeconds;
        draw(true);
      }
    }
    function onChange(event) {
      if (event.target.matches('[data-motion-speed]')) { speed = Number(event.target.value); lastTime = performance.now(); }
    }
    function onSeek() {
      pause();
      elapsed = Number(seek.value) / reference.clip.frames.length * reference.clip.effectiveCycleSeconds;
      draw(true);
    }
    function onVisibility() { if (document.hidden) pause(); }
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    seek?.addEventListener('input', onSeek);
    document.addEventListener('visibilitychange', onVisibility);
    Promise.all(slots.map(async slot => {
      const path = slot.clip ? data.atlases[slot.clip.atlas]?.image : slot.fallbackImage;
      if (!path) throw new Error('缺少对应的序列帧或静态原图。');
      slot.image = await loadImage(path);
    })).then(() => {
      if (destroyed) return;
      ready = true;
      for (const button of buttons) button.disabled = !reference;
      const halfSpeed = slots.some(slot => slot.clip?.playbackRate === 0.5);
      status.textContent = `${slots.filter(slot => slot.clip).length > 1 ? '各怪物按各自周期播放。' : '正向循环播放。'}1× 为游戏默认行走节奏${halfSpeed ? '，已包含第一章半速设置' : ''}。`;
      draw(true);
      if (autoplay) play();
    }).catch(error => {
      if (!destroyed) { pause(); status.textContent = error.message; }
    });
    return {pause, destroy() {
      if (destroyed) return;
      pause(); destroyed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      seek?.removeEventListener('input', onSeek);
      document.removeEventListener('visibilitychange', onVisibility);
      root.replaceChildren();
      for (const slot of slots) slot.image = null;
    }};
  }
  window.MonsterFramePlayer = {mount, hasClip:id => Boolean(data.clips[id])};
})();
