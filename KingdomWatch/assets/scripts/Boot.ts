/**
 * 启动器：场景为空场景，Canvas/相机/战斗全部在运行时构建（§12.3 竖屏适配）
 * EVENT_AFTER_SCENE_LAUNCH 持久监听——重开战斗(loadScene)会再次进入
 */
import {
  Camera, Canvas, Color, director, Director, Layers, Node, ResolutionPolicy,
  setDisplayStats, sys, UITransform, view,
} from 'cc';
import { DESIGN_H, DESIGN_W, initLayout } from './config/GameConfig';
import { getChallengeDef } from './config/LevelDifficulty';
import { endlessChallenge, endlessOpen } from './config/Endless';
import { flow } from './core/Flow';
import { setLayerDeep } from './ui/UIKit';
import { uxPreloadIdle } from './ui/Ux';
import { MainUI } from './ui/MainUI';
import { BattleDirector } from './battle/BattleDirector';
import { TouchFeedback } from './ui/TouchFeedback';
import { motionIn } from './ui/UIMotion';
import { enterBattle, enteringBattle } from './ui/BattleEntry';
import { warmBattlefield, warmEntryArt } from './ui/BattleEntryWarmup';
import { loadSave, saveSave } from './core/SaveData';
import { deferUIWarmup } from './ui/IdleWarmup';
import { installRenderDiagnostics } from './core/RenderDiagnostics';

function hexc(hex: string): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  return c;
}

function buildCanvas(scene: Node): Node {
  const canvasNode = new Node('Canvas');
  canvasNode.parent = scene;
  canvasNode.layer = Layers.Enum.UI_2D;
  const ut = canvasNode.addComponent(UITransform);
  // 画布与相机按实际可视区初始化（竖屏 Fit-Width 可视高大于设计高 1334）；
  // Canvas 组件激活后仍会自动对齐，这里取同值只为消除硬编码 667 的时序依赖
  const vis = view.getVisibleSize();
  ut.setContentSize(DESIGN_W, vis.height);

  const canvas = canvasNode.addComponent(Canvas);
  canvas.alignCanvasWithScreen = true;

  const camNode = new Node('Camera');
  camNode.parent = canvasNode;
  camNode.layer = Layers.Enum.UI_2D;
  camNode.setPosition(0, 0, 1000);
  const cam = camNode.addComponent(Camera);
  cam.projection = Camera.ProjectionType.ORTHO;
  cam.orthoHeight = vis.height / 2;
  cam.near = 0;
  cam.far = 2000;
  cam.visibility = Layers.Enum.UI_2D;
  cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  cam.clearColor = hexc('#101418');
  cam.priority = 0;
  canvas.cameraComponent = cam;

  return canvasNode;
}

function onSceneLaunched(): void {
  // 竖版游戏：手机竖屏走 Fit-Width；桌面横屏窗口走 Fit-Height 露出完整竖版栏（可视区按窗口比例自适应）
  const vis = view.getVisibleSize();
  const policy = vis.width > vis.height ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH;
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, policy);
  const scene = director.getScene();
  if (!scene || scene.getChildByName('Canvas')) return;

  initLayout(); // 可视区/安全区 → 战场锚点（防线贴屏底、顶栏贴刘海下 §12.3）

  const canvasNode = buildCanvas(scene);
  setLayerDeep(canvasNode, Layers.Enum.UI_2D);

  // 刘海/手势条安全区（§12.3）：M0 顶栏 y=100 已预留；M1 用 sys.getSafeAreaRect() 做全量映射
  setDisplayStats(false); // 关闭调试统计面板，避免遮挡底部 HUD

  const root = new Node('GameRoot');
  root.layer = Layers.Enum.UI_2D;
  root.parent = canvasNode;

  // 双模式：主城 MainUI（底部导航五主界面）/ 战斗 BattleDirector；经 flow 标记 + loadScene 重建切换
  if (flow.mode === 'battle' && flow.endlessChapter && !endlessOpen(flow.endlessChapter, loadSave().stars)) {
    flow.mode = 'main'; flow.endlessChapter = 0; flow.mainTab = 4; flow.levelReturn = null;
  }
  if (flow.mode === 'battle') {
    const bd = root.addComponent(BattleDirector);
    bd.endlessChapter = flow.endlessChapter;
    bd.levelDef = flow.endlessChapter ? endlessChallenge(flow.endlessChapter) : getChallengeDef(flow.levelId, flow.diff);
    (globalThis as unknown as { __kw?: BattleDirector }).__kw = bd; // 调试句柄：浏览器实测弹窗用
  } else if (loadSave().firstJourney?.enabled && !loadSave().firstJourney!.entryStarted) {
    // Fresh profiles use the normal gate, scene load, art warmup and music hold.
    enterBattle(done => {
      flow.mode = 'battle'; flow.levelId = '1-1'; flow.diff = 0; flow.endlessChapter = 0;
      loadSave().firstJourney!.entryStarted = true; saveSave();
      return director.loadScene('Main', done);
    }, () => {
      flow.mode = 'main';
      loadSave().firstJourney!.entryStarted = false; saveSave();
      if (root.isValid) root.addComponent(MainUI);
    }, warmBattlefield('1-1', ['archer', 'sniper']));
  } else {
    root.addComponent(MainUI);
    deferUIWarmup(root, () => { warmEntryArt(); uxPreloadIdle(8000); });
  }
  if (!enteringBattle()) motionIn(root, 'fade');
  const touchLayer = new Node('TouchFeedbackLayer');
  touchLayer.layer = Layers.Enum.UI_2D;
  touchLayer.parent = canvasNode;
  touchLayer.addComponent(UITransform).setContentSize(vis.width, vis.height);
  touchLayer.addComponent(TouchFeedback);

  installRenderDiagnostics();

  // Page artwork loads first. Only a small current-art set warms later, one image at a time.
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, onSceneLaunched);
