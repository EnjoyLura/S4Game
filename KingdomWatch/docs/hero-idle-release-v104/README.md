# 五英雄待机与本地调整发布 v104

用户授权将当前本地版本发布，并要求今后每次完成改动都做本地源码Git提交，仅在明确要求时推送源码。长期规则已写入工作区AGENTS.md与项目AGENTS.md。

当前正式待机：弓箭手v103（含2帧运动补偿接头）、冰法v102、火法v99、重弩和雷法v100。发布也包含此前本地的连续冰雨/原音效、技能成熟冰面保持后破碎，以及恢复原红缎带来袭横幅；怪物序列帧与图鉴的当前修改一并本地提交。没有再生成美术或改动动作像素。

## 包体积与原稿保留

第一次导出221406423字节，超过现有200MB预算而被阻断，未上传。确认只有HeroLobbyIdle消费大厅待机且没有loadDir或直接UUID引用后，在独立发布副本中排除10套旧待机试做图集的资源路径与native负载，保留所有源PNG/meta/帧清单及正常Cocos构建。保留UUID数组位置与序列化包，避免重排索引破坏其他资源；旧的小型序列化定义不主动重写。

新的prune_lobby_trials.py根据HeroLobbyIdle实际条件路由推导5个保留路径，并检查正式SpriteFrame/清单存在；不支持的路由或额外消费者会阻断。正常导出可重复执行同样筛除。原Q95/无损分类、全部正式像素的尺寸/Alpha/ICC/动画时序、200MB预算及原缓存方式保持。

package-validation.json记录完整1555个文件逐SHA、图片解码/透明度、WASM头与资源地址/项目子路径校验，pre-publish-audit.json核对1534个源码assets和整个正常build未改动。没有启动游戏、浏览器、战斗、音频或WASM。

## 发布与Git

仅推送EnjoyLura/kingdom-watch-play的运行包main；源码在D:/AI/S4Game本地提交，不推送其origin。当前CF站点保持。使用已校验预制运行包和既有-PrunePreviousRelease规则，仅保留本次部署资源以满足200MB预算，独立仓库Git历史保留可回退。上线状态与HTTP文件校验以deployment.json和online-assets.json为准，实际手机游戏体验待用户检查。
