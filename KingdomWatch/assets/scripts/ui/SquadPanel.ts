/** Comic formation overlay; squad order and the existing deploy/remove rules stay in GameData. */
import { Node } from 'cc';
import { LO } from '../config/GameConfig';
import { dimLayer, N, WY } from './UIKit';
import { artSprite } from './Ux';
import { COMIC, comicArt, comicButton, comicDialog, comicMark, comicPlate } from './ComicUI';
import { heroPortrait } from './HeroComic';
import { mainLabel, PageCtx, toast } from './PageKit';
import { HERO_DEFS, SQUAD_MAX, deployHero, inSquad, squadList, undeployHero } from '../core/GameData';
import { loadSave } from '../core/SaveData';

export function openSquadPanel(ctx: PageCtx): void {
  const root = ctx.screens.parent;
  if (!root || root.getChildByName('levelSquadOverlay')) return;
  const dim = dimLayer(root, 1);
  dim.name = 'levelSquadOverlay';
  dim.setSiblingIndex(root.children.length - 1);
  comicPlate(dim, 0, 0, 750, LO.half * 2 + 240, 'paper', { name: 'squadBackdrop', cut: 0, edge: false });
  const scene = N('squadUpperScene', dim, 0, WY(0, 440), 750, 440);
  artSprite(scene, 0, 0, 750, 440, 'scenes/bg_levels_comic_v1', { sliced: false, cover: true });
  const top = Math.max(48, LO.notchTop + 20);
  const close = (): void => { dim.destroy(); ctx.refresh(); };
  mainLabel(dim, 0, WY(top, 70), '出战编队', { size: 36, font: 'body', bold: true, color: COMIC.cream, outline: COMIC.ink, outlineW: 3, w: 290, h: 58 });
  const body = N('squadBody', dim);
  let removeModal: Node | null = null;
  rebuild();

  function rebuild(): void {
    body.destroyAllChildren();
    const sq = squadList(), sv = loadSave();
    const formTop = top + 108;
    const formation = comicPlate(body, 0, WY(formTop, 260), 704, 260, 'dark', { name: 'squadFormation' });
    comicArt(formation, -303, 98, 34, 34, 'comic_helm_falcon_v1');
    mainLabel(formation, -158, 97, '战斗站位', { size: 26, bold: true, color: COMIC.cream, w: 228, h: 38, align: 'left' });
    mainLabel(formation, 208, 97, '已上阵 ' + sq.length + '/' + SQUAD_MAX, { size: 23, color: '#DDE1E2', bold: true, w: 240, h: 34, align: 'right' });
    for (let i = 0; i < SQUAD_MAX; i++) {
      const hid = sq[i], x = (i - 1.5) * 170;
      const slot = comicPlate(formation, x, -21, 156, 192, hid ? 'card' : 'dark', { name: 'squadSlot:' + i });
      mainLabel(slot, -58, 75, String(i + 1), { size: 18, color: hid ? COMIC.sub : COMIC.muted, w: 28, h: 25 });
      if (hid) {
        const def = HERO_DEFS[hid];
        heroPortrait(slot, 0, 24, 96, hid);
        mainLabel(slot, 0, -43, def.name.replace('·', ''), { size: 23, color: COMIC.text, bold: true, w: 142, h: 32 });
        mainLabel(slot, 0, -73, 'Lv.' + (sv.heroes[hid]?.lv || 1), { size: 19, color: COMIC.sub, w: 128, h: 26 });
        comicMark(slot, 57, 69, 'check', 20, COMIC.greenShade);
        slot.on(Node.EventType.TOUCH_END, () => confirmRemove(hid));
      } else {
        comicMark(slot, 0, 12, 'plus', 42, '#687582');
        mainLabel(slot, 0, -56, '待上阵', { size: 22, color: '#ADB7BE', w: 134, h: 32 });
      }
    }
    mainLabel(body, 0, WY(formTop + 286, 32), '从左到右依次站位 · 点击已上阵英雄可下阵',
      { size: 22, color: COMIC.sub, w: 690, h: 32 });
    const barTop = formTop + 332;
    const bar = comicPlate(body, 0, WY(barTop, 290), 704, 290, 'paper', { name: 'squadHeroRoster' });
    comicArt(bar, -301, 113, 34, 34, 'comic_helm_falcon_v1');
    mainLabel(bar, -134, 112, '选择出战英雄', { size: 27, bold: true, color: COMIC.text, w: 276, h: 38, align: 'left' });
    Object.values(HERO_DEFS).forEach((def, i, defs) => {
      const dep = inSquad(def.id);
      const card = comicPlate(bar, (i - (defs.length - 1) / 2) * 134, -16, 126, 206,
        dep ? 'gold' : 'card', { name: 'squadHero:' + def.id });
      heroPortrait(card, 0, 37, 94, def.id);
      mainLabel(card, 0, -29, def.name.replace('·', ''), { size: 22, color: COMIC.text, bold: true, w: 114, h: 32 });
      mainLabel(card, 0, -59, 'Lv.' + (sv.heroes[def.id]?.lv || 1), { size: 18, color: COMIC.sub, w: 108, h: 26 });
      mainLabel(card, 0, -85, dep ? '已上阵' : '点击上阵', { size: 17, color: dep ? COMIC.greenShade : COMIC.sub, w: 116, h: 26 });
      if (dep) comicMark(card, 46, 78, 'check', 19, COMIC.greenShade);
      card.on(Node.EventType.TOUCH_END, () => {
        if (dep) { confirmRemove(def.id); return; }
        const result = deployHero(def.id);
        toast(result.msg);
        if (result.ok) rebuild();
      });
    });
    const noteTop = barTop + 320;
    mainLabel(body, 0, WY(noteTop, 36), '最多上阵 4 位英雄', { size: 26, bold: true, color: COMIC.text, w: 600, h: 36 });
    mainLabel(body, 0, WY(noteTop + 46, 32), '点击英雄加入编队，阵容自动保存', { size: 22, color: COMIC.sub, w: 650, h: 32 });
    comicButton(body, 0, WY(LO.half * 2 - LO.safeTop - LO.safeBottom - 126, 88), 390, 88,
      '完成编队', close, { tone: 'gold', size: 32, name: 'squadDone' });
  }

  function confirmRemove(hid: string): void {
    if (removeModal?.isValid) return;
    const panel = comicDialog(dim, 548, 360, '下阵确认');
    panel.name = 'squadRemoveDialog';
    const modal = panel.parent!;
    removeModal = modal;
    heroPortrait(panel, -165, 13, 100, hid);
    mainLabel(panel, 51, 29, '将 ' + HERO_DEFS[hid].name + ' 下阵？',
      { size: 25, color: COMIC.text, bold: true, w: 310, h: 40 });
    mainLabel(panel, 51, -21, '之后可以随时重新上阵', { size: 21, color: COMIC.sub, w: 312, h: 36 });
    comicButton(panel, -126, -114, 222, 76, '取消', () => modal.destroy(),
      { tone: 'dark', size: 28, name: 'squadRemoveCancel' });
    comicButton(panel, 126, -114, 222, 76, '确认下阵', () => {
      const result = undeployHero(hid);
      modal.destroy();
      toast(result.msg);
      if (result.ok) rebuild();
    }, { tone: 'green', size: 28, name: 'squadRemoveConfirm' });
  }
}
