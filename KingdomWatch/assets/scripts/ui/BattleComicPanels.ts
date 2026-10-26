/** Battle overlays use the same comic palette as the five lobby pages. */
import { Graphics, Mask, Node, ScrollView, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { CardDef, CardStacks } from '../config/Cards';
import { LO } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { BattleDirector } from '../battle/BattleDirector';
import { AdService } from '../platform/AdService';
import { loadSave, saveSave } from '../core/SaveData';
import { HERO_DEFS } from '../core/GameData';
import { C, CA, dimLayer, LabelOpts, label, N, setText, WY, WX } from './UIKit';
import { artSprite } from './Ux';
import { COMIC, comicArt, comicButton, comicPlate } from './ComicUI';
import { heroPortrait } from './HeroComic';
import { bindButton } from './ButtonFeedback';
import { pickCardIcon } from './PickArt';

interface PickCallbacks { onPick: (card: CardDef) => void; onRefreshRequest: () => void; }
interface PauseOptions {
  onResume: () => void; onExit: () => void; music: boolean; sfx: boolean;
  onToggle: (k: 'music' | 'sfx', v: boolean) => void;
  tab?: number; speed: number; speedUnlocked: boolean; xp: number;
}
interface WinOptions {
  stars: 1 | 2 | 3; gold: number; ratio: number; xp: number;
  onDouble: (done: (ok: boolean) => void) => void; onNext: () => void; onExit: () => void; tab?: number;
}
interface LoseOptions {
  goldFloor: number; reviveRatio: number; xp: number;
  onRevive: (done: (ok: boolean) => void) => void; onRetry: () => void; onExit: () => void; tab?: number;
}

const HERO_COLOR: Record<string, string> = { space:'#BB63D8', sword:'#63D2A4', cannon: '#D5A641', siphon: '#DF7B9F', archer: '#68AA43', sniper: '#4594BD', pyro: '#D96A42', volt: '#8A68B9', mora: '#48ACBC' };
const CARD_ART: Record<string, string> = {
  heavy_head: 'ui_card_sharp', fast_load: 'ui_card_swift', steady_rest: 'ui_card_crit_rate', lethal_aim: 'ui_card_crit_dmg',
  instinct_s: 'ui_card_instinct_a', fast_charge_s: 'ui_card_fast_charge_a',
  pyro_cd: 'ui_card_cd_cut', pyro_eager: 'ui_card_fast_charge_a', volt_cd: 'ui_card_cd_cut', volt_eager: 'ui_card_fast_charge_a',
  mora_cd: 'ui_card_cd_cut', mora_eager: 'ui_card_fast_charge_a', mora_linger: 'ui_card_cd_cut',
};
const RARITY = { white: '#DED4BA', blue: '#4C92C3', purple: '#8E66BC', gold: '#F2B23E' };
const ART = 'battle_comic_v1/';

function text(p: Node, x: number, y: number, s: string, o: LabelOpts = {}): Node {
  return label(p, x, y, s, { font: 'body', color: COMIC.text, shrink: true, ...o });
}
function separator(p: Node, y: number, w = 622): void {
  const g = N('battleDivider', p, 0, y).addComponent(Graphics);
  g.strokeColor = CA(COMIC.sub, .25); g.lineWidth = 1; g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.stroke();
}
function glyph(p: Node, x: number, y: number, kind: 'play' | 'pause' | 'refresh' | 'music' | 'sound' | 'phone' | 'speed', size = 32, color = COMIC.cream): Node {
  const n = N('battleGlyph:' + kind, p, x, y, size, size), g = n.addComponent(Graphics), s = size / 2;
  g.fillColor = C(color); g.strokeColor = C(color); g.lineWidth = Math.max(2, size * .09);
  if (kind === 'play' || kind === 'speed') {
    for (const dx of kind === 'speed' ? [-s * .42, s * .42] : [0]) {
      const k = kind === 'speed' ? .62 : 1;
      g.moveTo(dx - s * .6 * k, -s * .76); g.lineTo(dx + s * .8 * k, 0); g.lineTo(dx - s * .6 * k, s * .76); g.close(); g.fill();
    }
  } else if (kind === 'pause') {
    for (const x of [-s * .65, s * .18]) { g.roundRect(x, -s * .77, s * .45, s * 1.54, 2); g.fill(); }
  } else if (kind === 'refresh') {
    g.arc(0, 0, s * .7, .25 * Math.PI, 1.92 * Math.PI, false); g.stroke();
    g.moveTo(s * .66, s * .12); g.lineTo(s * .95, -s * .35); g.lineTo(s * .32, -s * .26); g.close(); g.fill();
  } else if (kind === 'music') {
    g.moveTo(-s * .28, -s * .4); g.lineTo(-s * .28, s * .62); g.lineTo(s * .6, s * .82); g.lineTo(s * .6, -s * .18); g.stroke();
    g.ellipse(-s * .52, -s * .51, s * .32, s * .21); g.fill(); g.ellipse(s * .35, -s * .31, s * .32, s * .21); g.fill();
  } else if (kind === 'sound') {
    g.moveTo(-s * .9, -s * .35); g.lineTo(-s * .42, -s * .35); g.lineTo(s * .1, -s * .8); g.lineTo(s * .1, s * .8);
    g.lineTo(-s * .42, s * .35); g.lineTo(-s * .9, s * .35); g.close(); g.fill();
    g.arc(s * .04, 0, s * .83, -.35 * Math.PI, .35 * Math.PI, false); g.stroke();
  } else {
    g.roundRect(-s * .53, -s * .82, s * 1.06, s * 1.64, 3); g.stroke();
    g.moveTo(-s * .2, -s * .58); g.lineTo(s * .2, -s * .58); g.stroke();
  }
  return n;
}

/** Fill length is exactly the share of usable track width, including 0% and tiny shares. */
function damageBar(p: Node, x: number, y: number, w: number, r: DamageRow): void {
  const h = 18, n = N('damageBar:' + r.id, p, x, y, w, h), g = n.addComponent(Graphics);
  g.fillColor = C('#DDD8CA'); g.strokeColor = C(COMIC.ink); g.lineWidth = 1.2;
  g.roundRect(-w / 2, -h / 2, w, h, 7); g.fill(); g.stroke();
  const pct = r.val > 0 ? Math.max(0, Math.min(1, r.pct)) : 0, fw = (w - 4) * pct;
  const fill = N('damageFill:' + r.id, n, -w / 2 + 2, 0, fw, h - 4);
  fill.getComponent(UITransform)!.setAnchorPoint(0, .5);
  if (fw > 0) {
    const fg = fill.addComponent(Graphics); fg.fillColor = C(HERO_COLOR[r.id] || COMIC.gold);
    fg.roundRect(0, -7, fw, 14, Math.min(5, fw / 2)); fg.fill();
    if (fw > 4) { fg.fillColor = CA('#FFFFFF', .25); fg.rect(2, 3, fw - 4, 2); fg.fill(); }
  }
}

function damageRows(p: Node, rows: DamageRow[], top: number, w: number, h: number, dark = false, dense = false): void {
  const view = N('battleDamageView', p, 0, top - h / 2, w, h); view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView), step = dense ? 86 : Math.max(76, Math.min(88, (h - 12) / Math.min(4, rows.length || 1))), contentH = Math.max(h, rows.length * step + 12);
  const content = N('battleDamageContent', view, 0, h / 2, w, contentH); content.getComponent(UITransform)!.setAnchorPoint(.5, 1);
  scroll.content = content; scroll.horizontal = false; scroll.vertical = contentH > h; scroll.elastic = false;
  if (!rows.length) text(content, 0, -h / 2, '尚未造成伤害', { size: 25, color: dark ? COMIC.cream : COMIC.sub, w: w - 30, h: 44 });
  rows.forEach((r, i) => {
    const row = N('damageRow:' + r.id, content, 0, -6 - step * i - step / 2, w, step);
    if (HERO_DEFS[r.id]) heroPortrait(row, -w / 2 + 33, 3, 58, r.id);
    const right = w / 2 - 8, pctW = 102, valW = dense ? 94 : 112;
    const pctX = right - pctW / 2, valX = right - pctW - 12 - valW / 2;
    const nameLeft = -w / 2 + 78, nameW = valX - valW / 2 - 12 - nameLeft;
    text(row, nameLeft + nameW / 2, 17, r.name, { size: dense ? 20 : 24, bold: true, color: dark ? COMIC.cream : COMIC.text, align: 'left', w: nameW, h: 32 });
    text(row, valX, 17, fmtWk(r.val), { size: dense ? 20 : 23, color: dark ? '#CCD4DE' : COMIC.sub, align: 'right', w: valW, h: 32 }).name = 'damageValue:' + r.id;
    text(row, pctX, 17, ((r.val > 0 ? Math.max(0, Math.min(1, r.pct)) : 0) * 100).toFixed(2) + '%',
      { size: dense ? 22 : 25, bold: true, color: dark ? COMIC.gold : COMIC.text, align: 'right', w: pctW, h: 32 }).name = 'damagePercent:' + r.id;
    const barW = w - 86; damageBar(row, nameLeft + barW / 2, -19, barW, r);
  });
}

function rewards(p: Node, top: number, gold: number, xp: number, goldTitle: string, note: string): void {
  for (const [i, title, value, art] of [[0, goldTitle, gold, 'comic_coin_v1'], [1, '当前经验', xp, 'hero_comic_v2/comic_attributes_v2']] as const) {
    const n = comicPlate(p, i === 0 ? -159 : 159, top - 116, 298, 204, 'card', { name: 'battleReward:' + i });
    comicArt(n, 0, 44, 76, 76, art);
    text(n, 0, -16, title, { size: 23, color: COMIC.sub, w: 260, h: 34 });
    text(n, 0, -60, Math.floor(value).toLocaleString('en-US'), { size: 35, bold: true, w: 264, h: 46 }).name = 'battleRewardValue:' + i;
  }
  text(p, 0, top - 262, note, { size: 21, color: COMIC.sub, w: 610, h: 38 });
}

export class BattleComicPanels {
  protected modalRoot: Node;
  private pickAdLeft = 1;
  private pickDiaLeft = 1;
  private picking = false;
  private pickPending = false;
  private modalVersion = 0;
  private activePanel = '';
  private winKey?: WinOptions['onDouble'];
  private doubleState: 'idle' | 'busy' | 'claimed' | 'failed' = 'idle';
  private winOptions?: WinOptions;
  private reviveKey?: LoseOptions['onRevive'];
  private reviveState: 'idle' | 'busy' | 'failed' = 'idle';
  private loseOptions?: LoseOptions;

  constructor(parent: Node, protected dir: BattleDirector) { this.modalRoot = N('ModalRoot', parent); }
  closeAll(): void {
    this.picking = false; this.pickPending = false; this.activePanel = ''; this.modalVersion++;
    this.modalRoot.destroyAllChildren();
  }
  resetPickRefresh(): void { this.pickAdLeft = this.pickDiaLeft = 1; }
  private height(wanted: number): number { return Math.min(wanted, LO.half * 2 - LO.safeTop - LO.safeBottom - 112); }
  private surface(kind: string, h: number, w = 690): Node {
    this.closeAll(); this.activePanel = kind; dimLayer(this.modalRoot, .68);
    const p = comicPlate(this.modalRoot, 0, 0, w, h, 'paper', { name: 'battle' + kind[0].toUpperCase() + kind.slice(1) + 'Panel', cut: 14 });
    p.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => { e.propagationStopped = true; });
    return p;
  }
  private tabs(p: Node, names: string[], selected: number, y: number, cb: (n: number) => void): void {
    const w = (622 - (names.length - 1) * 8) / names.length;
    names.forEach((name, i) => comicButton(p, (i - (names.length - 1) / 2) * (w + 8), y, w, 58, name,
      () => { if (i !== selected) cb(i); }, { name: 'battleTab:' + i, tone: i === selected ? 'gold' : 'dark', size: 25 }));
  }

  showPick(cards: CardDef[], _stacks: CardStacks, cb: PickCallbacks): void {
    const H = this.height(730), p = this.surface('pick', H, 710), version = this.modalVersion;
    comicArt(p, -165, H / 2 - 54, 48, 48, 'levels_comic_v1/comic_swords_v1');
    text(p, 37, H / 2 - 55, '选择强化', { size: 40, bold: true, w: 324, h: 54 });
    text(p, 0, H / 2 - 100, '选择一项 · 本局生效', { size: 22, color: COMIC.sub, w: 470, h: 34 });
    const frames: Node[] = [], cardH = 388;
    cards.forEach((card, i) => {
      const x = (i - (cards.length - 1) / 2) * 230, y = H / 2 - 335;
      const frame = comicPlate(p, x, y, 210, cardH, 'card', { name: 'pickCard:' + card.id, cut: 10 }); frames.push(frame);
      const header = comicPlate(frame, 0, cardH / 2 - 28, 210, 56, 'paper', { fill: RARITY[card.rarity], name: 'pickCardHeader', cut: 10 });
      text(header, 0, 0, card.name, { size: 25, bold: true, color: card.rarity === 'white' || card.rarity === 'gold' ? COMIC.text : COMIC.cream, w: 192, h: 42 });
      const circle = N('pickIconSeat', frame, 0, 65).addComponent(Graphics); circle.fillColor = C('#E6DFCF'); circle.circle(0, 0, 60); circle.fill();
      const key = card.art || (card.unlocks ? 'ui_icon_' + card.unlocks + '_' + card.owner : CARD_ART[card.id] || 'ui_card_' + card.id);
      if (card.owner === 'pyro' || card.owner === 'volt' || card.owner === 'mora') pickCardIcon(frame, 0, 65, 118, card);
      else artSprite(frame, 0, 65, 118, 118, key, { sliced: false });
      if (card.owner !== 'global') {
        heroPortrait(frame, -56, -23, 36, card.owner);
        text(frame, 27, -23, HERO_DEFS[card.owner]?.name.split('·')[0] || '', { size: 21, bold: true, w: 110, h: 32 });
      }
      text(frame, 0, -109, card.desc, { size: 24, bold: true, w: 186, h: 118, lineHeight: 32 });
      bindButton(frame, () => {
        if (this.picking || this.pickPending) return;
        this.picking = true;
        tween(frame).to(.08, { scale: new Vec3(1.035, 1.035, 1) }).to(.1, { scale: new Vec3(1, 1, 1) })
          .call(() => { if (version !== this.modalVersion || !frame.isValid) return; this.picking = false; cb.onPick(card); }).start();
        frames.filter(n => n !== frame).forEach(n => tween(n.getComponent(UIOpacity)!).to(.14, { opacity: 95 }).start());
      }, { scale: .98, shift: 1, releaseMotion: false, enabled: () => !this.picking && !this.pickPending && op.opacity >= 254 });
      const op = frame.addComponent(UIOpacity); op.opacity = 0;
      tween(op).delay(i * .035).to(.15, { opacity: 255 }).start();
    });
    const note = text(p, 0, -H / 2 + 161, `当局剩余刷新：广告 ${this.pickAdLeft} 次 · 钻石 ${this.pickDiaLeft} 次`,
      { size: 21, color: COMIC.sub, w: 640, h: 34 });
    let ad: Node, dia: Node;
    const busy = (value: string): void => { this.pickPending = true; setText(note, value); for (const n of [ad, dia]) n.addComponent(UIOpacity).opacity = 135; };
    ad = comicButton(p, -163, -H / 2 + 96, 310, 78, '广告刷新', () => {
      if (this.picking || this.pickPending || this.pickAdLeft <= 0) return;
      busy('广告加载中…');
      AdService.showRewarded('pick_refresh', () => {
        if (version !== this.modalVersion) return;
        this.pickAdLeft--; this.pickPending = false; cb.onRefreshRequest();
      }, () => {
        if (version !== this.modalVersion) return;
        this.showPick(cards, _stacks, cb);
      });
    }, { name: 'pickAdRefresh', tone: this.pickAdLeft ? 'green' : 'muted', size: 27 });
    glyph(ad.getChildByName('buttonFace')!, -117, 0, 'play', 28);
    dia = comicButton(p, 163, -H / 2 + 96, 310, 78, '2 钻石刷新', () => {
      if (this.picking || this.pickPending || this.pickDiaLeft <= 0) return;
      const sv = loadSave(); if (sv.diamonds < 2) { setText(note, '钻石不足 · 刷新需要 2 钻石'); return; }
      sv.diamonds -= 2; saveSave(); this.pickDiaLeft--; this.pickPending = true; cb.onRefreshRequest();
    }, { name: 'pickDiamondRefresh', tone: this.pickDiaLeft ? 'gold' : 'muted', size: 27 });
    comicArt(dia.getChildByName('buttonFace')!, -116, 0, 31, 31, 'comic_diamond_v1');
  }

  showPause(o: PauseOptions): void {
    const tab = o.tab ?? 0, H = this.height(800), p = this.surface('pause', H);
    glyph(p, -118, H / 2 - 57, 'pause', 33, COMIC.dark);
    text(p, 28, H / 2 - 57, '暂停', { size: 40, bold: true, w: 220, h: 54 });
    text(p, 0, H / 2 - 106, '战斗已暂停', { size: 22, color: COMIC.sub, w: 500, h: 34 });
    this.tabs(p, ['奖励总览', '伤害统计', '设置'], tab, H / 2 - 163, t => this.showPause({ ...o, tab: t }));
    const top = H / 2 - 212, bodyH = H - 360;
    if (tab === 0) rewards(p, top, this.dir.goldEarned, o.xp, '本局金币', '继续战斗，争取更高的通关奖励');
    else if (tab === 1) damageRows(p, this.dir.dmgSvc.rows(), top, 622, bodyH);
    else {
      const rows = [
        { key: 'music', name: '音乐', kind: 'music' }, { key: 'sfx', name: '音效', kind: 'sound' },
        { key: 'vibration', name: '振动 · 未开放', kind: 'phone' }, { key: 'speed', name: '战斗倍速', kind: 'speed' },
      ] as const;
      rows.forEach((r, i) => {
        const y = top - 43 - i * 91, row = comicPlate(p, 0, y, 622, 78, 'card', { name: 'battleSetting:' + r.key });
        glyph(row, -268, 0, r.kind, 31, COMIC.sub);
        text(row, -65, r.key === 'speed' && !o.speedUnlocked ? 12 : 0, r.name, { size: 25, bold: true, color: r.key === 'vibration' ? COMIC.sub : COMIC.text, align: 'left', w: 304, h: 34 });
        if (r.key === 'music' || r.key === 'sfx') {
          const k = r.key;
          comicButton(row, 228, 0, 126, 52, o[k] ? '开启' : '关闭', () => {
            o[k] = !o[k]; o.onToggle(k, o[k]); this.showPause({ ...o, tab: 2 });
          }, { name: 'battleToggle:' + k, tone: o[k] ? 'green' : 'muted', size: 22 });
        } else if (r.key === 'speed') {
          comicButton(row, 228, 0, 126, 52, o.speedUnlocked ? (o.speed === 1.5 ? '1.5x' : '1x') : '未解锁', () => {
            if (!o.speedUnlocked) return;
            this.dir.toggleSpeed(); this.showPause({ ...o, tab: 2, speed: this.dir.speed });
          }, { name: 'battleSpeed', tone: o.speedUnlocked ? 'gold' : 'muted', size: 22 });
          if (!o.speedUnlocked) text(row, -65, -22, '通关 1-2 解锁', { size: 17, color: COMIC.sub, w: 304, h: 22, align: 'left' });
        } else text(row, 228, 0, '未开放', { size: 22, color: COMIC.sub, w: 126, h: 34 });
      });
    }
    separator(p, -H / 2 + 135);
    comicButton(p, -159, -H / 2 + 73, 302, 78, '退出战斗', o.onExit, { name: 'battleExit', tone: 'dark', size: 29 });
    comicButton(p, 159, -H / 2 + 73, 302, 78, '继续战斗', o.onResume, { name: 'battleResume', tone: 'green', size: 29 });
  }

  showWin(o: WinOptions): void {
    if (this.winKey !== o.onDouble) { this.winKey = o.onDouble; this.doubleState = 'idle'; }
    this.winOptions = o;
    const tab = o.tab ?? 0, H = this.height(900), p = this.surface('win', H);
    comicArt(p, -239, H / 2 - 89, 112, 112, ART + 'comic_victory_v1');
    text(p, 50, H / 2 - 83, '挑战成功', { size: 42, bold: true, w: 394, h: 58 });
    text(p, 50, H / 2 - 131, '王国防线，守住了！', { size: 23, color: COMIC.sub, w: 394, h: 34 });
    for (let i = 0; i < 3; i++) {
      const star = comicArt(p, (i - 1) * 78, H / 2 - 193, 61, 61, 'levels_comic_v1/comic_star_v1');
      star.name = 'battleStar:' + i; if (i >= o.stars) star.getComponent(Sprite)!.color = C('#888D87');
    }
    text(p, 0, H / 2 - 242, `防线剩余 ${Math.round(o.ratio * 100)}%`, { size: 23, color: COMIC.sub, w: 540, h: 34 });
    this.tabs(p, ['奖励总览', '伤害统计'], tab, H / 2 - 296, t => this.showWin({ ...o, tab: t }));
    const top = H / 2 - 337, bodyH = H - 565;
    if (tab === 0) rewards(p, top, o.gold * (this.doubleState === 'claimed' ? 2 : 1), o.xp, '通关金币', this.doubleState === 'claimed' ? '双倍金币已领取' : '观看广告可再领取一份通关金币');
    else damageRows(p, this.dir.dmgSvc.rows(), top, 622, bodyH);
    const busy = this.doubleState === 'busy', claimed = this.doubleState === 'claimed';
    const ad = comicButton(p, 0, -H / 2 + 174, 622, 76, busy ? '广告加载中…' : claimed ? '双倍奖励已领取' : this.doubleState === 'failed' ? '重试领取双倍金币' : '看广告 · 双倍金币', () => {
      if (this.doubleState === 'busy' || this.doubleState === 'claimed') return;
      this.doubleState = 'busy'; this.showWin({ ...o });
      let settled = false;
      o.onDouble(ok => {
        if (settled || this.winKey !== o.onDouble) return; settled = true;
        this.doubleState = ok ? 'claimed' : 'failed';
        if (this.activePanel === 'win') this.showWin(this.winOptions!);
      });
    }, { name: 'battleDouble', tone: busy || claimed ? 'muted' : 'green', size: 28 });
    if (!claimed && !busy) glyph(ad.getChildByName('buttonFace')!, -249, 0, 'play', 29);
    comicButton(p, -159, -H / 2 + 78, 302, 78, '返回关卡', () => { if (!busy) o.onExit(); }, { name: 'battleExit', tone: 'dark', size: 29 });
    comicButton(p, 159, -H / 2 + 78, 302, 78, '下一关', () => { if (!busy) o.onNext(); }, { name: 'battleNext', tone: 'gold', size: 30 });
  }

  showLose(o: LoseOptions): void {
    if (this.reviveKey !== o.onRevive) { this.reviveKey = o.onRevive; this.reviveState = 'idle'; }
    this.loseOptions = o;
    const tab = o.tab ?? 0, H = this.height(850), p = this.surface('lose', H);
    comicArt(p, -239, H / 2 - 86, 106, 106, ART + 'comic_defeat_v1');
    text(p, 50, H / 2 - 80, '挑战失败', { size: 42, bold: true, color: '#884B3B', w: 394, h: 58 });
    text(p, 50, H / 2 - 129, '防线失守 · 整装再战', { size: 23, color: COMIC.sub, w: 394, h: 34 });
    this.tabs(p, ['奖励总览', '伤害统计'], tab, H / 2 - 192, t => this.showLose({ ...o, tab: t }));
    const top = H / 2 - 236, bodyH = H - 502;
    if (tab === 0) rewards(p, top, o.goldFloor, o.xp, '保底金币', '挑战失败保留 30% 金币收益');
    else damageRows(p, this.dir.dmgSvc.rows(), top, 622, bodyH);
    text(p, 0, -H / 2 + 234, `复活恢复 ${Math.round(o.reviveRatio * 100)}% 耐久 · 不限次数`, { size: 22, color: COMIC.sub, w: 610, h: 34 });
    const busy = this.reviveState === 'busy';
    const rv = comicButton(p, 0, -H / 2 + 173, 622, 76, busy ? '广告加载中…' : this.reviveState === 'failed' ? '重试广告复活' : '看广告 · 复活再战', () => {
      if (this.reviveState === 'busy') return;
      this.reviveState = 'busy'; this.showLose({ ...o });
      let settled = false;
      o.onRevive(ok => {
        if (settled || this.reviveKey !== o.onRevive) return; settled = true;
        this.reviveState = ok ? 'idle' : 'failed';
        if (!ok && this.activePanel === 'lose') this.showLose(this.loseOptions!);
      });
    }, { name: 'battleRevive', tone: busy ? 'muted' : 'green', size: 28 });
    if (!busy) glyph(rv.getChildByName('buttonFace')!, -249, 0, 'play', 29);
    comicButton(p, -159, -H / 2 + 77, 302, 78, '再来一次', () => { if (!busy) o.onRetry(); }, { name: 'battleRetry', tone: 'gold', size: 29 });
    comicButton(p, 159, -H / 2 + 77, 302, 78, '返回关卡', () => { if (!busy) o.onExit(); }, { name: 'battleExit', tone: 'dark', size: 29 });
  }

  /** A reading tip: transparent outside catcher, no pause, no darkened battlefield. */
  showStats(rows: DamageRow[]): void {
    this.closeAll();
    const catcher = N('statsCatch', this.modalRoot, 0, 0, 750, LO.half * 2 + 200);
    catcher.on(Node.EventType.TOUCH_END, () => this.closeAll());
    const w = 480, h = Math.min(126 + Math.max(1, rows.length) * 86, LO.half * 2 - 120);
    let x = WX(24, 60) + 30 + 16 + w / 2, y = WY(320, 60) + 30 - h / 2;
    x = Math.max(-375 + w / 2 + 8, Math.min(375 - w / 2 - 8, x));
    y = Math.max(-LO.half + h / 2 + 16, Math.min(LO.half - h / 2 - 16, y));
    const p = comicPlate(this.modalRoot, x, y, w, h, 'dark', { name: 'battleStatsTip' });
    p.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => { e.propagationStopped = true; });
    text(p, -114, h / 2 - 32, '伤害统计', { size: 26, bold: true, color: COMIC.cream, w: 210, h: 38, align: 'left' });
    text(p, 121, h / 2 - 32, '总计 ' + fmtWk(rows.reduce((n, r) => n + r.val, 0)), { size: 21, color: '#CCD4DE', w: 204, h: 34, align: 'right' });
    damageRows(p, rows, h / 2 - 67, w - 32, h - 108, true, true);
    text(p, 0, -h / 2 + 21, '点击空白处关闭', { size: 18, color: '#CCD4DE', w: w - 32, h: 28 });
  }
}
