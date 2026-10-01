/**
 * 启动器：场景为空场景，Canvas/相机/战斗全部在运行时构建（§12.3 竖屏适配）
 * EVENT_AFTER_SCENE_LAUNCH 持久监听——重开战斗(loadScene)会再次进入
 */
import {
  Camera, Canvas, Color, director, Director, Layers, Node, ResolutionPolicy,
  setDisplayStats, sys, UITransform, view,
} from 'cc';
import { DESIGN_H, DESIGN_W, initLayout } from './config/GameConfig';
import { setLayerDeep } from './ui/UIKit';
import { uxPreloadIdle } from './ui/Ux';
import { BattleDirector } from './battle/BattleDirector';

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
  ut.setContentSize(DESIGN_W, DESIGN_H);

  const canvas = canvasNode.addComponent(Canvas);
  canvas.alignCanvasWithScreen = true;

  const camNode = new Node('Camera');
  camNode.parent = canvasNode;
  camNode.layer = Layers.Enum.UI_2D;
  camNode.setPosition(0, 0, 1000);
  const cam = camNode.addComponent(Camera);
  cam.projection = Camera.ProjectionType.ORTHO;
  cam.orthoHeight = DESIGN_H / 2;
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
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
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
  const bd = root.addComponent(BattleDirector);
  (globalThis as unknown as { __kw?: BattleDirector }).__kw = bd; // 调试句柄：浏览器实测弹窗用

  // 闲时预载全部 UI 美术：战斗 HUD 先行加载，0.8s 后逐张预热其余资源（弹窗/结算不再当面加载），
  // 战斗 3s 准备期内即可全部就绪；场景重开（loadScene('Main')）缓存仍在，秒开
  uxPreloadIdle(800);
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, onSceneLaunched);
