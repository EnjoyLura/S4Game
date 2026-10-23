"""Make local static-image encoding comparisons; never replace production pixels."""
from pathlib import Path
import hashlib
import html
import json
import shutil
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT.parent / '.local-art-archive/art-resource-v82-comparisons'
SAMPLES = [
    ('第一章战场', 'scenes/scene_1_1.png'),
    ('前哨地图', 'scenes/bg_campaign_outpost_v1.png'),
    ('火法强化卡图', 'ux/ui_card_pyro_shards_v2.png'),
    ('强化卡底板', 'ux/pick_comic_v1/card_base.png'),
]


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows, cards = [], []
    for index, (title, relative) in enumerate(SAMPLES):
        source = PROJECT / 'assets/resources' / relative
        before = OUTPUT / (str(index) + '.original.png')
        after = OUTPUT / (str(index) + '.quality90.webp')
        shutil.copyfile(source, before)
        with Image.open(source) as image:
            original = image.convert('RGBA')
        original.save(after, 'WEBP', lossless=False, quality=90, alpha_quality=100, method=4)
        with Image.open(after) as decoded:
            if decoded.size != original.size or decoded.convert('RGBA').getchannel('A').tobytes() != original.getchannel('A').tobytes():
                raise RuntimeError('Preview dimensions or alpha changed: ' + relative)
        saved = round((1-after.stat().st_size/source.stat().st_size)*100, 1)
        row = {'title': title, 'source': 'assets/resources/' + relative,
               'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
               'width': original.width, 'height': original.height, 'sourceBytes': source.stat().st_size,
               'quality90Bytes': after.stat().st_size, 'savingPercent': saved,
               'alphaIdentical': True, 'productionReplacement': False}
        rows.append(row)
        cards.append('<section><h2>' + html.escape(title) + '</h2><p>' + str(original.width) + '×' + str(original.height)
                     + ' · ' + str(round(source.stat().st_size/1e6, 2)) + 'MB → '
                     + str(round(after.stat().st_size/1e6, 2)) + 'MB · 减少 ' + str(saved)
                     + '%</p><div class="pair"><figure><figcaption>当前原图 PNG</figcaption><div class="viewport"><img src="'
                     + before.name + '"></div></figure><figure><figcaption>候选 WebP Q90 · 有损</figcaption><div class="viewport"><img src="'
                     + after.name + '"></div></figure></div></section>')
    document = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>资源压缩画质对照</title>
<style>body{margin:24px;background:#172330;color:#edf3f8;font:16px/1.6 system-ui}h1{font-size:28px}h2{font-size:23px}button{padding:10px 14px;margin-right:10px;font:inherit;cursor:pointer}section{margin:28px 0;padding:18px;background:#223346;border-radius:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;min-width:0}figcaption{padding:8px 0}.viewport{height:620px;overflow:auto;background:repeating-conic-gradient(#8895a0 0% 25%,#b7c1c9 0% 50%) 50%/20px 20px}.viewport img{display:block;max-width:100%;height:auto}body.exact .viewport img{max-width:none}body.dark .viewport{background:#0c1420}@media(max-width:700px){body{margin:12px}.pair{grid-template-columns:1fr}.viewport{height:420px}}</style>
<h1>静态素材压缩对照</h1><p>正式游戏仍采用逐像素一致的无损编码。这里的 Q90 仅供人工选择，尺寸与透明通道保持，颜色有损。请切换100%查看轮廓、渐变与纹理；本页只展示本地图片，不启动游戏。</p>
<button onclick="document.body.classList.toggle('exact')">切换适配宽度 / 100%像素</button><button onclick="document.body.classList.toggle('dark')">切换透明背景</button>'''
    (OUTPUT / 'index.html').write_text(document + ''.join(cards) + '</html>\n', 'utf-8')
    report = {'localPreview': str(OUTPUT / 'index.html'), 'samples': rows, 'gameBrowserOrEngineStarted': False}
    target = PROJECT / 'docs/art-resource-pipeline-v82/static-image-candidates.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    print(json.dumps({'localPreview': report['localPreview'], 'samples': len(rows)}), flush=True)


if __name__ == '__main__':
    main()
