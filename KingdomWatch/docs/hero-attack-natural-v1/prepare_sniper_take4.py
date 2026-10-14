from pathlib import Path
import json, shutil, urllib.request

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parent.parent
folder=ROOT.parent/'sniper-attack-natural-v1'
(folder/'takes/03/production-rejection.json').write_text(json.dumps({
    'reason':'Unrequested bright crossbow emission and reduced weapon height in source',
    'action':'Regenerate entire clip with additional return-pose reference; do not delete defective frames',
    'animationAcceptedByUser':False},indent=2),encoding='utf-8')
name='hero_sniper_attack_natural_v1_20261014_return.png'
shutil.copyfile(folder/'video-first-frame.png',GAME.parent/'美术/vfx_host'/name)
data=json.loads(urllib.request.urlopen('https://lensapi.cn/api/pricing',timeout=20).read())
model=next(item for item in data['data'] if item['model_name']=='lens-minimax-h3-768p')
(ROOT/'video-interface.json').write_text(json.dumps({'source':'https://lensapi.cn/api/pricing',
    'publicDocs':'https://lensapi.cn/docs/#videos','model':model['model_name'],
    'videoParameters':model['video_parameters'],'payload':'images:[firstReference,returnPoseReference]',
    'serverForcesLastFrame':False},ensure_ascii=False,indent=2),encoding='utf-8')
prompt='''第一张参考图是起始姿势，第二张参考图是结束姿势。严格保持两张图中同一个完整人物、同一个站姿和同一个水平端弩的握持姿势。制作两秒、固定镜头、纯红背景的游戏角色动作素材。

人物从头到尾双手始终水平端弩。弩、两手和两肘始终停留在参考图的同一高度和同一朝向，绝不降低或抬高弩。双臂持续保持原样，脚底牢牢站在原坐标，人物头和躯干高度固定。

只有一次很小的肩部紧绷再放松：0.4秒时双肩甲轻微向后震动一下，0.6秒已经回到原位置。幅度非常小，肉眼可见但不改变轮廓和站姿。手指可以有微小的扣动，手掌握持位置不变。披风有轻柔的自然惯性，1.7秒前自然恢复到参考图的原始轮廓和褶皱，结束帧与第二张参考图一致。不是大幅抬手、放下武器或变换姿势。动画始终按真实时间向前运动。

画面只有原来的人物和均匀纯红色背景。木制弩是完全不发光的静物，不产生任何新东西。所有表面保持原本画出来的固定颜色和亮度。绝对没有枪焰、发光、火星、烟雾、子弹、箭矢、粒子或爆炸，弩口不要任何亮光。武器形状保持准确完整。保留完整头、脚、整个披风和整个弩，四边都有充足红色留白。禁止镜头变化、转身、缩放、蹲起、脚步、歪头、夸张呼吸和扭曲变形。'''
(folder/'attack-prompt.txt').write_text(prompt+'\n',encoding='utf-8')
for file in ['lens-interface-source.js','lens-docs-3584.js']:
    path=ROOT/file
    if path.exists():path.unlink()
