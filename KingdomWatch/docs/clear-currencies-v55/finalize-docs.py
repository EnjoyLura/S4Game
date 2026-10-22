from pathlib import Path
import json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
r = json.loads(read(HERE / 'deployment-stage.json'))
b = json.loads(read(HERE / 'build-record.json'))
w = json.loads(read(HERE / 'web-release.json'))
assert r['published'] and r['staticHttpCheck']['mainBundleHashMatches']
log = read(Path(b['log']))
duration = re.search(r'builder:build-project-total \((\d+)ms\)', log)[1]
uploads = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', read(HERE / 'publish.log'))
upload_note = ('Wrangler main上传' + uploads[1] + '份、复用' + uploads[2] + '份。') if uploads else 'Wrangler main报告Deployment complete。'
note = (f"已发布：[正式游戏]({r['game']})，[部署快照]({r['deployment']})。"
        f"Creator3.8.8生产构建{duration}ms、退出{b['exitCode']}，DPR/缓存准备完成，引擎`{w['engineRevision']}`保持。"
        f"{upload_note}正式入口只读HTTP200，主脚本SHA256与发布包一致；10条既有类型诊断无新增。"
        f"1826份生产资源与{r['priorPreviewFilesPreserved']}份历史预览字节保持，未运行游戏/浏览器/测试/模拟/音频。")
p = HERE / 'README.md'
p.write_text(read(p).replace('发布状态：待构建发布，以deployment-stage.json为准。', note), encoding='utf-8')
weights = ROOT / 'docs/card-offer-weights-v54'
p = weights / 'README.md'
s = read(p).replace('发布状态：待构建发布，以deployment-stage.json为准。',
    f"已完成独立静态核对及本地构建，未单独部署；随后用户要求通关金币＋钻石，统一随[v55](../clear-currencies-v55/README.md)发布：{r['game']} 。")
s = s.replace('本轮没有修改经验机制或结算界面。', 'v54阶段没有修改经验机制或结算界面；随后v55按用户要求移除结算经验奖励项并改金币＋钻石，局内经验机制仍保持。')
p.write_text(s, encoding='utf-8')
p = weights / 'deployment-stage.json'
wr = json.loads(read(p))
wr['includedInPublishedRelease'] = dict(release='v55', game=r['game'], deployment=r['deployment'])
p.write_text(json.dumps(wr, ensure_ascii=False, indent=2), encoding='utf-8')
ledger = (f"2026-10-19 用户要求机制/技能/大招卡更常见、攻击攻速卡少，并在询问经验用途后要求通关奖励金币和钻石；已合并发布"
    f"[通关货币v55](docs/clear-currencies-v55/README.md)和[卡权重v54](docs/card-offer-weights-v54/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。"
    "常规通关材料全部取消，经验不再作为胜负结算奖励展示，局内经验条/升级选卡不改、暂停注明用途。每次成功通关钻石普通10/精英15/地狱20，用户未指定数量，本轮进度已告知先用此初值；重复通关也得，失败/中退不发。"
    "win状态守卫内一次加钻与金币/星数/首胜记录保存，弹窗刷新及广告不再发钻；金币原击杀/星级/首胜加奖与差额防重保持，金币x2只翻金币，原播放图标和左右按钮保持。关卡页/掉落详情/钻石详情/结算共用baseDiamonds和既有钻石美术；首通装备/火法赠送、概率装备、星箱/图鉴、旧库存/材料商店/升级消耗保持。"
    "因通关不产材料，旧前四关材料足够培养预算不再适用，未擅自降费或补发。"
    "卡类型stats .3→.1、combat 2→3、support1不改，同品质机制单卡对数值单卡6.67→30倍相对权重，非固定百分比；品质/前置/上限/教学/效果保持。"
    f"1900原文件仅7脚本变化（v54仅Cards，v55另6奖励脚本），无新增媒体，1826生产资源与793预览散列保持；原10类型诊断无新增。Creator{duration}ms退出{b['exitCode']}，DPR/缓存/引擎{w['engineRevision']}保持，{upload_note}入口200/主包SHA一致。"
    "v54仅本地构建未独立部署，最终线上v55；未运行游戏/浏览器/测试/模拟/音频，用户人工验收，无Git提交，原工作及.tmp-kwsfx保持。")
for name in ['README.md', 'AGENTS.md']:
    p = ROOT / name
    s = read(p)
    if '[通关货币v55]' not in s:
        first, _, rest = s.partition('\n')
        p.write_text(first + '\n\n' + ledger + '\n' + rest, encoding='utf-8')
print('Release documentation updated:', r['game'])
