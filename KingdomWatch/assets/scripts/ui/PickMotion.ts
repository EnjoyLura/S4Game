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
  private choiceCue = false;
  private refreshCue = false;
  private titlePreviewed = false;
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
  /** Give immediate readable feedback while cold card art finishes; never expose unfinished cards. */
  previewTitle(): void {
    const title = this.chrome[0]; if (!title || this.titlePreviewed) return;
    this.titlePreviewed = true;
    title.node.active = true; title.node.setPosition(title.position); title.node.setScale(1, 1, 1);
    uiSound('pickOpen');
  }
  /** New art is already ready. Refreshes exchange each column with its opaque predecessor. */
  reveal(previous: PickMotion | null, entered: () => void): void {
    this.previous = previous; this.entered = entered; this.refreshCue = false;
    this.quiet = reducedMotion(); this.phase = 'enter'; this.age = 0; this.enabled = true;
    if (previous) {
      previous.chrome.forEach(c => { if (c.node.isValid) c.node.active = false; });
      // The replacement cards own one paper shuffle at their first landing.
    }
    else if (!this.titlePreviewed) uiSound('pickOpen');
    this.renderEntry();
  }
  choose(index: number, done: () => void): boolean {
    if (!this.ready || !this.cards[index]) return false;
    this.phase = 'choose'; this.selected = index; this.age = 0; this.done = done; this.choiceCue = false;
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
      if (this.previous && !this.refreshCue && this.age >= (this.quiet ? .04 : .15)) {
        this.refreshCue = true; uiSound('pickRefresh');
      }
      if (this.age >= (this.quiet ? .1 : this.previous ? .52 : .32)) {
        this.releasePrevious(); this.restore();
        const entered = this.entered; this.entered = null; entered?.();
      }
    } else if (this.phase === 'choose') {
      if (!this.choiceCue && this.age >= (this.quiet ? 0 : .1)) { this.choiceCue = true; uiSound('pickChoose'); }
      this.renderChoice();
      if (this.age >= (this.quiet ? .14 : .48)) {
        this.phase = 'held'; this.enabled = false;
        const done = this.done; this.done = null; done?.();
      }
    }
  }
  private renderEntry(): void {
    for (let i = 0; i < this.chrome.length; i++) {
      const c = this.chrome[i], delay = i && !this.previous ? .12 : 0;
      if (this.age < delay) continue;
      c.node.active = true;
      const p = this.quiet || (i === 0 && this.titlePreviewed) ? 1 : out((this.age - delay) / .18);
      c.node.setPosition(c.position.x, c.position.y - (i ? 6 : 8) * (1 - p), c.position.z);
      c.node.setScale(1 - .012 * (1 - p), 1 - .012 * (1 - p), 1);
    }
    if (this.previous) { this.renderRefresh(); return; }
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i], delay = this.quiet ? 0 : i * .035;
      if (this.age < delay) continue;
      if (!c.node.active) {
        c.node.active = true;
        const old = this.previous?.cards[i]; if (old?.node.isValid) old.node.active = false;
      }
      const p = this.quiet ? 1 : clamp((this.age - delay) / .24), ease = out(p);
      // One very small, uniform settle. No tall stretch, flip, opacity or distant travel.
      const scale = this.quiet ? 1 : .955 + .045 * ease + .008 * Math.sin(p * Math.PI);
      c.node.setScale(scale, scale, 1);
      c.node.setPosition(c.position.x, c.position.y - 22 * (1 - ease), c.position.z);
    }
  }
  /** A tight re-deal: old paper pulls in, then a prepared opaque face springs into each same slot. */
  private renderRefresh(): void {
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i], old = this.previous?.cards[i];
      const time = this.age - (this.quiet ? 0 : i * .045), handoff = this.quiet ? 0 : .12;
      if (time < 0) continue;
      if (time < handoff && old && isValid(old.node, true)) {
        const p = out(time / handoff), scale = 1 - .075 * p;
        old.node.setScale(scale, scale, 1);
        old.node.setPosition(old.position.x, old.position.y - 12 * p, old.position.z);
        continue;
      }
      c.node.active = true;
      if (old && isValid(old.node, true)) old.node.active = false;
      const p = this.quiet ? 1 : clamp((time - handoff) / .28);
      const scale = this.quiet ? 1 : p < .6 ? .925 + .115 * out(p / .6) : 1.04 - .04 * smooth((p - .6) / .4);
      c.node.setScale(scale, scale, 1);
      c.node.setPosition(c.position.x, c.position.y - (this.quiet ? 0 : 26 * (1 - out(p))), c.position.z);
      c.accent.clear();
      if (this.quiet) continue;
      const strength = Math.sin(p * Math.PI);
      this.tint.set(255, 218, 140, Math.round(200 * strength)); c.accent.strokeColor = this.tint;
      c.accent.lineWidth = 2;
      // A travelling edge glint reads as new cards arriving, without washing out their illustration.
      const y = -174 + 348 * out(p);
      for (const side of [-1, 1]) {
        c.accent.moveTo(side * 107, y - 22); c.accent.lineTo(side * 107, y + 22); c.accent.stroke();
        this.tint.set(255, 225, 162, Math.round(170 * strength)); c.accent.fillColor = this.tint;
        const x = side * (110 + 9 * strength), r = 1 + 2 * strength;
        c.accent.moveTo(x, y + r * 2); c.accent.lineTo(x + r, y);
        c.accent.lineTo(x, y - r * 2); c.accent.lineTo(x - r, y); c.accent.close(); c.accent.fill();
      }
    }
  }
  private renderChoice(): void {
    const progress = out((this.age - (this.quiet ? 0 : .045)) / (this.quiet ? .1 : .21));
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i], chosen = i === this.selected;
      c.shade.clear(); c.accent.clear();
      if (chosen) {
        // One decisive compress -> spring -> settle, all from this clock, without competing tweens.
        const scale = this.quiet ? 1 : this.age < .055 ? 1 - .06 * out(this.age / .055)
          : this.age < .18 ? .94 + .18 * out((this.age - .055) / .125)
            : 1.12 - .055 * smooth((this.age - .18) / .22);
        c.node.setScale(scale, scale, 1);
        c.node.setPosition(c.position.x * (1 - (this.quiet ? 0 : .06 * progress)),
          c.position.y + (this.quiet ? 0 : 28 * progress), c.position.z);
        this.drawEdges(c.accent, progress);
      } else {
        const side = i < this.selected ? -1 : 1;
        c.node.setScale(1 - (this.quiet ? 0 : .06 * progress), 1 - (this.quiet ? 0 : .06 * progress), 1);
        c.node.setPosition(c.position.x + (this.quiet ? 0 : side * 32 * progress), c.position.y - (this.quiet ? 0 : 16 * progress), c.position.z);
        // A dark overlay covers an OPAQUE paper card; the battlefield never bleeds through it.
        this.tint.set(13, 20, 28, Math.round(178 * progress)); c.shade.fillColor = this.tint;
        c.shade.roundRect(-111, -180, 222, 360, 12); c.shade.fill();
      }
    }
  }
  private drawEdges(g: Graphics, progress: number): void {
    const length = 18 + 24 * progress, alpha = (170 + 65 * Math.sin(clamp(this.age / .48) * Math.PI)) * progress;
    // Energy stays on the perimeter; the parchment, picture and text never receive a white wash.
    for (let band = 3; band >= 0; band--) {
      this.tint.set(255, 201, 86, Math.round((band ? 14 : 170) * progress));
      g.strokeColor = this.tint; g.lineWidth = band ? 3 + band * 3 : 1.6;
      g.roundRect(-111 - band, -180 - band, 222 + band * 2, 360 + band * 2, 11); g.stroke();
    }
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
    const t = clamp((this.age - .08) / .35), strength = Math.sin(t * Math.PI);
    this.tint.set(249, 211, 120, Math.round(210 * strength)); g.fillColor = this.tint;
    for (let k = 0; k < 8; k++) {
      const side = k % 2 ? -1 : 1, x = side * (110 + out(t) * (12 + k % 3 * 6));
      const y = -140 + Math.floor(k / 2) * 91 + out(t) * 24, r = 1.4 + strength * 1.6;
      g.moveTo(x, y + r * 1.6); g.lineTo(x + r * .65, y);
      g.lineTo(x, y - r * 1.6); g.lineTo(x - r * .65, y); g.close(); g.fill();
    }
    // Short tapered corner rays deliver the peak, then disappear before the card commits.
    const burst = clamp((this.age - .1) / .2), energy = Math.sin(burst * Math.PI);
    this.tint.set(255, 215, 130, Math.round(185 * energy)); g.fillColor = this.tint;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = sx * (112 + burst * 15), y = sy * (181 + burst * 18);
      g.moveTo(x, y); g.lineTo(x + sx * (10 + energy * 9), y + sy * (14 + energy * 13));
      g.lineTo(x + sx * 3, y - sy * 2); g.close(); g.fill();
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
