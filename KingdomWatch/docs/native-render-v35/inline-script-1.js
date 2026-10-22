
    (function () {
      var seen = 0;
      function show(msg) {
        try {
          if (seen >= 3) return;
          var box = document.getElementById('kwErrBox');
          if (!box) {
            box = document.createElement('div');
            box.id = 'kwErrBox';
            box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;pointer-events:none;'
              + 'font:12px/1.4 monospace;color:#ff9a9a;background:rgba(0,0,0,.72);padding:4px 6px;'
              + 'white-space:pre-wrap;word-break:break-all;max-height:40%;overflow:hidden;text-align:left;';
            (document.body || document.documentElement).appendChild(box);
          }
          seen++;
          box.textContent += (box.textContent ? '\n' : '') + '⚠ ' + String(msg).slice(0, 240);
        } catch (e) { /* ignore */ }
      }
      window.addEventListener('error', function (e) {
        show((e && (e.message || (e.error && e.error.message))) || 'unknown error');
      });
      window.addEventListener('unhandledrejection', function (e) { show('REJ: ' + (e && e.reason)); });
      var ce = console.error;
      console.error = function () {
        try { show([].join.call(arguments, ' ')); } catch (x) { /* ignore */ }
        ce.apply(console, arguments);
      };
    })();
  