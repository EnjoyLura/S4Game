/** Scene-independent, opaque flag wipe. The new battlefield renders before the flags part. */
import { _decorator, BlockInputEvents, Camera, Canvas, Color, Component, director, Director,
  game, Game, isValid, Graphics, Node, UITransform, view } from 'cc';
import { reducedMotion } from './UIMotion';
import { whenUIArtReady } from './UIArtReady';

const { ccclass } = _decorator;
const LAYER = 1 << 19;
let active: BattleEntry | null = null;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const ease = (v: number): number => { const p = clamp(v); return p * p * p * (p * (p * 6 - 15) + 10); };

export function enteringBattle(): boolean { return !!active && isValid(active.node, true); }

/** No caption or button busy skin: this persistent full-screen surface owns repeat-input blocking. */
export function enterBattle(load: (done: (error?: Error | null) => void) => boolean, failed: () => void): void {
  if (enteringBattle()) return;
  const scene = director.getScene(); if (!scene) { failed(); return; }
  const root = new Node('BattleEntrySurface'); root.layer = LAYER; root.setParent(scene);
  root.addComponent(UITransform).setContentSize(view.getVisibleSize());
  const canvas = root.addComponent(Canvas); canvas.alignCanvasWithScreen = true;
  const cameraNode = new Node('BattleEntryCamera'); cameraNode.layer = LAYER; cameraNode.setParent(root);
  cameraNode.setPosition(0, 0, 1000);
  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.ORTHO; camera.near = 0; camera.far = 2000;
  camera.visibility = LAYER; camera.priority = 100; camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
  camera.orthoHeight = view.getVisibleSize().height / 2; canvas.cameraComponent = camera;
  root.addComponent(BlockInputEvents);
  director.addPersistRootNode(root);
  const transition = root.addComponent(BattleEntry); active = transition;
  transition.configure(camera, load, failed);
}

/** Called after BattleDirector has constructed its complete tree, including its tracked background. */
export function battleEntryReady(root: Node): void { active?.waitForBattle(root); }

@ccclass('BattleEntry')
export class BattleEntry extends Component {
  private left!: Node;
  private right!: Node;
  private leftInk!: Graphics;
  private rightInk!: Graphics;
  private crest!: Graphics;
  private camera!: Camera;
  private phase: 'closing' | 'holding' | 'opening' = 'closing';
  private age = 0;
  private coverage = 0;
  private openingFrom = 1;
  private width = 0;
  private height = 0;
  private quiet = false;
  private hidden = false;
  private preloaded = false;
  private loadStarted = false;
  private built = false;
  private ready = false;
  private failed = false;
  private load!: (done: (error?: Error | null) => void) => boolean;
  private fail!: () => void;
  private drawReady: (() => void) | null = null;
  private tint = new Color();

  onLoad(): void {
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }
  configure(camera: Camera, load: (done: (error?: Error | null) => void) => boolean, failed: () => void): void {
    this.camera = camera; this.load = load; this.fail = failed; this.quiet = reducedMotion();
    const ink = (name: string): Graphics => {
      const n = new Node(name); n.layer = LAYER; n.setParent(this.node); return n.addComponent(Graphics);
    };
    this.leftInk = ink('leftRoyalFlag'); this.left = this.leftInk.node;
    this.rightInk = ink('rightRoyalFlag'); this.right = this.rightInk.node; this.right.setScale(-1, 1, 1);
    this.crest = ink('royalShieldSeam'); this.resize(); this.draw(0);
    // Scene preloading overlaps the closing motion. Scene replacement waits for complete coverage.
    director.preloadScene('Main', error => {
      if (!isValid(this.node, true) || this.failed) return;
      if (error) this.abort(); else this.preloaded = true;
    });
  }
  waitForBattle(root: Node): void {
    this.built = true;
    whenUIArtReady(root, () => {
      if (!isValid(this.node, true) || !isValid(root, true)) return;
      this.drawReady = () => { this.drawReady = null; if (isValid(this.node, true)) this.ready = true; };
      director.once(Director.EVENT_AFTER_DRAW, this.drawReady);
    });
  }
  update(dt: number): void {
    if (this.hidden || !this.left) return;
    this.resize(); this.age += Math.min(dt, .05);
    if (this.phase === 'closing') {
      const p = this.age / (this.quiet ? .08 : .34); this.draw(ease(p));
      if (p >= 1) { this.phase = 'holding'; this.age = 0; }
    } else if (this.phase === 'holding') {
      this.draw(1);
      if (this.preloaded && !this.loadStarted && !this.failed) {
        this.loadStarted = true;
        const started = this.load(error => { if (error && isValid(this.node, true)) this.abort(); });
        if (!started) this.abort();
      }
      // Failed images retain existing procedural fallbacks; a stalled art request cannot trap the player.
      if (this.age >= .14 && (this.ready || (this.built && this.age >= 8))) {
        this.phase = 'opening'; this.age = 0;
      }
    } else {
      const p = this.age / (this.quiet ? .1 : .48); this.draw(this.openingFrom * (1 - ease(p)));
      if (p >= 1) this.finish();
    }
  }
  private resize(): void {
    const size = view.getVisibleSize();
    if (this.width === size.width && this.height === size.height) return;
    this.width = size.width; this.height = size.height;
    this.node.getComponent(UITransform)!.setContentSize(size);
    this.camera.orthoHeight = size.height / 2;
    this.paintFlag(this.leftInk); this.paintFlag(this.rightInk);
  }
  private color(g: Graphics, r: number, green: number, b: number, alpha = 255): void {
    this.tint.set(r, green, b, Math.round(alpha)); g.fillColor = this.tint;
  }
  private paintFlag(g: Graphics): void {
    const w = this.width / 2 + 128, h = this.height / 2 + 128, notch = Math.min(110, this.height * .1);
    g.clear(); this.color(g, 30, 43, 58);
    g.moveTo(-w, -h); g.lineTo(16, -h); g.lineTo(16, -notch); g.lineTo(34, 0);
    g.lineTo(16, notch); g.lineTo(16, h); g.lineTo(-w, h); g.close(); g.fill();
    // Quiet woven folds and inset piping, all vector geometry; no foreign image assets.
    for (let k = 0; k < 6; k++) {
      const x = -w + k * w / 6;
      this.color(g, 127, 151, 172, k % 2 ? 7 : 13);
      g.moveTo(x, -h); g.lineTo(x + w / 7, -h); g.lineTo(x + w / 7 - 45, h); g.lineTo(x - 45, h); g.close(); g.fill();
    }
    for (let k = 0; k < 2; k++) {
      g.strokeColor = k ? new Color(255, 224, 156, 200) : new Color(142, 101, 42, 255);
      g.lineWidth = k ? 1.2 : 5;
      g.moveTo(8, -h); g.lineTo(8, -notch); g.lineTo(26, 0); g.lineTo(8, notch); g.lineTo(8, h); g.stroke();
    }
    g.strokeColor = new Color(159, 181, 195, 20); g.lineWidth = 1;
    for (let y = -h; y < h; y += 34) { g.moveTo(-w, y); g.lineTo(-20, y + 16); g.stroke(); }
  }
  private draw(coverage: number): void {
    this.coverage = coverage;
    const slide = (1 - coverage) * (this.width / 2 + 160);
    this.left.setPosition(-slide, 0, 0); this.right.setPosition(slide, 0, 0);
    const g = this.crest; g.clear();
    const strength = clamp((coverage - .78) / .22); if (!strength) return;
    const scale = Math.min(1, this.width / 620) * (this.quiet ? 1 : .96 + strength * .04);
    g.node.setScale(scale, scale, 1);
    const alpha = 255 * strength;
    this.color(g, 22, 32, 45, alpha); g.circle(0, 0, 62); g.fill();
    g.strokeColor = new Color(212, 168, 86, Math.round(alpha * .65)); g.lineWidth = 1.4;
    g.circle(0, 0, 61); g.stroke();
    this.color(g, 43, 60, 77, alpha);
    g.moveTo(-34, 35); g.lineTo(0, 47); g.lineTo(34, 35); g.lineTo(30, -15);
    g.quadraticCurveTo(23, -36, 0, -49); g.quadraticCurveTo(-23, -36, -30, -15); g.close(); g.fill();
    g.strokeColor = new Color(240, 199, 115, Math.round(alpha)); g.lineWidth = 2.6; g.stroke();
    this.color(g, 246, 211, 139, alpha);
    g.moveTo(0, 24); g.lineTo(12, 1); g.lineTo(0, -23); g.lineTo(-12, 1); g.close(); g.fill();
    for (const side of [-1, 1]) {
      g.strokeColor = new Color(216, 179, 108, Math.round(alpha * .7)); g.lineWidth = 1.5;
      g.moveTo(side * 79, 0); g.lineTo(side * 137, 0); g.stroke();
      this.color(g, 235, 197, 123, alpha * .8);
      g.moveTo(side * 151, 5); g.lineTo(side * 157, 0); g.lineTo(side * 151, -5); g.lineTo(side * 145, 0); g.close(); g.fill();
    }
  }
  private abort(): void {
    if (this.failed) return;
    this.failed = true; this.fail(); this.openingFrom = this.coverage; this.phase = 'opening'; this.age = 0;
  }
  private finish(): void {
    if (active === this) active = null;
    director.removePersistRootNode(this.node); this.node.active = false; this.node.destroy();
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    if (this.drawReady) director.off(Director.EVENT_AFTER_DRAW, this.drawReady);
    if (active === this) active = null;
  }
}
