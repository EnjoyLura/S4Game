/** Compact enemy sidebar. Field taps stay below loot and HUD controls. */
import { BlockInputEvents, Camera, Canvas, EventTouch, Graphics, Node, UITransform, Vec3 } from 'cc';
import type { Monster, MonsterManager } from '../battle/Monster';
import { LO } from '../config/GameConfig';
import type { MobDef } from '../config/Mobs';
import { comicButton } from './ComicUI';
import { Bar, C, CA, gbar, gpanel, label, N, setText } from './UIKit';

const WIDTH = 148, HEIGHT = 334, CONTENT = WIDTH - 24;
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
  private kind: Node;
  private health: Node;
  private healthBar: Bar;
  private physical: Node;
  private magic: Node;
  private introduction: Node;
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
    this.name = label(this.root, 0, 133, '', { size: 19, bold: true, color: text, w: CONTENT, h: 48, lineHeight: 23, shrink: true });
    this.kind = label(this.root, 0, 98, '', { size: 15, color: muted, w: CONTENT, h: 22, shrink: true });
    gpanel(this.root, 0, 80, CONTENT, 1, CA('#D1BC83', .4));
    this.health = label(this.root, 0, 60, '', { size: 16, color: text, w: CONTENT, h: 27, shrink: true });
    this.healthBar = gbar(this.root, 0, 41, CONTENT - 4, 8, '#65B441');
    this.physical = label(this.root, 0, 17, '', { size: 16, color: '#C9E0E9', w: CONTENT, h: 25, shrink: true });
    this.magic = label(this.root, 0, -8, '', { size: 16, color: '#DABAF7', w: CONTENT, h: 25, shrink: true });
    gpanel(this.root, 0, -29, CONTENT, 1, CA('#D1BC83', .4));
    this.introduction = label(this.root, 0, -57, '', { size: 16, color: text, w: CONTENT, h: 46, lineHeight: 22, shrink: true });
    this.states = label(this.root, 0, -101, '', { size: 15, color: muted, w: CONTENT, h: 36, lineHeight: 19, shrink: true });
    const close = comicButton(this.root, 0, -140, CONTENT - 8, 36, '关闭', () => this.hide(),
      { tone: 'dark', size: 16, sound: 'close', name: 'closeEnemySidebar' });
    close.getComponent(UITransform)!.setContentSize(CONTENT, 48);
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

  private describe(d: MobDef): string {
    if (d.kind === 'heal') return '治疗周围友军\n控制可打断';
    if (d.rush) return '蓄势后快速冲锋\n控制可打断';
    if (d.summon) return '召唤额外怪物\n优先集中击败';
    if (d.split) return '倒下后分裂\n留意新生怪物';
    if (d.revive) return '倒下后可复生\n需要再次击败';
    if (d.regen) return '受伤后持续再生\n集中火力击败';
    if (d.aura) return '为附近友军增益\n优先集中击败';
    if (d.venom) return '攻击附带毒伤\n及时清理前排';
    if (d.physRes) return '重甲抵挡物理\n法术伤害有效';
    if (d.magicRes) return '符盾抵挡法术\n物理伤害有效';
    if (d.kind === 'ranged') return '远程攻击防线\n留意后排威胁';
    if (d.id === 'goblin_worker') return '成群围攻防线\n范围伤害有效';
    return '近战逼近防线\n及时清理前排';
  }

  private show(s: Selection): void {
    this.selected = s; this.refreshT = 0;
    setText(this.name, s.def.name.replace(/[（(](精英|BOSS|首领)[）)]/gi, ''));
    setText(this.kind, [s.def.boss ? '首领' : s.def.elite ? '精英' : '普通',
      s.def.kind === 'heal' ? '治疗' : s.def.kind === 'ranged' ? '远程' : '近战'].join(' · '));
    setText(this.introduction, this.describe(s.def));
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
    setText(this.health, '生命 ' + Math.max(0, Math.ceil(s.hp)) + '/' + Math.round(s.maxHp));
    this.healthBar.set(s.hp / Math.max(1, s.maxHp));
    setText(this.physical, '物抗 ' + Math.round(info.physical * 100) + '%' + (info.armorBroken ? '（破甲）' : ''));
    setText(this.magic, '法抗 ' + Math.round(info.magic * 100) + '%' + (info.wardBroken ? '（破盾）' : ''));
    const priority = ['冰封', '眩晕', '治疗读条', '冲锋蓄势', '冲锋中', '攻击蓄力', '灼烧', '感电', '减速', '易伤', '猎杀标记', '防御姿态', '狂暴'];
    const active = priority.filter(key => info.states.some(state => state.startsWith(key))).slice(0, 2);
    setText(this.states, live ? active.join(' · ') || info.states[0] : '已击败');
  }
}
