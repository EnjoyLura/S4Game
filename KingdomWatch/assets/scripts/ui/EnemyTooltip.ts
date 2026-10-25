/** Compact enemy sidebar. Field taps stay below loot and HUD controls. */
import { BlockInputEvents, Camera, Canvas, EventTouch, Graphics, Node, Sprite, UITransform, Vec3 } from 'cc';
import type { Monster, MonsterManager } from '../battle/Monster';
import { LO } from '../config/GameConfig';
import type { MobDef } from '../config/Mobs';
import { drawEnemyBadge } from '../battle/EnemyBadge';
import { Bar, C, CA, gbar, gpanel, label, N, setText } from './UIKit';

const WIDTH = 110, HEIGHT = 300, CONTENT = WIDTH - 24;
const TAP_PADDING = 26, DRAG_SLOP = 34;
interface Selection {
  mob: Monster; lifeId: number; def: MobDef;
  hp: number; maxHp: number; info: ReturnType<Monster['inspect']>;
}

export class EnemyTooltip {
  private root: Node;
  private ring: Graphics;
  private selected: Selection | null = null;
  private pending: Selection | null = null;
  private refreshT = 0;
  private pressed = -1;
  private startX = 0;
  private startY = 0;
  private point = new Vec3();
  private local = new Vec3();
  private ringColor = C('#FFDA7A');
  private name: Node;
  private portrait: Sprite;
  private attack: Node;
  private health: Node;
  private healthBar: Bar;
  private physical: Node;
  private magic: Node;
  private states: Node;

  constructor(field: Node, ui: Node, private manager: MonsterManager, private canInspect: () => boolean) {
    const tap = N('enemyInspectFieldTap', field, 0, 0, 750, LO.half * 2);
    // Above scenery, actors and effects; the director inserts clickable loot just above this.
    const textLayer = field.getChildByName('TextLayer');
    if (textLayer) tap.setSiblingIndex(textLayer.getSiblingIndex());
    const transform = tap.getComponent(UITransform)!;
    let camera: Camera | null = null;
    for (let ancestor: Node | null = field; ancestor && !camera; ancestor = ancestor.parent)
      camera = ancestor.getComponent(Canvas)?.cameraComponent || null;
    const world = new Vec3();
    const pickAt = (event: EventTouch): Selection | null => {
      if (!camera) return null;
      // UI locations use a bottom-left design origin; this game's camera/world is centred.
      // Convert physical screen pixels through the actual UI camera before field-local picking.
      const p = event.getLocation(); this.point.set(p.x, p.y, .5);
      camera.screenToWorld(this.point, world); transform.convertToNodeSpaceAR(world, this.local);
      const m = this.pick(this.local.x, this.local.y);
      return m ? { mob: m, lifeId: m.lifeId, def: m.def, hp: m.hp, maxHp: m.maxHp, info: m.inspect() } : null;
    };
    tap.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      if (this.pressed !== -1 || !this.canInspect()) return;
      this.pressed = e.getID();
      const p = e.getUILocation(); this.startX = p.x; this.startY = p.y;
      this.pending = pickAt(e); // Lock the touched instance before it can move or die.
    });
    tap.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
      if (this.pressed === e.getID()) { this.pressed = -1; this.pending = null; }
    });
    tap.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      if (this.pressed !== e.getID()) return;
      const captured = this.pending; this.pressed = -1; this.pending = null;
      const p = e.getUILocation();
      if (!this.canInspect() || Math.hypot(p.x - this.startX, p.y - this.startY) > DRAG_SLOP) return;
      const target = captured || pickAt(e);
      if (!target || target.lifeId === this.selected?.lifeId) this.hide();
      else this.show(target);
    });

    this.ring = N('inspectedEnemyRing', field).addComponent(Graphics);
    this.ring.node.active = false;
    this.root = gpanel(ui, 0, 0, WIDTH, HEIGHT, CA('#151C19', .9), CA('#D1BC83', .8), 1.5, 10);
    this.root.name = 'enemySidebar';
    this.root.addComponent(BlockInputEvents);
    const text = '#FFF3D6', muted = '#D1C8AF';
    const portraitNode = N('inspectedEnemyPortrait', this.root, 0, 117, 44, 48);
    this.portrait = portraitNode.addComponent(Sprite);
    this.portrait.sizeMode = Sprite.SizeMode.CUSTOM;
    this.portrait.trim = false;
    this.name = label(this.root, 0, 76, '', { size: 16, bold: true, color: text, w: CONTENT, h: 40, lineHeight: 20, shrink: true });
    const icons = N('enemyInfoIcons', this.root).addComponent(Graphics);
    drawEnemyBadge(icons, 'health', -32, 34, .6);
    drawEnemyBadge(icons, 'attack', -32, -10, .65);
    drawEnemyBadge(icons, 'armor', -32, -43, .65);
    drawEnemyBadge(icons, 'ward', -32, -76, .65);
    this.health = label(this.root, 12, 34, '', { size: 14, color: text, w: 68, h: 24, shrink: true });
    this.healthBar = gbar(this.root, 0, 17, CONTENT-4, 5, '#65B441');
    this.attack = label(this.root, 12, -10, '', { size: 16, color: text, w: 68, h: 24, shrink: true });
    this.physical = label(this.root, 12, -43, '', { size: 16, color: '#C9E0E9', w: 68, h: 24, shrink: true });
    this.magic = label(this.root, 12, -76, '', { size: 16, color: '#DABAF7', w: 68, h: 24, shrink: true });
    this.states = label(this.root, 0, -117, '', { size: 14, color: muted, w: CONTENT, h: 36, lineHeight: 18, shrink: true });
    this.root.active = false;
  }

  private pick(x: number, y: number): Monster | null {
    let result: Monster | null = null, best = Infinity;
    for (const m of this.manager.list) {
      if (m.dead || !m.node.isValid || !m.node.activeInHierarchy) continue;
      const halfWidth = Math.max(34, m.def.radius * 1.5);
      const bottom = m.y - m.def.radius * .82 - 8, top = m.y + m.headTop + 12;
      const dx = Math.max(0, Math.abs(x - m.x) - halfWidth);
      const dy = Math.max(0, bottom - y, y - top);
      const edgeDistance = Math.hypot(dx, dy);
      if (edgeDistance > TAP_PADDING) continue;
      // Prefer a directly touched body; near its edge choose the closest visible body.
      const center = Math.hypot(x - m.x, y - (bottom + top) / 2);
      const score = (edgeDistance > 0 ? 1000 + edgeDistance : 0) + center * .01;
      if (score < best || score === best && m.depthY < (result?.depthY ?? Infinity)) { result = m; best = score; }
    }
    return result;
  }

  private show(s: Selection): void {
    this.selected = s; this.refreshT = 0;
    setText(this.name, s.def.name.replace(/[（(](精英|BOSS|首领)[）)]/gi, ''));
    this.portrait.spriteFrame = s.mob.inspectFrame;
    this.portrait.node.active = !!this.portrait.spriteFrame;
    if (this.portrait.spriteFrame) {
      const size = this.portrait.spriteFrame.originalSize;
      const fit = 48 / Math.max(size.width, size.height);
      this.portrait.node.getComponent(UITransform)!.setContentSize(size.width * fit, size.height * fit);
    }
    setText(this.attack, String(Math.round(s.def.dmg)));
    this.root.active = true;
    this.tick(0);
  }

  hide(): void {
    this.selected = this.pending = null; this.pressed = -1;
    this.root.active = false; this.ring.node.active = false;
  }

  tick(dt: number): void {
    if (!this.canInspect()) { this.hide(); return; }
    const s = this.selected;
    if (!s) return;
    // Fixed left column below speed/stats/GM/notice controls, above the keep HUD.
    const top = LO.half - Math.max(552, LO.notchTop + 316);
    const bottom = -LO.half + 280;
    const scale = Math.max(.5, Math.min(1, (top - bottom) / HEIGHT));
    this.root.setScale(scale, scale, 1);
    this.root.setPosition(-375 + 12 + WIDTH * scale / 2, Math.max(bottom + HEIGHT * scale / 2, top - HEIGHT * scale / 2), 0);
    const m = s.mob;
    const live = m.lifeId === s.lifeId && !m.dead && m.node.isValid && m.node.activeInHierarchy;
    this.ring.node.active = live;
    if (live) {
      this.ring.clear(); this.ring.strokeColor = this.ringColor; this.ring.lineWidth = 2.5;
      this.ring.ellipse(m.x, m.depthY, m.def.radius * 1.28, m.def.radius * .44); this.ring.stroke();
    }
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = .1;
    if (live) { s.hp = m.hp; s.info = m.inspect(); }
    else s.hp = 0; // Retain the brief introduction after death so a quick kill remains readable.
    const info = s.info;
    setText(this.health, Math.max(0, Math.ceil(s.hp)) + '/' + Math.round(s.maxHp));
    this.healthBar.set(s.hp / Math.max(1, s.maxHp));
    setText(this.physical, info.armorBroken ? '破甲' : Math.round(info.physical * 100) + '%');
    setText(this.magic, info.wardBroken ? '破盾' : Math.round(info.magic * 100) + '%');
    const priority = ['冰封', '眩晕', '治疗读条', '冲锋蓄势', '冲锋中', '攻击蓄力', '灼烧', '感电', '减速', '易伤', '猎杀标记', '防御姿态', '狂暴'];
    const active = priority.filter(key => info.states.some(state => state.startsWith(key))).slice(0, 1);
    const role = (s.def.boss ? '首领 · ' : s.def.elite ? '精英 · ' : '') +
      (s.def.kind === 'heal' ? '治疗' : s.def.kind === 'ranged' ? '远程' : '近战');
    setText(this.states, live ? role + (active.length ? '\n' + active[0] : '') : '已击败');
  }
}
