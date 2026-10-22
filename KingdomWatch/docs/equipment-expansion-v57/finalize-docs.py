from pathlib import Path
import json,re
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
r=json.loads(read(HERE/'deployment-stage.json'))
b=json.loads(read(HERE/'build-record.json'))
w=json.loads(read(HERE/'web-release.json'))
assert r['published'] and r['staticHttpCheck']['allImageHashesMatch'] and r['staticHttpCheck']['mainBundleHashMatches']
assert r['staticHttpCheck']['nativeIllustrations']==16
duration=re.search(r'builder:build-project-total \((\d+)ms\)',read(Path(b['log'])))[1]
uploaded=re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)',read(HERE/'publish.log'))
upload_note=f'Wrangler main上传{uploaded[1]}份、复用{uploaded[2]}份。' if uploaded else 'Wrangler main报告Deployment complete。'
note=(f"已发布：[正式游戏]({r['game']})，[部署快照]({r['deployment']})。Creator3.8.8生产构建{duration}ms、退出{b['exitCode']}，DPR和缓存准备完成，引擎`{w['engineRevision']}`保持。"
 f"{upload_note}正式入口HTTP200，主脚本及16PNG与发布包SHA256一致；原10条类型诊断无新增。{r['originalNativeFilesPreserved']}份原生资源和{r['priorPreviewFilesPreserved']}份历史预览字节保持。未运行游戏、浏览器、测试、战斗模拟或音频。")
p=HERE/'README.md'
s=read(p).replace('发布状态：待构建发布，以deployment-stage.json为准。',note)
catalog=json.loads(read(HERE/'catalog.json'))
art=json.loads(read(HERE/'art-manifest.json'))['assets']
kind=dict(helm='头盔',acc='饰品',glove='手套',armor='衣服')
stat=dict(atk='攻击',atkPct='攻击加成',critRate='暴击率',critDmg='暴击伤害',atkSpd='攻速',range='攻击范围',skillDmg='技能伤害',chargeEff='充能效率')
pct=['atkPct','critRate','critDmg','atkSpd','chargeEff']
lines=['\n\n## 新装备Lv.1实际属性与最终文件\n','全部新装备为1阶；按现有强化公式随各实例等级增长。\n',
 '| 装备（点击查看原始PNG） | 品质/部位 | 词条一 | 词条二 | 侧重 |','| --- | --- | --- | --- | --- |']
for d in catalog['added']:
 a=next(a for a in art if a['id']==d['id'])
 values=[stat[k]+' +'+(f'{v*100:g}%' if k in pct else str(v)) for k,v in d['stats'].items()]
 lines.append(f"| [{d['name']}](../../{a['path']}) | {'蓝' if d['quality']==2 else '紫'}1阶 · {kind[d['kind']]} | {values[0]} | {values[1]} | {d['focus']} |")
if '## 新装备Lv.1实际属性与最终文件' not in s:s+='\n'.join(lines)+'\n'
p.write_text(s,encoding='utf-8')
minimum=min(min(a['normalizedMargins']) for a in art)
ledger=(f"2026-10-19 用户要求白绿之外每品质每类型新增两装备；已发布[装备扩展v57](docs/equipment-expansion-v57/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。"
 '四非武器部位头盔/饰品/手套/衣服，蓝8紫8共16，各品质各部位2；原4装备定义/价格/阶级/美术不变，总非武器20，含v56武器25共45，商店装备20。头盔基础攻击或攻击加成、饰品暴击率或暴伤、手套攻速或范围、衣服技伤或充能；固定原部位两词条，两路线有取舍，无新被动。'
 '新蓝1阶1800金币通关1-2、新紫1阶6000金币通关1-4，同品质两路线同价且高于新Lv1出售值；所有英雄可穿戴，装备各实例Lv1独立培养，原武器等级继承保持。原白手套3阶及其他原配置保持，高品质1阶不承诺各词条高于旧高阶。仅加入商店，不加掉落或改战斗/经济公式/存档；购买和即时保存沿既有流程。'
 '商店增加全部/头盔/饰品/手套/衣服筛选、品质升序、计数、真实属性/侧重/全英雄说明，武器筛选和25武器字节保持。HeroComic共用EQUIPS.art用于商店/背包/穿戴。'
 f'内置image_gen参考4原部位图，一物一图16张透明PNG原字节入shop_comic_v1/*_v57，独立meta，不裁切重采样；完整轮廓留透明边，最小实测边距{minimum*100:.2f}%，8%提示词目标不作为全部达标声称；只读总览及160px缩略图。'
 f"1932原文件仅GameData/HeroComic/ShopPage三脚本变化，新增16PNG+16meta；{r['originalNativeFilesPreserved']}原生媒体和{r['priorPreviewFilesPreserved']}预览保持，原10类型诊断无新增，Creator{duration}ms退出{b['exitCode']}，DPR/缓存/引擎{w['engineRevision']}保持。{upload_note}入口200、主包及16图SHA一致。未运行游戏/浏览器/测试/模拟/音频，用户人工验收，无Git提交，原工作及.tmp-kwsfx保持。")
for name in ['README.md','AGENTS.md']:
 p=ROOT/name;s=read(p)
 if '[装备扩展v57]' not in s:
  first,_,rest=s.partition('\n');p.write_text(first+'\n\n'+ledger+'\n'+rest,encoding='utf-8')
print('Release documentation updated:',r['game'])
