from pathlib import Path
import json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
r = json.loads(read(HERE/'deployment-stage.json'))
b = json.loads(read(HERE/'build-record.json'))
w = json.loads(read(HERE/'web-release.json'))
assert r['published'] and r['staticHttpCheck']['allImageHashesMatch'] and r['staticHttpCheck']['mainBundleHashMatches']
assert r['staticHttpCheck']['nativeIllustrations'] == 16
duration = re.search(r'builder:build-project-total \((\d+)ms\)',read(Path(b['log'])))[1]
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)',read(HERE/'publish.log'))
upload_note = f'Wrangler main上传{uploaded[1]}份、复用{uploaded[2]}份。' if uploaded else 'Wrangler main报告Deployment complete。'
note = (f"已发布：[正式游戏]({r['game']})，[部署快照]({r['deployment']})。"
        f"Creator3.8.8生产构建{duration}ms、退出{b['exitCode']}，DPR和缓存准备完成，引擎`{w['engineRevision']}`保持。"
        f"{upload_note}正式入口HTTP200，主脚本及16PNG与发布包SHA256一致；原10条类型诊断无新增。"
        f"680份原生资源和793份历史预览字节保持。未运行游戏、浏览器、测试、战斗模拟或音频。")
p = HERE/'README.md'
s = read(p).replace('发布状态：待构建发布，以deployment-stage.json为准。',note)
catalog = json.loads(read(HERE/'catalog.json'))
art = json.loads(read(HERE/'art-manifest.json'))['assets']
secondary = dict(atkSpd='攻速',critRate='暴击率',critDmg='暴击伤害',chargeEff='充能效率')
lines = ['\n\n## 新武器Lv.1实际展示值\n',
    '已包含阶级倍率和既有取整，非模板原始值；更换后实际等级仍继承英雄武器等级。\n',
    '| 武器（点击查看最终素材） | 品质/阶级 | 攻击 | 技能伤害 | 第三词条 |',
    '| --- | --- | --- | --- | --- |']
for item in catalog['added']:
    a = next(a for a in art if a['id']==item['id'])
    mul = 1.8**(item['tier']-1)
    atk = int(item['stats']['atk']*mul+.5)
    skill = int(item['stats']['skillDmg']*mul+.5)
    key = next(k for k in item['stats'] if k not in ['atk','skillDmg'])
    value = round(item['stats'][key]*mul,3)*100
    value_text = f'{value:.1f}'.rstrip('0').rstrip('.')
    lines.append(f"| [{item['name']}](../../{a['path']}) | {'蓝1阶' if item['quality']==2 else '紫2阶'} | {atk} | {skill} | {secondary[key]} +{value_text}% |")
if '## 新武器Lv.1实际展示值' not in s:
    s += '\n'.join(lines)+'\n'
p.write_text(s,encoding='utf-8')
ledger = (f"2026-10-19 用户要求扩展商店，白绿之外每品质每类新增两武器；已发布[商店武器扩展v56](docs/weapon-expansion-v56/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。"
    "当前品质白绿蓝紫，武器弓/弩/书/杖，因此新增蓝8紫8共16（每品质每类2），9旧模板/属性/突破/价格/解锁/美术逐字段保持，总25/商店21/初始白4不出售。"
    "弓疾羽短弓/铁棘长弓/逐风之弓/鸦羽猎弓，攻速或暴击；弩隼翼轻弩/碎岩重弩/银隼战弩/裂城重弩，暴击或暴伤；书潮汐秘典/烬纹魔典/星潮法典/暮鸦秘录，充能或暴击；杖霜晶法杖/回响法杖/裂日法杖/月泉法杖，暴伤或充能。"
    "攻击+技伤+一专属，突破10级攻技/30级对应副词条；新蓝1阶1000钻通关1-2，新紫2阶1600钻通关1-4，两路线同价，旧鹰眼1200/1-2保持。紫2阶沿1.8倍，文档表为含阶级Lv1真实展示。书杖三系法师通用、弓弩原职业限制、继承英雄武器培养等级；无新被动/元素状态，不换战斗手持动画，不加入关卡掉落，不改养成/存档/货币/卡/战斗。"
    "商店全部/弓/弩/魔法书/法杖筛选、品质升序和计数，商品从WEAPONS生成，真实属性/侧重/适用/阶级/突破，复用购买保护与余额反馈/即时保存，核心补解锁守卫。"
    "内置image_gen一物一图16次、分别参考既有四绿武器；16透明1254²PNG原字节入weapons_v1/*_v56，不裁切重采样或覆盖旧图，原生透明边距最小约9px、裂日一角alpha1其他角0；8%提示词边距并未全部达成，未伪称。已只读总览及160px缩略图。"
    f"1900原文件仅Weapons/GameData/ShopPage三脚本变化，新增16PNG+16meta；原9武器/680原生媒体及793预览保持，原10类型诊断无新增，Creator{duration}ms退出{b['exitCode']}，DPR/缓存/引擎{w['engineRevision']}保持。"
    f"{upload_note}入口200、主包与16图SHA一致。未运行游戏/浏览器/测试/模拟/音频，实际视觉交互及平衡用户人工验收，无Git提交，原工作及.tmp-kwsfx保持。")
for name in ['README.md','AGENTS.md']:
    p = ROOT/name
    s = read(p)
    if '[商店武器扩展v56]' not in s:
        first,_,rest = s.partition('\n')
        p.write_text(first+'\n\n'+ledger+'\n'+rest,encoding='utf-8')
print('Release documentation updated:',r['game'])
