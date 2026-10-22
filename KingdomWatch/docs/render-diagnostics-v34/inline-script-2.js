
(function () {
  // A fixed path also activates the report if a browser drops the query string.
  if (!/(?:[?&])renderdiag=1(?:&|$)/.test(location.search)
      && !/\/diagnostics\.html$/.test(location.pathname)) return;
  var panel = document.getElementById('kwRenderPanel');
  var data = document.getElementById('kwDiagData');
  var summary = document.getElementById('kwDiagSummary');
  var status = document.getElementById('kwDiagStatus');
  var body = document.getElementById('kwDiagBody');
  var mode = '未标记';
  var recentErrors = [];
  function number(n) { return Math.round(n * 1000) / 1000; }
  function rect(r) { return [number(r.x), number(r.y), number(r.width), number(r.height)]; }
  function readBrowser() {
    var canvas = document.getElementById('GameCanvas');
    var bounds = canvas && canvas.getBoundingClientRect();
    var vv = window.visualViewport;
    var css = getComputedStyle(document.documentElement);
    var dpr = window.devicePixelRatio || 1;
    var scale = vv && vv.scale || 1;
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    var result = {
      report: 'kw-render-diagnostics-v34', capturedAt: new Date().toISOString(), mode: mode,
      path: location.pathname, query: location.search, bootstrap: 'static-html-before-engine',
      browser: {
        userAgent: navigator.userAgent, devicePixelRatio: dpr, dprCap: window.__KW_DPR_CAP,
        innerCss: [innerWidth, innerHeight], outerCss: [outerWidth, outerHeight],
        screenCss: [window.screen.width, window.screen.height],
        documentCss: [document.documentElement.clientWidth, document.documentElement.clientHeight],
        visualViewport: vv ? { width: number(vv.width), height: number(vv.height), scale: number(vv.scale), offsetLeft: number(vv.offsetLeft), offsetTop: number(vv.offsetTop) } : null,
        viewportMeta: document.querySelector('meta[name="viewport"]').getAttribute('content'),
        safeCss: ['top', 'right', 'bottom', 'left'].map(function (e) { return css.getPropertyValue('--safe-' + e).trim(); }),
        fullscreenElement: fs ? fs.tagName + '#' + fs.id : null
      },
      canvas: canvas && bounds ? {
        backingPixels: [canvas.width, canvas.height], cssRect: rect(bounds),
        pixelRatio: [number(canvas.width / bounds.width), number(canvas.height / bounds.height)],
        estimatedDisplayPixels: [number(bounds.width * dpr * scale), number(bounds.height * dpr * scale)],
        estimatedBackingToDisplay: [number(canvas.width / (bounds.width * dpr * scale)), number(canvas.height / (bounds.height * dpr * scale))],
        transform: getComputedStyle(canvas).transform,
        ancestors: [canvas.parentElement, canvas.parentElement && canvas.parentElement.parentElement].filter(Boolean).map(function (el) {
          var style = getComputedStyle(el);
          return { id: el.id, cssRect: rect(el.getBoundingClientRect()), transform: style.transform, zoom: style.getPropertyValue('zoom') };
        })
      } : null,
      engineStatus: '未收到引擎数据，基础数据仍可复制', recentErrors: recentErrors.slice()
    };
    if (typeof window.__kwCollectRenderDiagnostics === 'function') {
      try {
        var engine = window.__kwCollectRenderDiagnostics(mode);
        result.engine = engine.engine; result.graphics = engine.graphics; result.labels = engine.labels;
        result.engineStatus = '已连接';
      } catch (error) { result.engineStatus = '读取失败：' + String(error); }
    }
    return result;
  }
  function fit() {
    var vv = window.visualViewport;
    var scale = vv && vv.scale || 1;
    var width = (vv ? vv.width : innerWidth) * scale;
    var height = (vv ? vv.height : innerHeight) * scale;
    // Only the diagnostic panel counteracts page zoom; no game dimensions change.
    panel.style.setProperty('display', 'block', 'important');
    panel.style.width = Math.max(180, Math.min(420, width - 20)) + 'px';
    panel.style.maxHeight = height * .72 + 'px';
    panel.style.left = ((vv ? vv.offsetLeft : 0) + 10 / scale) + 'px';
    panel.style.top = ((vv ? vv.offsetTop : 0) + Math.min(110, height * .18) / scale) + 'px';
    panel.style.transform = 'scale(' + 1 / scale + ')';
  }
  function refresh() {
    try {
      fit();
      var r = readBrowser();
      summary.textContent = 'HTML 面板 v34 已启动 / 引擎：' + r.engineStatus
        + '\n浏览器 DPR ' + r.browser.devicePixelRatio + ' / 引擎 DPR ' + (r.engine ? r.engine.devicePixelRatio : '待连接')
        + '\n画布 ' + (r.canvas ? r.canvas.backingPixels.join(' × ') : '未就绪') + ' px'
        + '\n显示 ' + (r.canvas ? r.canvas.cssRect.slice(2).join(' × ') : '未就绪') + ' CSS px'
        + '\n页面缩放 ' + (r.browser.visualViewport ? r.browser.visualViewport.scale : 1)
        + ' / 顶部安全区 ' + (r.browser.safeCss[0] || '未报告');
      data.value = JSON.stringify(r, null, 2);
      return true;
    } catch (error) { status.textContent = '诊断读取失败：' + String(error); return false; }
  }
  function fallbackCopy() {
    data.style.display = 'block';
    data.focus(); data.select(); data.setSelectionRange(0, data.value.length);
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (ignored) {}
    status.textContent = copied ? '已复制' + mode + '数据，请粘贴到聊天。' : '请长按下方文本框，全选并复制；也可直接截取面板。';
  }
  function copy(nextMode) {
    mode = nextMode;
    if (!refresh()) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(data.value).then(function () {
          status.textContent = '已复制' + mode + '数据，请粘贴到聊天。';
        }, fallbackCopy);
      } catch (error) { fallbackCopy(); }
    } else { fallbackCopy(); }
  }
  document.getElementById('kwDiagMobile').onclick = function () { copy('手机模式'); };
  document.getElementById('kwDiagDesktop').onclick = function () { copy('电脑模式'); };
  document.getElementById('kwDiagRefresh').onclick = refresh;
  document.getElementById('kwDiagDetails').onclick = function () { refresh(); data.style.display = data.style.display === 'none' ? 'block' : 'none'; };
  document.getElementById('kwDiagToggle').onclick = function () {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
    this.textContent = body.style.display === 'none' ? '展开诊断' : '收起';
    if (body.style.display !== 'none') refresh();
  };
  // Keep panel gestures out of the underlying game's input handlers.
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'].forEach(function (name) {
    panel.addEventListener(name, function (e) { e.stopPropagation(); });
  });
  function moveIntoFullscreen() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && fs.tagName !== 'CANVAS' && !fs.contains(panel)) fs.appendChild(panel);
    if (!fs && panel.parentElement !== document.body) document.body.appendChild(panel);
    refresh();
  }
  document.addEventListener('fullscreenchange', moveIntoFullscreen);
  document.addEventListener('webkitfullscreenchange', moveIntoFullscreen);
  window.addEventListener('resize', refresh);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refresh);
  window.addEventListener('kw-render-diagnostics-ready', refresh);
  window.addEventListener('error', function (e) { if (recentErrors.length < 5) recentErrors.push(String(e.message || 'script error').slice(0, 240)); });
  window.addEventListener('unhandledrejection', function (e) { if (recentErrors.length < 5) recentErrors.push(String(e.reason).slice(0, 240)); });
  refresh();
  setTimeout(refresh, 1500);
  setTimeout(refresh, 5000);
})();
