/** Comic expedition lobby: illustrated battlefields and shared, single-contour controls. */
import { Graphics, Node, Sprite, UIOpacity, UITransform, Vec3, director } from 'cc';
import { LO } from '../../config/GameConfig';
import { C, CA, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicMark, comicPlate } from '../ComicUI';
import { heroGlyph } from '../HeroComic';
import { mainLabel, PageCtx, toast, mainLayout, MAIN_RESOURCE_H } from '../PageKit';
import { CHEST_COND, claimChest, starKey, squadList } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { flow } from '../../core/Flow';
import { openSquadPanel } from '../SquadPanel';

const LEVELS = [
  { id: '1-1', name: '1-1 前哨', desc: '10 波 · 哥布林军团', art: 'outpost' },
  { id: '1-2', name: '1-2 深林', desc: '10 波 · 深林伏兵', art: 'forest' },
  { id: '1-3', name: '1-3 兽穴', desc: '10 波 · 蛮兵巢穴', art: 'lair' },
];
const DIFFS = ['普通', '精英', '地狱'];
const DIFFICULTY_ART = ['comic_difficulty_shield_v1', 'comic_swords_v1', 'comic_difficulty_skull_v1'];
const st = { i: 0, d: 0 };

function levelArt(parent: Node, x: number, y: number, w: number, h: number, key: string): Node {
  return comicArt(parent, x, y, w, h, 'levels_comic_v1/' + key);
}
function tap(node: Node, cb: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => node.setScale(.97, .97, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(Vec3.ONE));
  node.on(Node.EventType.TOUCH_END, (event: { propagationStopped?: boolean }) => {
    node.setScale(Vec3.ONE);
    if (event) event.propagationStopped = true;
    cb();
  });
}
function star(parent: Node, x: number, y: number, size: number, earned: boolean): void {
  const art = artSprite(parent, x, y, size, size, 'levels_comic_v1/comic_star_v1', {
    sliced: false, onLoaded: n => { if (!earned) n.getComponent(Sprite)!.color = C(COMIC.muted); },
  });
  if (!earned) {
    art.addComponent(UIOpacity).opacity = 95;
  }
}
function switchArrow(parent: Node, x: number, direction: 'left' | 'right', cb: () => void): void {
  const hit = N('levelSwitch:' + direction, parent, x, 0, 76, 100);
  heroGlyph(hit, 0, 0, direction, 68);
  tap(hit, cb);
}

export function buildLevels(ctx: PageCtx): void {
  const content = N('levelLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  function levelOpen(i: number): boolean {
    return i === 0 || (loadSave().stars[starKey(LEVELS[i - 1].id, 0)] || 0) >= 1;
  }
  function diffUnlocked(i: number, d: number): boolean {
    return d === 0 ? levelOpen(i) : (loadSave().stars[starKey(LEVELS[i].id, d - 1)] || 0) >= 1;
  }
  function selectLevel(i: number): void {
    st.i = i;
    while (st.d > 0 && !diffUnlocked(st.i, st.d)) st.d--;
    render();
  }
  function render(): void {
    content.destroyAllChildren();
    const sv = loadSave(), lv = LEVELS[st.i], open = levelOpen(st.i);
    const key = starKey(lv.id, st.d), stars = sv.stars[key] || 0, claimed = sv.chestClaimed[key] || 0;
    const { headerTop, bottom } = mainLayout();
    const compact = LO.half * 2 < 1450;
    const titleTop = headerTop + MAIN_RESOURCE_H + 18;
    const tabsTop = titleTop + (compact ? 98 : 110);
    const tabH = compact ? 62 : 68;
    const sceneTop = tabsTop + tabH + 14;
    const actionH = compact ? 92 : 100;
    const actionTop = bottom - actionH;
    const rewardH = compact ? 218 : 240;
    const rewardTop = actionTop - rewardH - 16;
    const selectorTop = rewardTop - 108;
    const sceneH = Math.max(1, selectorTop - 12 - sceneTop);

    // This scene ends at the reward dock: illustration never leaks behind paper or navigation.
    const upper = N('levelUpperScene', content, 0, WY(0, rewardTop), 750, rewardTop);
    artSprite(upper, 0, 0, 750, rewardTop, 'scenes/bg_levels_comic_v1', { sliced: false, cover: true });
    mainLabel(content, 0, WY(titleTop, 28), '第1章 · 腐朽森林', {
      size: 25, color: '#F5DA9B', w: 460, h: 30, outline: COMIC.ink, outlineW: 2,
    });
    const title = mainLabel(content, 0, WY(titleTop + 32, 58), lv.name, {
      size: compact ? 46 : 52, font: 'body', color: COMIC.cream, bold: true,
      w: 620, h: 62, outline: COMIC.ink, outlineW: 3,
    });
    title.name = 'levelTitle';

    const difficultyBar = N('levelDifficultyBar', content, 0, WY(tabsTop, tabH), 686, tabH);
    DIFFS.forEach((name, d) => {
      const unlocked = diffUnlocked(st.i, d), active = st.d === d;
      const slot = comicPlate(difficultyBar, (d - 1) * 232, 0, 222, tabH, active ? 'gold' : 'dark',
        { name: 'levelDifficulty:' + d });
      levelArt(slot, -65, 0, 42, 42, DIFFICULTY_ART[d]);
      mainLabel(slot, 7, 0, name, {
        size: 29, color: active ? COMIC.text : unlocked ? COMIC.cream : COMIC.muted,
        bold: true, w: 94, h: 42,
      });
      if (!unlocked) comicMark(slot, 80, 0, 'lock', 20, COMIC.muted);
      tap(slot, () => {
        if (!unlocked) { toast(d === 0 ? '通关上一关解锁' : '通关上一难度解锁'); return; }
        if (st.d !== d) { st.d = d; render(); }
      });
    });

    const scene = N('terrainStage', content, 0, WY(sceneTop, sceneH), 750, sceneH);
    const ground = N('terrainGround', scene);
    const loading = mainLabel(scene, 0, 0, '加载战场…', { size: 22, color: COMIC.cream, w: 300, h: 34, outline: COMIC.ink, outlineW: 2 });
    const island = artSprite(scene, 0, 0, 612, Math.min(sceneH - 8, 612),
      'levels_comic_v1/comic_terrain_' + lv.art + '_v1', {
        sliced: false, hideOnLoad: [loading], onLoaded: art => {
          const t = art.getComponent(UITransform)!, sourceH = art.getComponent(Sprite)!.spriteFrame!.rect.height;
          ground.setPosition(0, -t.height / 2 + t.height * 24 / sourceH + 9, 0);
          const shadow = ground.addComponent(Graphics);
          shadow.fillColor = CA(COMIC.ink, .18);
          shadow.ellipse(0, 0, t.width * .38, 18); shadow.fill();
        },
      });
    island.name = 'levelTerrain:' + lv.id;
    if (!open) {
      island.addComponent(UIOpacity).opacity = 170;
      const locked = comicPlate(scene, 0, -sceneH / 2 + 30, 314, 48, 'dark', { name: 'levelLockedHint' });
      comicMark(locked, -123, 0, 'lock', 22);
      mainLabel(locked, 16, 0, '通关 ' + LEVELS[st.i - 1].id + ' 解锁', { size: 22, color: COMIC.cream, w: 258, h: 34 });
    }
    switchArrow(scene, -330, 'left', () => selectLevel((st.i + LEVELS.length - 1) % LEVELS.length));
    switchArrow(scene, 330, 'right', () => selectLevel((st.i + 1) % LEVELS.length));

    const selectors = N('levelSelectors', content, 0, WY(selectorTop, 62), 558, 62);
    const chain = selectors.addComponent(Graphics);
    chain.strokeColor = C('#C8A66C'); chain.lineWidth = 3;
    chain.moveTo(-186, 0); chain.lineTo(186, 0); chain.stroke();
    LEVELS.forEach((level, i) => {
      const active = st.i === i, unlocked = levelOpen(i);
      const item = comicPlate(selectors, (i - 1) * 186, 0, 164, 62, active ? 'gold' : 'dark',
        { name: 'levelSelect:' + level.id });
      mainLabel(item, unlocked ? 0 : -12, 0, level.id, {
        size: 28, bold: true, color: active ? COMIC.text : COMIC.cream, w: 104, h: 40,
      });
      if (!unlocked) comicMark(item, 52, 0, 'lock', 20, active ? COMIC.text : COMIC.muted);
      tap(item, () => { if (!active) selectLevel(i); });
    });
    mainLabel(content, 0, WY(selectorTop + 72, 30), lv.desc, {
      size: 23, color: COMIC.cream, w: 530, h: 32, outline: COMIC.ink, outlineW: 2,
    });

    const rewards = comicPlate(content, 0, WY(rewardTop, rewardH), 718, rewardH, 'paper',
      { name: 'rewardShelf', cut: 14 });
    const ry = (top: number): number => rewardH / 2 - top;
    levelArt(rewards, -311, ry(28), 32, 32, 'comic_chest_closed_v1');
    mainLabel(rewards, -180, ry(28), '通关奖励', {
      size: 27, color: COMIC.text, bold: true, w: 220, h: 36, align: 'left',
    });
    mainLabel(rewards, 147, ry(28), stars + '/3 星', { size: 22, color: COMIC.sub, w: 88, h: 30 });
    for (let i = 0; i < 3; i++) star(rewards, 218 + i * 36, ry(27), 31, i < stars);
    const divider = N('rewardDivider', rewards).addComponent(Graphics);
    divider.strokeColor = C(COMIC.paperShade); divider.lineWidth = 1;
    divider.moveTo(-328, ry(53)); divider.lineTo(328, ry(53)); divider.stroke();
    for (let t = 0; t < 3; t++) {
      const tier = t + 1, canClaim = stars >= tier && claimed < tier, done = claimed >= tier;
      const spot = N('rewardTier' + tier, rewards, (t - 1) * 222, ry(compact ? 124 : 133), 210, rewardH - 54);
      const chestH = compact ? 91 : 111;
      const chest = levelArt(spot, 0, 19, 122, chestH, done ? 'comic_chest_open_v1' : 'comic_chest_closed_v1');
      if (!done && !canClaim) {
        chest.addComponent(UIOpacity).opacity = 120;
        comicMark(spot, 43, 5, 'lock', 23, COMIC.sub);
      }
      if (done) comicMark(spot, 56, 15, 'check', 24, COMIC.greenShade);
      if (canClaim) {
        const dot = N('rewardReady', spot, 58, chestH / 2 + 10).addComponent(Graphics);
        dot.fillColor = C('#DF5538'); dot.circle(0, 0, 7); dot.fill();
        dot.strokeColor = C(COMIC.card); dot.lineWidth = 2; dot.stroke();
      }
      mainLabel(spot, 0, -(compact ? 45 : 54), done ? '已领取' : canClaim ? '点击领取' : '未达成', {
        size: 22, color: done ? COMIC.greenShade : canClaim ? '#895016' : COMIC.sub, bold: true, w: 200, h: 30,
      });
      mainLabel(spot, 0, -(compact ? 74 : 84), CHEST_COND[t], { size: 20, color: COMIC.sub, w: 208, h: 26 });
      if (canClaim) tap(spot, () => {
        const result = claimChest(key, stars, tier);
        toast(result.msg);
        if (result.ok) ctx.refresh();
      });
    }

    const battle = comicButton(content, -91, WY(actionTop, actionH), 490, actionH, '', () => {
      if (!open) return;
      if (!squadList().length) { toast('请先上阵英雄'); return; }
      flow.mode = 'battle'; flow.levelId = lv.id; flow.diff = st.d;
      director.loadScene('Main');
    }, { tone: open ? 'gold' : 'muted', name: 'levelBattle' });
    if (open) {
      levelArt(battle, -161, 0, 62, 62, 'comic_swords_v1');
      mainLabel(battle, 30, 0, '开始战斗', { size: 42, font: 'body', color: COMIC.text, bold: true, w: 318, h: 60 });
    } else {
      comicMark(battle, -178, 0, 'lock', 30, COMIC.sub);
      mainLabel(battle, 20, 0, '通关 ' + LEVELS[st.i - 1].id + ' 解锁', { size: 27, color: COMIC.text, bold: true, w: 400, h: 44 });
    }
    const squad = comicButton(content, 253, WY(actionTop, actionH), 156, actionH, '', () => openSquadPanel(ctx),
      { tone: 'dark', name: 'levelSquad' });
    comicArt(squad, -36, 9, 43, 43, 'comic_helm_falcon_v1');
    mainLabel(squad, 23, 10, '编队', { size: 26, bold: true, color: COMIC.cream, w: 84, h: 36 });
    mainLabel(squad, 0, -27, squadList().length + '/4 已上阵', { size: 18, color: '#C8CFD3', w: 144, h: 26 });
  }
  render();
}
