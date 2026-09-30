# -*- coding: utf-8 -*-
"""
引擎 dpr 钳制补丁（每次 CLI 构建后、部署前运行一次）。

背景：Cocos 3.8.8 web 适配器把 devicePixelRatio 钳制为 min(dpr, 2)
（pal/screen-adapter/web/screen-adapter.ts 的 getter，编译进 cocos-js 包）。
3x 屏上 canvas 后备缓冲只有 2/3 物理像素，浏览器 CSS 拉伸后 HUD 发糊。

本补丁把钳制上限改为读取 window.__KW_DPR_CAP（由 build-templates/web-mobile/index.html
的预引擎脚本定义为 min(真实dpr, 3)，可用 ?dpr= 回退），使 3x 屏按原生物理像素渲染。

用法：python tools/patch-web-dpr.py
"""
import glob
import io
import re
import sys

ROOT = 'build/web-mobile/cocos-js'


def main():
    targets = glob.glob(ROOT + '/_virtual_cc-*.js') + glob.glob(ROOT + '/cc.js')
    if not targets:
        print('patch-web-dpr: no engine bundle found under', ROOT)
        return 1
    changed = 0
    for path in targets:
        s = io.open(path, encoding='utf-8', errors='ignore').read()
        if '__KW_DPR_CAP' in s:
            print('patch-web-dpr: already patched', path)
            continue
        # 编译后的钳制 getter（babel 展开的 ?? 运算符），唯一出现
        snip = '_window$devicePixelRa : 1, 2);'
        repl = '_window$devicePixelRa : 1, window.__KW_DPR_CAP || 2);'
        n = s.count(snip)
        if n == 1:
            s = s.replace(snip, repl)
        else:
            # 兜底：正则匹配 min(...devicePixelRatio... : 1, 2)
            pat = re.compile(r'(devicePixelRatio[^;]{0,160}?:\s*1),\s*2\)')
            s2, n = pat.subn(r'\1, window.__KW_DPR_CAP || 2)', s, count=1)
            if n != 1:
                print('patch-web-dpr: clamp pattern not found in', path, '- skipped')
                continue
            s = s2
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        changed += 1
        print('patch-web-dpr: patched', path)
    print('patch-web-dpr: done, %d file(s) patched' % changed)

    # 守卫：index.html 必须带 __KW_DPR_CAP 引导脚本（模板丢失会让补丁形同虚设，
    # 引擎回退 2x → 3x 屏再次发糊；本回归真实发生过）
    idx = io.open('build/web-mobile/index.html', encoding='utf-8', errors='ignore').read()
    if '__KW_DPR_CAP' not in idx:
        print('patch-web-dpr: FATAL build/web-mobile/index.html 缺少 __KW_DPR_CAP 引导脚本'
              '（build-templates/web-mobile/index.html 模板被还原？）— 禁止部署')
        return 1
    print('patch-web-dpr: index.html bootstrap OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
