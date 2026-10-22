
    (function () {
      try {
        var real = window.devicePixelRatio || 1;
        var q = parseFloat(new URLSearchParams(window.location.search).get('dpr'));
        // 3x 屏按原生 3x 渲染修糊；URL ?dpr= 可强制（低端机省电调试）
        window.__KW_DPR_CAP = q > 0 ? q : Math.min(real, 3);
      } catch (e) { window.__KW_DPR_CAP = 2; }
    })();
  