/** Original paper-card choreography. One clock owns layout; card artwork stays opaque. */
import { _decorator, Color, Component, game, Game, Graphics, isValid, Node, Vec3 } from 'cc';
import { reducedMotion } from './UIMotion';
import { uiSound } from './UIAudio';

const { ccclass } = _decorator;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const out = (v: number): number => 1 - (1 - clamp(v)) ** 3;
const smooth = (v: number): number => { const p = clamp(v); return p * p * (3 - 2 * p); };
interface CardView { node: Node; position: Vec3; shade: Graphics; accent: Graphics; }

@ccclass('PickMotion')
export class PickMotion extends Component {
  private cards: CardView[] = [];
  private chrome: { node: Node; position: Vec3 }[] = [];
  private phase: 'waiting' | 'enter' | 'idle' | 'choose' | 'held' = 'waiting';
  private age = 0;
  private selected = -1;
  private done: (() => void) | null = null;
  private entered: (() => void) | null = null;
  private previous: PickMotion | null = null;
  private backgrounded = false;
  private quiet = false;
  private tint = new Color();

  get ready(): boolean { return this.phase === 'idle'; }
  onLoad(): void {
    game.on(Game.EVENT_HIDE, this.hide, this);
    game.on(Game.EVENT_SHOW, this.show, this);
    this.enabled = false;
  }
  configure(title: Node, footer: Node, cards: Node[]): void {
    this.chrome = [title, footer].map(node => ({ node, position: node.position.clone() }));
    this.cards = cards.map(node => ({ node, position: node.position.clone(),
      shade: this.ink(node, 'unselectedCardShade'), accent: this.ink(node, 'selectedPaperEdges') }));
    this.chrome.forEach(c => { c.node.active = false; });
    this.cards.forEach(c => { c.node.active = false; });
  }
  private ink(parent: Node, name: string): Graphics {
    const n = new Node(name); n.layer = parent.layer; n.setParent(parent);
    return n.addComponent(Graphics);
  }
  /** New art is already ready. Refreshes exchange each column with its opaque predecessor. */
  reveal(previous: PickMotion | null, entered: () => void): void {
    this.previous = previous; this.entered = entered;
    this.quiet = reducedMotion(); this.phase = 'enter'; this.age = 0; this.enabled = true;
    if (previous) previous.chrome.forEach(c => { if (c.node.isValid) c.node.active = false; });
    else uiSound('open');
    this.renderEntry();
  }
  choose(index: number, done: () => void): boolean {
    if (!this.ready || !this.cards[index]) return false;
    this.phase = 'choose'; this.selected = index; this.age = 0; this.done = done;
    this.cards[index].node.setSiblingIndex(this.node.children.length - 1);
    this.enabled = true; this.renderChoice(); return true;
  }
  /** A rejected/stale gameplay callback must leave a usable picker. */
  restore(): void {
    this.phase = 'idle'; this.done = null; this.enabled = false;
    for (const c of this.cards) {
      c.node.active = true; c.node.setPosition(c.position); c.node.setScale(1, 1, 1);
      c.shade.clear(); c.accent.clear();
    }
    for (const c of this.chrome) { c.node.active = true; c.node.setPosition(c.position); c.node.setScale(1, 1, 1); }
  }
  update(dt: number): void {
    if (this.backgrounded) return;
    this.age += Math.min(dt, .05);
    if (this.phase === 'enter') {
      this.renderEntry();
      if (this.age >= (this.quiet ? .1 : .44)) {
        this.releasePrevious(); this.restore();
        const entered = this.entered; this.entered = null; entered?.();
      }
    } else if (this.phase === 'choose') {
      this.renderChoice();
      if (this.age >= (this.quiet ? .14 : .46)) {
        this.phase = 'held'; this.enabled = false;
        const done = this.done; this.done = null; done?.();
      }
    }
  }
  private renderEntry(): void {
    for (let i = 0; i < this.chrome.length; i++) {
      const c = this.chrome[i], delay = i && !this.previous ? .22 : 0;
      if (this.age < delay) continue;
      c.node.active = true;
      const p = this.quiet ? 1 : out((this.age - delay) / .18);
      c.node.setPosition(c.position.x, c.position.y - (i ? 6 : 8) * (1 - p), c.position.z);
      c.node.setScale(1 - .012 * (1 - p), 1 - .012 * (1 - p), 1);
    }
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i], delay = this.quiet ? 0 : .04 + i * .055;
      if (this.age < delay) continue;
      if (!c.node.active) {
        c.node.active = true;
        const old = this.previous?.cards[i]; if (old?.node.isValid) old.node.active = false;
      }
      const p = this.quiet ? 1 : clamp((this.age - delay) / .29), ease = out(p);
      // One very small, uniform settle. No tall stretch, flip, opacity or distant travel.
      const scale = this.quiet ? 1 : .955 + .045 * ease + .008 * Math.sin(p * Math.PI);
      c.node.setScale(scale, scale, 1);
      c.node.setPosition(c.position.x, c.position.y - 22 * (1 - ease), c.position.z);
    }
  }
  private renderChoice(): void {
    const progress = out(this.age / (this.quiet ? .1 : .18));
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i], chosen = i === this.selected;
      c.shade.clear(); c.accent.clear();
      if (chosen) {
        const settle = this.quiet ? 0 : .028 * progress - .006 * smooth((this.age - .22) / .2);
        c.node.setScale(1 + settle, 1 + settle, 1);
        c.node.setPosition(c.position.x, c.position.y + (this.quiet ? 0 : 14 * progress), c.position.z);
        this.drawEdges(c.accent, progress);
      } else {
        const side = i < this.selected ? -1 : 1;
        c.node.setScale(1 - (this.quiet ? 0 : .015 * progress), 1 - (this.quiet ? 0 : .015 * progress), 1);
        c.node.setPosition(c.position.x + (this.quiet ? 0 : side * 7 * progress), c.position.y - (this.quiet ? 0 : 6 * progress), c.position.z);
        // A dark overlay covers an OPAQUE paper card; the battlefield never bleeds through it.
        this.tint.set(13, 20, 28, Math.round(148 * progress)); c.shade.fillColor = this.tint;
        c.shade.roundRect(-111, -180, 222, 360, 12); c.shade.fill();
      }
    }
  }
  private drawEdges(g: Graphics, progress: number): void {
    const length = 14 + 14 * progress, alpha = (160 + 65 * Math.sin(clamp(this.age / .46) * Math.PI)) * progress;
    for (let band = 0; band < 2; band++) {
      this.tint.set(band ? 249 : 139, band ? 210 : 91, band ? 113 : 30, Math.round(alpha * (band ? 1 : .35)));
      g.strokeColor = this.tint; g.lineWidth = band ? 1.8 : 5;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const x = sx * 106, y = sy * 175;
        g.moveTo(x - sx * length, y); g.lineTo(x - sx * 5, y);
        g.lineTo(x, y - sy * 5); g.lineTo(x, y - sy * length); g.stroke();
      }
    }
    if (this.quiet) return;
    const t = clamp((this.age - .06) / .4), strength = Math.sin(t * Math.PI);
    this.tint.set(249, 211, 120, Math.round(210 * strength)); g.fillColor = this.tint;
    for (let k = 0; k < 8; k++) {
      const side = k % 2 ? -1 : 1, x = side * (108 + t * (5 + k % 3 * 3));
      const y = -140 + Math.floor(k / 2) * 91 + t * 16, r = 1.2 + strength;
      g.moveTo(x, y + r * 1.6); g.lineTo(x + r * .65, y);
      g.lineTo(x, y - r * 1.6); g.lineTo(x - r * .65, y); g.close(); g.fill();
    }
  }
  private releasePrevious(): void {
    const previous = this.previous; this.previous = null;
    if (isValid(previous, true) && isValid(previous!.node, true)) {
      previous!.node.active = false; previous!.node.destroy();
    }
  }
  private hide = (): void => { this.backgrounded = true; };
  private show = (): void => { this.backgrounded = false; };
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    this.done = this.entered = null; this.releasePrevious();
  }
}
