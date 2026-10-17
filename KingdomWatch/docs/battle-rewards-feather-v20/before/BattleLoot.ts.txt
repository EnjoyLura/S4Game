/** Rare equipment objects: body eject → bounce → touch/30s → backpack flight. */
import { Graphics, Node, UIOpacity } from 'cc';
import { LINE_Y, LO } from '../config/GameConfig';
import { ChallengeDef } from '../config/LevelDifficulty';
import { MobDef } from '../config/Mobs';
import { EQUIPS, QCOLOR } from '../core/GameData';
import { GameAudio } from '../core/GameAudio';
import { EquipInst } from '../core/SaveData';
import { rollEquipment, StageLootSummary, storeEquipment } from '../core/StageLoot';
import { bindButton } from '../ui/ButtonFeedback';
import { gearArtKey, heroGlyph } from '../ui/HeroComic';
import { CA, label, N, setText } from '../ui/UIKit';
import { artSprite, uxFrame } from '../ui/Ux';
import { reducedMotion } from '../ui/UIMotion';

export interface DeathPosition { x: number; y: number; radius: number; }
interface Drop {
  inst: EquipInst; root: Node; moving: Node; fx: Graphics; opacity: UIOpacity; hint: Node;
  x: number; y: number; fromX: number; fromY: number; color: string;
  age: number; flight: number; claimed: boolean; done: boolean;
}
const AUTO_SECONDS = 30, MAX_VISIBLE = 32;
export class BattleLoot {
  private drops: Drop[] = [];
  private picked: EquipInst[] = [];
  private receiver: Node;
  private receiverFx: Graphics;
  private receiverColor = '#FFDA7C';
  private count: Node;
  private receiverT = 0;
  private announced = false;
  private readonly targetX = 320;
  private readonly targetY = LO.half - LO.notchTop - 178;

  constructor(private parent: Node, ui: Node, private level: ChallengeDef,
    private canPick: () => boolean, private notice: (text: string) => void) {
    this.receiver = N('lootBackpackReceiver', ui, this.targetX, this.targetY, 78, 76);
    this.receiverFx = N('pickupAbsorb', this.receiver).addComponent(Graphics);
    heroGlyph(this.receiver, 0, 8, 'bag', 40);
    this.count = label(this.receiver, 0, -22, '', { size: 15, color: '#FFE29C', bold: true, w: 104, h: 22, outline: '#2A2926', outlineW: 2 });
    this.receiver.active = false;
    for (const row of level.gearPool) uxFrame(gearArtKey(row.id), () => {});
    uxFrame('hero_comic_v2/comic_bag_v2', () => {});
  }

  onKill(mob: MobDef, position: DeathPosition): void {
    const inst = rollEquipment(this.level, mob);
    if (!inst) return;
    this.drops = this.drops.filter(d => !d.done);
    if (this.drops.length >= MAX_VISIBLE) {
      const oldest = this.drops.find(d => !d.claimed);
      if (oldest) this.pick(oldest, false);
      else this.remove(this.drops[0]);
      this.drops = this.drops.filter(d => !d.done);
    }
    const x = Math.max(-327, Math.min(327, position.x + (Math.random() < .5 ? -1 : 1) * (22 + Math.random() * 25)));
    const y = Math.max(LINE_Y + 58, Math.min(LO.half - 170 - LO.notchTop, position.y - 10));
    const root = N('battleDrop:' + inst.uid, this.parent, x, y, 86, 86);
    const fx = N('qualityGround', root).addComponent(Graphics);
    const feedback = N('pickupSpring', root), moving = N('ejectedEquipment', feedback);
    const color = QCOLOR[EQUIPS[inst.defId]?.quality || 0];
    const fallback = label(moving, 0, 0, '✦', { size: 42, color, w: 54, h: 54, outline: '#252B31', outlineW: 2 });
    artSprite(moving, 0, 0, 60, 60, gearArtKey(inst.defId), { sliced: false, hideOnLoad: [fallback] });
    const hint = label(root, 0, -43, '点击拾取', { size: 13, color: '#FFF0BE', w: 100, h: 20, outline: '#292A26', outlineW: 2 });
    const drop: Drop = { inst, root, moving, fx, opacity: root.addComponent(UIOpacity), hint, x, y,
      fromX: position.x, fromY: position.y + position.radius * 1.1, color, age: 0, flight: 0, claimed: false, done: false };
    moving.setPosition(drop.fromX - x, drop.fromY - y);
    moving.setScale(.38, .38, 1);
    bindButton(root, () => this.pick(drop, true), { visual: feedback, scale: .86, sound: false,
      enabled: () => !drop.claimed && drop.age >= .32 && this.canPick() });
    this.drops.push(drop);
    this.render(drop);
    if (!this.announced) { this.announced = true; this.notice('装备掉落！点击拾取，30秒后自动收入背包'); }
    GameAudio.play('confirm', { gain: .3, rate: 1.18, lowpass: 4200, duration: .22 });
  }

  private pick(drop: Drop, animate: boolean): void {
    if (drop.claimed || drop.done) return;
    drop.claimed = true; // Claim before persistence and animation, including an auto/touch same frame.
    if (storeEquipment(drop.inst)) this.picked.push(drop.inst);
    drop.hint.active = false;
    drop.fromX = drop.x + drop.moving.position.x;
    drop.fromY = drop.y + drop.moving.position.y;
    drop.moving.setPosition(0, 0);
    drop.moving.angle = 0;
    if (!animate) { this.remove(drop); return; }
    drop.root.setPosition(drop.fromX, drop.fromY);
    this.render(drop);
    this.receiverT = .95;
    this.receiverColor = drop.color;
    this.receiver.active = true;
    setText(this.count, '装备 +' + this.picked.length);
    GameAudio.play('confirm', { gain: .58, rate: .94 + Math.random() * .08, lowpass: 5100, duration: .28 });
  }

  tick(dt: number): void {
    this.receiverT = Math.max(0, this.receiverT - dt);
    this.receiver.active = this.receiverT > 0;
    if (this.receiver.active) {
      const arrival = Math.min(1, Math.max(0, (.95 - this.receiverT - .4) / .35));
      const bump = reducedMotion() ? 1 : 1 + .15 * Math.sin(arrival * Math.PI);
      this.receiver.setScale(bump, bump, 1);
      const g = this.receiverFx; g.clear();
      if (arrival > 0 && arrival < 1) {
        g.strokeColor = CA(this.receiverColor, (1 - arrival) * .8); g.lineWidth = 2;
        g.circle(0, 8, 19 + arrival * 21); g.stroke();
        g.fillColor = CA(this.receiverColor, 1 - arrival);
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3, r = 22 + arrival * 24;
          g.circle(Math.cos(a) * r, 8 + Math.sin(a) * r, 2 * (1 - arrival) + 1); g.fill();
        }
      }
    }
    for (const drop of this.drops) {
      if (drop.done) continue;
      if (drop.claimed) {
        drop.flight += dt;
        const p = Math.min(1, drop.flight / (reducedMotion() ? .16 : .48)), e = p * p;
        drop.root.setPosition(drop.fromX + (this.targetX - drop.fromX) * e,
          drop.fromY + (this.targetY - drop.fromY) * e + Math.sin(p * Math.PI) * 90);
        const scale = 1 - .65 * p; drop.moving.setScale(scale, scale, 1);
        drop.opacity.opacity = Math.round(255 * Math.min(1, (1 - p) * 5));
        this.render(drop);
        if (p >= 1) this.remove(drop);
      } else {
        drop.age += dt;
        if (drop.age >= AUTO_SECONDS) { this.pick(drop, true); continue; }
        const p = Math.min(1, drop.age / (reducedMotion() ? .18 : .48)), ease = 1 - Math.pow(1 - p, 3);
        const landing = Math.min(1, Math.max(0, (drop.age - .48) / .24));
        const bounce = reducedMotion() ? 0 : p < 1 ? Math.sin(p * Math.PI) * 72
          : landing < 1 ? Math.sin(landing * Math.PI) * 17 : Math.sin((drop.age - .72) * 2.6) * 3;
        drop.moving.setPosition((drop.fromX - drop.x) * (1 - ease), (drop.fromY - drop.y) * (1 - ease) + bounce);
        drop.moving.angle = p < 1 ? (1 - p) * -30 : 0;
        const scale = p < 1 ? .38 + .62 * ease + .18 * Math.sin(p * Math.PI) : 1;
        const squash = !reducedMotion() && p === 1 && landing < .2 ? .13 * (1 - landing / .2) : 0;
        drop.moving.setScale(scale + squash, scale - squash, 1);
        drop.hint.active = drop.age < 4 || drop.age > AUTO_SECONDS - 5;
        if (drop.age > AUTO_SECONDS - 5) setText(drop.hint, Math.ceil(AUTO_SECONDS - drop.age) + '秒后收取');
        this.render(drop);
      }
    }
    this.drops = this.drops.filter(d => !d.done);
  }

  private render(drop: Drop): void {
    const g = drop.fx; g.clear();
    if (drop.claimed) {
      g.fillColor = CA(drop.color, .22 * (1 - Math.min(1, drop.flight / .4)));
      g.circle(0, 0, 30); g.fill();
      return;
    }
    const pulse = reducedMotion() ? 1 : .85 + .15 * Math.sin(drop.age * 3);
    g.fillColor = CA('#202722', .32); g.ellipse(0, -20, 29, 9); g.fill();
    g.fillColor = CA(drop.color, .12 * pulse); g.ellipse(0, -16, 34, 14); g.fill();
    g.strokeColor = CA('#1E2931', .88); g.lineWidth = 4; g.ellipse(0, -16, 29, 11); g.stroke();
    g.strokeColor = CA(drop.color, .95); g.lineWidth = 2; g.ellipse(0, -16, 29, 11); g.stroke();
    // A tapered translucent beam reads as a drop marker, not a screen flash.
    g.fillColor = CA(drop.color, .10 * pulse);
    g.moveTo(-20, -16); g.lineTo(-5, 82); g.lineTo(5, 82); g.lineTo(20, -16); g.close(); g.fill();
    const burst = Math.max(0, 1 - drop.age / .8);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = 22 + (1 - burst) * 31;
      if (burst > 0) {
        g.strokeColor = CA(drop.color, burst); g.lineWidth = 2;
        g.moveTo(Math.cos(a) * r, 12 + Math.sin(a) * r);
        g.lineTo(Math.cos(a) * (r + 9 * burst), 12 + Math.sin(a) * (r + 9 * burst)); g.stroke();
      }
    }
  }

  private remove(drop: Drop): void {
    if (drop.done) return;
    drop.done = true;
    if (drop.root.isValid) { drop.root.active = false; drop.root.destroy(); }
  }
  suspend(): void { this.receiver.active = false; }
  /** Settlement, exit and repeated cleanup share this idempotent grant path. */
  collectAll(): StageLootSummary {
    for (const drop of this.drops) { if (!drop.claimed) this.pick(drop, false); else this.remove(drop); }
    this.drops.length = 0;
    this.suspend();
    return { equipment: this.picked.slice(), materials: [] };
  }
}
