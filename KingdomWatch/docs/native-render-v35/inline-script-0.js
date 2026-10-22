
    (function () {
      try {
        var q = parseFloat(new URLSearchParams(window.location.search).get('dpr'));
        window.__KW_GET_DPR_CAP = function () {
          var real = window.devicePixelRatio || 1;
          var scale = window.visualViewport && window.visualViewport.scale || 1;
          // Pinch enlargement does not allocate larger buffers; desktop page reduction does.
          var cap = q > 0 ? Math.min(real, q) : Math.min(real, 4) * Math.min(1, scale);
          window.__KW_DPR_CAP = Math.max(.25, cap);
          return window.__KW_DPR_CAP;
        };
        window.__KW_GET_DPR_CAP();
      } catch (e) { window.__KW_DPR_CAP = 2; }
    })();
  