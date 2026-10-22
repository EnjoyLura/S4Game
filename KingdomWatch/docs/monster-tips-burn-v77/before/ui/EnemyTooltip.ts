/** One live, non-modal enemy readout; field taps stay behind HUD, loot and modal controls. */
import { BlockInputEvents, EventTouch, Graphics, Node, UITransform, Vec3 } from 'cc';
import type { Monster, MonsterManager } from '../battle/Monster';
import { LO } from '../config/GameConfig';
import { CODEX } from '../core/GameData';
import { comicButton, comicMark, comicPlate, COMIC } from './ComicUI';
import { Bar, C, gbar, gpanel, label, N, setText } from './UIKit';

const WIDTH = 380, HEIGHT = 300;

export class EnemyTooltip {
  private root: Node;
  private ring: Graphics;
  private selected: Monster | null = null;
  private lifeId = 0;
  private refreshT = 0;
  private pressed = -1;
  private startX = 0;
  private startY = 0;
  private point = new Vec3();
  private local = new Vec3();
  private name: Node;
  private tags: Node;
  private health: Node;
  private healthBar: Bar;
  private physical: Node;
  private magic: Node;
  private states: Node;
  private counter: Node;

  constructor(field: Node, ui: Node, private manager: MonsterManager, private canInspect: () => boolean) {
    const tap = N('enemyInspectFieldTap', field, 0, 0, 750, LO.half * 2);
    tap.setSiblingIndex(0);
    const transform = tap.getComponent(UITransform)!;
    tap.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      this.pressed = this.canInspect() ? e.getID() : -1;
      const p = e.getUILocation(); this.startX = p.x; this.startY = p.y;
    });
    tap.on(Node.EventType.TOUCH_CANCEL, () => { this.pressed = -1; });
    tap.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      const valid = this.pressed === e.getID(); this.pressed = -1;
      const p = e.getUILocation();
      if (!valid || !this.canInspect() || Math.hypot(p.x - this.startX, p.y - this.startY) > 14) return;
      this.point.set(p.x, p.y, 0); transform.convertToNodeSpaceAR(this.point, this.local);
      const target = this.pick(this.local.x, this.local.y);
      if (!target || target === this.selected && target.lifeId === this.lifeId) this.hide();
      else this.show(target);
    });

    this.ring = N('inspectedEnemyRing', field).addComponent(Graphics);
    this.ring.node.active = false;
    this.root = comicPlate(ui, 0, 0, WIDTH, HEIGHT, 'paper', { name: 'enemyLiveTooltip', cut: 10 });
    this.root.addComponent(BlockInputEvents);
    this.name = label(this.root, -10, 118, '', { size: 24, bold: true, color: COMIC.text, align: 'left', w: 292, h: 32, shrink: true });
    this.tags = label(this.root, 0, 87, '', { size: 16, color: COMIC.sub, align: 'left', w: 344, h: 22, shrink: true });
    this.health = label(this.root, 0, 59, '', { size: 18, bold: true, color: COMIC.text, align: 'left', w: 344, h: 25 });
    this.healthBar = gbar(this.root, 0, 37, 344, 10, '#65B441');
    this.physical = label(this.root, -86, 8, '', { size: 18, bold: true, color: '#546A76', align: 'left', w: 172, h: 26, shrink: true });
    this.magic = label(this.root, 86, 8, '', { size: 18, bold: true, color: '#7754A1', align: 'left', w: 172, h: 26, shrink: true });
    this.states = label(this.root, 0, -44, '', { size: 18, color: COMIC.text, align: 'left', w: 344, h: 68, lineHeight: 23, shrink: true });
    gpanel(this.root, 0, -91, 344, 1, '#D4BD96');
    this.counter = label(this.root, 0, -117, '', { size: 16, color: COMIC.sub, align: 'left', w: 344, h: 42, lineHeight: 21, shrink: true });
    const close = comicButton(this.root, 158, 119, 40, 40, '', () => this.hide(), { tone: 'dark', sound: 'close', name: 'closeEnemyTooltip' });
    comicMark(close.getChildByName('buttonFace')!, 0, 0, 'close', 18);
    this.root.active = false;
  }

  private pick(x: number, y: number): Monster | null {
    let result: Monster | null = null, best = Infinity;
    for (const m of this.manager.list) {
      if (m.dead || !m.node.activeInHierarchy) continue;
      const halfWidth = Math.max(25, m.def.radius * 1.3);
      const bottom = m.y - m.def.radius * .82 - 5, top = m.y + m.headTop + 23;
      if (Math.abs(x - m.x) > halfWidth || y < bottom || y > top) continue;
      const score = ((x - m.x) / halfWidth) ** 2 + ((y - (bottom + top) / 2) / ((top - bottom) / 2)) ** 2;
      if (score < best || score === best && m.depthY < (result?.depthY ?? Infinity)) { result = m; best = score; }
    }
    return result;
  }

  private show(m: Monster): void {
    this.selected = m; this.lifeId = m.lifeId; this.refreshT = 0;
    setText(this.name, m.def.name);
    const tags = [m.isBoss ? '首领' : m.def.elite ? '精英' : '普通',
      m.def.kind === 'heal' ? '治疗' : m.def.kind === 'ranged' ? '远程' : '近战'];
    if (m.def.physRes) tags.push('重甲');
    if (m.def.magicRes) tags.push('符盾');
    if (m.def.airborne) tags.push('飞行');
    if (m.def.rush) tags.push('冲锋');
    if (m.def.regen) tags.push('再生');
    if (m.def.summon) tags.push('召唤');
    if (m.def.aura) tags.push('光环');
    if (m.def.revive) tags.push('复生');
    if (m.def.split) tags.push('分裂');
    setText(this.tags, tags.join(' · '));
    setText(this.counter, '应对：' + (CODEX.find(d => d.id === m.def.id)?.weak || '集中火力，注意施法与冲锋时机'));
    this.root.active = true; this.ring.node.active = true;
    this.tick(0);
  }

  hide(): void {
    this.selected = null; this.root.active = false; this.ring.node.active = false;
  }

  tick(dt: number): void {
    const m = this.selected;
    if (!m) return;
    if (!this.canInspect() || m.dead || m.lifeId !== this.lifeId || !m.node.isValid || !m.node.activeInHierarchy) { this.hide(); return; }
    const maxY = LO.half - LO.notchTop - 130 - HEIGHT / 2;
    const minY = Math.min(maxY, -LO.half + 300 + HEIGHT / 2);
    let y = m.y + m.headTop + HEIGHT / 2 + 26;
    if (y > maxY) y = m.y - m.def.radius - HEIGHT / 2 - 18;
    this.root.setPosition(Math.max(-165, Math.min(70, m.x + (m.x > 0 ? -90 : 90))), Math.max(minY, Math.min(maxY, y)), 0);
    this.ring.clear(); this.ring.strokeColor = C('#FFDA7A'); this.ring.lineWidth = 2.5;
    this.ring.ellipse(m.x, m.depthY, m.def.radius * 1.28, m.def.radius * .44); this.ring.stroke();
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = .1;
    const info = m.inspect();
    setText(this.health, '生命 ' + Math.max(0, Math.ceil(m.hp)) + ' / ' + Math.round(m.maxHp));
    this.healthBar.set(m.hp / Math.max(1, m.maxHp));
    setText(this.physical, '物抗 ' + Math.round(info.physical * 100) + '%' + (info.armorBroken ? ' · 已破甲' : ''));
    setText(this.magic, '法抗 ' + Math.round(info.magic * 100) + '%' + (info.wardBroken ? ' · 已破盾' : ''));
    setText(this.states, '状态：' + info.states.join(' · '));
  }
}
