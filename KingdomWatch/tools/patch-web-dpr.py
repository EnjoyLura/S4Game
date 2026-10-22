# -*- coding: utf-8 -*-
"""
引擎 dpr 钳制补丁（每次 CLI 构建后、部署前运行一次）。

背景：Cocos 3.8.8 web 适配器把 devicePixelRatio 钳制为 min(dpr, 2)
（pal/screen-adapter/web/screen-adapter.ts 的 getter，编译进 cocos-js 包）。
3x 屏上 canvas 后备缓冲只有 2/3 物理像素，浏览器 CSS 拉伸后 HUD 发糊。

本补丁把钳制上限改为读取 window.__KW_DPR_CAP（由 build-templates/web-mobile/index.html
的预引擎脚本最高支持真实 4x，再补偿电脑模式页面缩小比例；可用 ?dpr= 回退）。
getter 优先调用 __KW_GET_DPR_CAP，以读取浏览器完成视口调整后的实际比例。

用法：python tools/patch-web-dpr.py
"""
import glob
import io
import os
import re
import shutil
import sys
import time

ROOT = 'build/web-mobile/cocos-js'


def main():
    targets = glob.glob(ROOT + '/_virtual_cc-*.js') + glob.glob(ROOT + '/cc.js') + glob.glob(ROOT + '/cc.*.js')
    if not targets:
        print('patch-web-dpr: no engine bundle found under', ROOT)
        return 1
    changed = 0
    for path in targets:
        s = io.open(path, encoding='utf-8', errors='ignore').read()
        if '__KW_GET_DPR_CAP' in s:
            print('patch-web-dpr: already patched', path)
            continue
        # 编译后的钳制 getter（babel 展开的 ?? 运算符），唯一出现
        snip = '_window$devicePixelRa : 1, 2);'
        cap = '(window.__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP() : window.__KW_DPR_CAP || 2)'
        repl = '_window$devicePixelRa : 1, ' + cap + ');'
        n = s.count(snip)
        if n == 1:
            s = s.replace(snip, repl)
        elif 'window.__KW_DPR_CAP || 2' in s:
            s = s.replace('window.__KW_DPR_CAP || 2', cap)
        else:
            # 兜底：正则匹配 min(...devicePixelRatio... : 1, 2)
            pat = re.compile(r'(devicePixelRatio[^;]{0,160}?:\s*1),\s*2\)')
            s2, n = pat.subn(lambda m: m.group(1) + ', ' + cap + ')', s, count=1)
            if n != 1:
                print('patch-web-dpr: clamp pattern not found in', path, '- skipped')
                continue
            s = s2
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        changed += 1
        print('patch-web-dpr: patched', path)
    print('patch-web-dpr: done, %d file(s) patched' % changed)

    if not any('__KW_GET_DPR_CAP' in io.open(path, encoding='utf-8').read() for path in targets):
        print('patch-web-dpr: FATAL DPR getter patch missing - publication blocked')
        return 1

    # Support both development index.js and MD5-versioned production index.<hash>.js.
    idx_path = 'build/web-mobile/index.html'
    idx = io.open(idx_path, encoding='utf-8', errors='ignore').read()
    ver = str(int(time.time()))
    new_idx, n = re.subn(
        r"System\.import\('\./(index(?:\.[A-Za-z0-9_-]+)?\.js)(\?v=\d+)?'\)",
        lambda match: "System.import('./%s?v=%s')" % (match.group(1), ver),
        idx)
    if n == 1:
        io.open(idx_path, 'w', encoding='utf-8', newline='').write(new_idx)
        print('patch-web-dpr: entry cache-bust v=%s' % ver)
    else:
        print('patch-web-dpr: WARN System.import pattern not found (%d matches) - cache-bust skipped' % n)

    # Pages Functions（战斗诊断回传）：源码在项目根 functions/（wrangler.toml 约定位置，
    # wrangler pages deploy 自动编译上传；实测放 build 输出目录内不会被识别为函数）。
    # 这里只清理构建产物里的历史副本，避免被当静态资源重复上传。
    dst_fn = 'build/web-mobile/functions'
    if os.path.isdir(dst_fn):
        shutil.rmtree(dst_fn)
        print('patch-web-dpr: removed stale build functions dir')

    # 守卫：index.html 必须带 __KW_DPR_CAP 引导脚本（模板丢失会让补丁形同虚设，
    # 引擎回退 2x → 3x 屏再次发糊；本回归真实发生过）
    if '__KW_GET_DPR_CAP' not in new_idx:
        print('patch-web-dpr: FATAL build/web-mobile/index.html 缺少 __KW_DPR_CAP 引导脚本'
              '（build-templates/web-mobile/index.html 模板被还原？）— 禁止部署')
        return 1
    print('patch-web-dpr: index.html bootstrap OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
