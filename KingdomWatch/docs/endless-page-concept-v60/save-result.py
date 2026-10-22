from pathlib import Path
import hashlib,json,shutil,struct
root=Path('D:/AI/S4Game/KingdomWatch')
here=root/'docs/endless-page-concept-v60'
src=Path("C:\\Users\\user\\.codex\\generated_images\\01a1494f-e0d3-7423-88a3-3e1079c0ca5f\\exec-2ab67f4d-5f38-485a-be93-d0672feb169e.png")
dst=here/'endless-page-concept-v60.png'
assert not dst.exists()
shutil.copy2(src,dst)
w,h=struct.unpack('>II',dst.read_bytes()[16:24])
record=dict(tool='built-in image_gen',source=str(src),output=str(dst),width=w,height=h,sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),copiedOriginalBytes=True,purpose='secondary-page art mockup; not integrated into live game',prompt='prompt.txt',references=['docs/lobby-ui-quiet-v1/approved-direction.png','assets/resources/scenes/bg_base_endless_v59.png'])
(here/'generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
ledger='2026-10-19 用户要求无尽挑战改为独立二级页面而非弹窗，并要求生成美术效果图。本轮已用内置image_gen参考现有升级页UI和v59基地挑战之门，生成[二级页面效果图v60](docs/endless-page-concept-v60/README.md)：顶部返回/标题/资源、整条前哨深林兽穴切换、攀层堡垒场景、底部全宽纪录/规则/开始按钮，无关闭叉号/遮罩。原字节PNG与提示词/来源保存在docs/endless-page-concept-v60；522金币/220钻石/15层为设计示例。仅美术预览，未修改游戏或线上v59，无构建部署/测试/浏览器运行。后续实现必须使用独立二级页面；本稿尚未获用户视觉评价，不能当作已认可。'
for name in ['README.md','AGENTS.md']:
 p=root/name
 old=p.read_text(encoding='utf-8-sig')
 first,rest=old.split('\n',1)
 p.write_text(first+'\n\n'+ledger+'\n'+rest,encoding='utf-8')
print(json.dumps(dict(output=str(dst),width=w,height=h,sha256=record['sha256']),ensure_ascii=False))
