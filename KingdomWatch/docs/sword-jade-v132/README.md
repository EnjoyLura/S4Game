# 御剑师剑雨与五岳天剑表现 v132

用户指出 v128 巨剑像平面色块、剑阵过细。本轮只修改御剑师技能及大招的绘制：玉色双刃剑、切面/剑脊/护手与缠柄、朝剑尖流动的光纹、渐细尾焰。落地时短闪、断续压力波、裂光与有落地过程的灰石碎片代替持续站立的巨剑；残像只留 0.22 秒。剑阵与落点提示挂既有 GroundFxLayer，位于怪物下方，减少亮环和遮挡。

纯数学 Shader，无新图片/视频/音频。飞剑24槽、地面24槽、残像8槽，战前仅御剑师预热；飞行出生时锁定材质状态，加载失败沿用旧绘制，退场释放节点和材质。模拟 dt 驱动，暂停不另走系统时间。

五剑仍为四方斜落后中央终结；技能落剑数、剑意、射程、半径、伤害、命中和回调不改。普通飞剑、空间法师及风场资源保持。飞剑渲染尖端等于原弹道命中点，剑体与拖尾向后延展。

## 离屏预览

- [技能动画](skill-review.webp)、[大招动画](heaven-review.webp)
- [阶段接触表](procedural-contact-sheet.jpg)
- [巨剑落地静帧](heaven-peak-1.7.png)、[剑雨终结静帧](skill-peak-2.35.png)

直接隔离编译实际 cosmetic TypeScript，导出 Graphics 与 Shader 参数；使用实际 GLSL 在离屏 GPU 渲染，叠加静态地图/怪物素材。只配置代表性视口和纯落剑配方，不执行英雄、弹道模拟、伤害、游戏、浏览器、战斗、音频或 WASM。预览为美术检查，不能替代用户手机实战验收。

## 可复现检查

```powershell
& 'C:/Program Files/nodejs/node.exe' docs/sword-jade-v132/verify.cjs
& 'C:/Users/user/AppData/Local/Python/pythoncore-3.14-64/python.exe' -X utf8 docs/sword-jade-v132/render_gpu.py
& 'C:/Program Files/nodejs/node.exe' docs/sword-jade-v132/audit_types.cjs
```

168帧隔离绘制、12种尖端锚点、30个实际 Shader 样本通过；全部有限且非负、输出 alpha=0、关闭强度无残色。实际最大地面6槽/空中残像1槽；40条上限、过期回收与加载失败回退通过。对比 `6684e92c`，英雄实现除预热函数外字节保持，弹道全部模拟/伤害方法保持，空间/风场/怪物与配方保持；类型仍9个既有诊断，无新增。

完成本地实现提交后，按持续授权构建并仅部署独立 GitHub Pages 运行仓库。构建、包校验与线上 HTTP 回执随后补齐；不推源码，不部署 Cloudflare。
