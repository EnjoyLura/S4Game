/** Level lobby: illustrated terrain, joined difficulty tabs, one reward shelf and anchored actions. */
import { Graphics, Node, Sprite, UIOpacity, Vec3, director, tween } from 'cc';
import { LO } from '../../config/GameConfig';
import { C, CA, gpanel, N, WY } from '../UIKit';
import { artAtlasSprite, artSprite } from '../Ux';
import { mainLabel, PageCtx, toast, mainLayout, MAIN_RESOURCE_H } from '../PageKit';
import { CHEST_COND, claimChest, starKey, squadList } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { flow } from '../../core/Flow';
import { openSquadPanel } from '../SquadPanel';

const LEVELS = [
  { id: '1-1', name: '1-1 前哨', desc: '10 波 · 哥布林军团', art: '1' },
  { id: '1-2', name: '1-2 深林', desc: '10 波 · 深林伏兵', art: '2' },
  { id: '1-3', name: '1-3 兽穴', desc: '10 波 · 蛮兵巢穴', art: '3' },
];
const DIFFS = ['普通', '精英', '地狱'];
const st = { i: 0, d: 0 };

/** Chamfered wood and gold faces: shared by difficulty tabs, level plaques and actions. */
function plaque(parent: Node, x: number, y: number, w: number, h: number, gold = false, muted = false): Node {
  const node = N('levelPlaque', parent, x, y, w, h);
  const g = node.addComponent(Graphics);
  const shape = (inset: number, dy = 0): void => {
    const left = -w / 2 + inset, right = w / 2 - inset;
    const bottom = -h / 2 + inset + dy, top = h / 2 - inset + dy;
    const bevel = Math.min(14, h * 0.18);
    g.moveTo(left + bevel, top); g.lineTo(right - bevel, top);
    g.lineTo(right, top - bevel); g.lineTo(right, bottom + bevel);
    g.lineTo(right - bevel, bottom); g.lineTo(left + bevel, bottom);
    g.lineTo(left, bottom + bevel); g.lineTo(left, top - bevel); g.close();
  };
  g.fillColor = CA('#10170E', 0.65); shape(0, -4); g.fill();
  g.fillColor = C(gold ? '#9A5B12' : '#281B11'); shape(0); g.fill();
  g.fillColor = C(gold ? '#E6A632' : muted ? '#594D3C' : '#85603D'); shape(2); g.fill();
  g.fillColor = C(gold ? '#FFD05B' : muted ? '#3D382C' : '#4A3020'); shape(5); g.fill();
  g.strokeColor = CA(gold ? '#FFF0A2' : '#C89B61', gold ? 0.9 : 0.48);
  g.lineWidth = gold ? 2 : 1; shape(6); g.stroke();
  g.strokeColor = CA(gold ? '#FFF6BC' : '#C69A61', gold ? 0.18 : 0.1);
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const yy = -h * 0.27 + i * h * 0.12;
    g.moveTo(-w / 2 + 20, yy); g.lineTo(-w * 0.17, yy + 1.5);
    g.lineTo(w * 0.19, yy - 1); g.lineTo(w / 2 - 20, yy + 1); g.stroke();
  }
  return node;
}

function tap(node: Node, cb: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => node.setScale(0.97, 0.97, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(Vec3.ONE));
  node.on(Node.EventType.TOUCH_END, (event: { propagationStopped?: boolean }) => {
    node.setScale(Vec3.ONE);
    if (event) event.propagationStopped = true;
    cb();
  });
}

function swords(parent: Node, x: number, y: number, size: number, color: string): void {
  const g = N('crossedSwords', parent, x, y, size, size).addComponent(Graphics);
  for (const direction of [-1, 1]) {
    g.lineWidth = size * 0.14; g.strokeColor = C('#302312');
    g.moveTo(-direction * size * 0.32, -size * 0.32); g.lineTo(direction * size * 0.28, size * 0.34); g.stroke();
    g.lineWidth = size * 0.085; g.strokeColor = C(color);
    g.moveTo(-direction * size * 0.1, -size * 0.06); g.lineTo(direction * size * 0.28, size * 0.34); g.stroke();
    g.lineWidth = size * 0.09; g.strokeColor = C('#E6AB45');
    g.moveTo(-direction * size * 0.23, -size * 0.07); g.lineTo(direction * size * 0.01, -size * 0.28); g.stroke();
  }
}

function difficultyIcon(parent: Node, difficulty: number, active: boolean): void {
  const color = active ? '#6B4213' : '#D9BC88';
  if (difficulty === 1) { swords(parent, -61, 0, 35, color); return; }
  if (difficulty === 2) {
    artSprite(parent, -61, 0, 34, 34, 'ui_icon_skull', { onLoaded: node => { node.getComponent(Sprite)!.color = C('#CFBC9C'); } });
    return;
  }
  const g = N('shield', parent, -61, 0, 35, 40).addComponent(Graphics);
  g.fillColor = C(color);
  g.moveTo(-15, 15); g.lineTo(0, 20); g.lineTo(15, 15); g.lineTo(13, -3);
  g.lineTo(0, -19); g.lineTo(-13, -3); g.close(); g.fill();
  g.strokeColor = C(active ? '#FFE693' : '#5B4026'); g.lineWidth = 3;
  g.moveTo(0, 12); g.lineTo(0, -9); g.stroke();
  g.moveTo(-7, 4); g.lineTo(7, 4); g.stroke();
}

function ornament(parent: Node, y: number, gap: number, width: number): void {
  const g = N('goldOrnament', parent, 0, y).addComponent(Graphics);
  g.strokeColor = CA('#E5BA6A', 0.7); g.lineWidth = 1.5;
  for (const sign of [-1, 1]) {
    g.moveTo(sign * gap, 0); g.lineTo(sign * width, 0); g.stroke();
    const x = sign * (gap + 10);
    g.moveTo(x, 4); g.lineTo(x + 5, 0); g.lineTo(x, -4); g.lineTo(x - 5, 0); g.close(); g.stroke();
  }
}

function arrow(parent: Node, x: number, y: number, direction: number, cb: () => void): void {
  const node = N('switchLevel', parent, x, y, 72, 104);
  const g = node.addComponent(Graphics);
  for (const [width, opacity] of [[18, 0.16], [10, 0.24], [5, 1]]) {
    g.lineWidth = width; g.strokeColor = CA(width === 5 ? '#FFE293' : '#EBAF39', opacity);
    g.moveTo(-direction * 9, 25); g.lineTo(direction * 9, 0); g.lineTo(-direction * 9, -25); g.stroke();
  }
  tap(node, cb);
}

function squadIcon(parent: Node): void {
  const g = N('squadIcon', parent, 0, 18, 58, 38).addComponent(Graphics);
  for (const [x, y, radius] of [[-17, 2, 5], [17, 2, 5], [0, 6, 7]]) {
    g.fillColor = C(x === 0 ? '#FFDD85' : '#CDA15C');
    g.circle(x, y + 6, radius); g.fill();
    g.moveTo(x - radius - 3, y - 15); g.lineTo(x - radius, y - 3);
    g.lineTo(x + radius, y - 3); g.lineTo(x + radius + 3, y - 15); g.close(); g.fill();
  }
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
    const tabsTop = titleTop + (compact ? 104 : 114);
    const tabH = compact ? 56 : 62;
    const sceneTop = tabsTop + tabH + 14;
    const actionH = compact ? 84 : 94;
    const actionTop = bottom - actionH;
    const rewardH = compact ? 228 : 248;
    const rewardTop = actionTop - rewardH - 18;
    const selectorTop = rewardTop - 96;
    const sceneH = Math.max(1, selectorTop - 10 - sceneTop);

    // Soft scenery vignette keeps the title legible without reinstating a dashboard header.
    const titleShade = N('chapterShade', content, 0, WY(titleTop + 48)).addComponent(Graphics);
    for (let i = 0; i < 5; i++) {
      titleShade.fillColor = CA('#0B2119', 0.09);
      titleShade.ellipse(0, 0, 350 - i * 27, 89 - i * 11); titleShade.fill();
    }
    mainLabel(content, 0, WY(titleTop, 30), '第1章 · 腐朽森林', {
      size: 26, font: 'title', color: '#F6D992', w: 428, h: 30, outline: '#1B2414', outlineW: 2,
    });
    ornament(content, WY(titleTop + 15), 230, 304);
    mainLabel(content, 0, WY(titleTop + 34, 62), lv.name, {
      size: compact ? 48 : 56, font: 'title', color: '#FFE5AA', bold: true,
      w: 620, h: 66, outline: '#182116', outlineW: 3,
    });
    ornament(content, WY(tabsTop - 8), 10, 230);

    const difficultyBar = plaque(content, 0, WY(tabsTop, tabH), 686, tabH, false);
    DIFFS.forEach((name, d) => {
      const unlocked = diffUnlocked(st.i, d);
      const active = st.d === d;
      const slot = plaque(difficultyBar, (d - 1) * 224, 0, 222, tabH - 6, active, !unlocked);
      difficultyIcon(slot, d, active);
      mainLabel(slot, 9, 0, name, {
        size: 28, color: active ? '#412A12' : unlocked ? '#F3D7A2' : '#AB9E88', bold: true, w: 100, h: 40,
        outline: active ? undefined : '#271D12', outlineW: 1,
      });
      if (!unlocked) artSprite(slot, 78, 0, 20, 24, 'ui_icon_lock');
      tap(slot, () => {
        if (!unlocked) { toast(d === 0 ? '通关上一关解锁' : '通关上一难度解锁'); return; }
        if (st.d !== d) { st.d = d; render(); }
      });
    });

    const scene = N('terrainStage', content, 0, WY(sceneTop, sceneH), 750, sceneH);
    const terrainShade = N('terrainShade', scene).addComponent(Graphics);
    terrainShade.fillColor = CA('#0B2119', 0.3);
    terrainShade.ellipse(0, -sceneH * 0.08, 314, Math.min(sceneH * 0.4, 230)); terrainShade.fill();
    const loading = mainLabel(scene, 0, 0, '加载战场…', { size: 22, color: '#F3D7A2', w: 300, h: 34, outline: '#142516', outlineW: 2 });
    const island = artAtlasSprite(scene, 0, 0, 680, Math.min(sceneH, 714), 'lobby_levels_v1', lv.art, { hideOnLoad: [loading] });
    if (!open) {
      island.addComponent(UIOpacity).opacity = 155;
      const locked = gpanel(scene, 0, -sceneH / 2 + 40, 310, 52, CA('#202B1C', 0.9), undefined, 0, 8);
      artSprite(locked, -119, 0, 24, 28, 'ui_icon_lock');
      mainLabel(locked, 16, 0, `通关 ${LEVELS[st.i - 1].id} 解锁`, { size: 22, color: '#E2D4B6', w: 250, h: 36 });
    }
    arrow(scene, -330, 0, -1, () => selectLevel((st.i + LEVELS.length - 1) % LEVELS.length));
    arrow(scene, 330, 0, 1, () => selectLevel((st.i + 1) % LEVELS.length));

    const selectors = N('levelSelectors', content, 0, WY(selectorTop, 48), 524, 48);
    const chain = selectors.addComponent(Graphics);
    chain.strokeColor = CA('#C5984F', 0.65); chain.lineWidth = 3;
    chain.moveTo(-180, 0); chain.lineTo(180, 0); chain.stroke();
    LEVELS.forEach((level, i) => {
      const active = st.i === i, unlocked = levelOpen(i);
      const item = plaque(selectors, (i - 1) * 166, 0, 150, 48, active, !unlocked);
      mainLabel(item, unlocked ? 0 : -9, 0, level.id, {
        size: 26, bold: true, color: active ? '#4B2E12' : '#E8D3B0', w: 94, h: 36,
        outline: active ? undefined : '#261D11', outlineW: 2,
      });
      if (!unlocked) artSprite(item, 47, 0, 18, 22, 'ui_icon_lock');
      tap(item, () => { if (!active) selectLevel(i); });
    });
    mainLabel(content, 0, WY(selectorTop + 55, 30), lv.desc, {
      size: 23, color: '#FFE7B4', w: 446, h: 32, outline: '#132417', outlineW: 2,
    });
    ornament(content, WY(selectorTop + 71), 235, 307);

    // One illustrated shelf; every chest and status reads the currently selected difficulty's save.
    const rewards = N('rewardShelf', content, 0, WY(rewardTop, rewardH), 712, rewardH);
    const fallback = gpanel(rewards, 0, 0, 708, rewardH, '#483822', undefined, 0, 8);
    artAtlasSprite(rewards, 0, 0, 712, rewardH, 'lobby_rewards_v1', 'shelf', { fit: false, hideOnLoad: [fallback] });
    const ry = (top: number): number => rewardH / 2 - top;
    mainLabel(rewards, -191, ry(28), '通关奖励', {
      size: 26, font: 'title', color: '#FFE5A5', w: 260, h: 38, align: 'left', outline: '#251A0E', outlineW: 2,
    });
    mainLabel(rewards, 154, ry(28), `${stars}/3 星`, { size: 21, color: '#FFE4AC', w: 80, h: 30, outline: '#251A0E', outlineW: 1 });
    for (let i = 0; i < 3; i++) artSprite(rewards, 215 + i * 37, ry(27), 33, 33, i < stars ? 'ui_star' : 'ui_star_gray');

    const chestFoot = rewardH - 64;
    for (let t = 0; t < 3; t++) {
      const tier = t + 1, canClaim = stars >= tier && claimed < tier, done = claimed >= tier;
      const spot = N('rewardTier' + tier, rewards, (t - 1) * 220, 0, 204, rewardH);
      if (canClaim) {
        const aura = N('chestAura', spot, 0, ry(chestFoot - 48));
        const glow = aura.addComponent(Graphics);
        for (let i = 0; i < 5; i++) {
          glow.fillColor = CA('#FFD46A', 0.045);
          glow.ellipse(0, 0, 94 - i * 11, 78 - i * 10); glow.fill();
        }
        const opacity = aura.addComponent(UIOpacity);
        tween(opacity).to(0.9, { opacity: 110 }).to(0.9, { opacity: 255 }).union().repeatForever().start();
      }
      const chestH = compact ? 116 : 134;
      const fallbackChest = artSprite(spot, 0, ry(chestFoot) + chestH / 2, 116, chestH, 'ui_icon_chest');
      artAtlasSprite(spot, 0, ry(chestFoot), 156, chestH, 'lobby_rewards_v1', done ? 'claimed' : canClaim ? 'ready' : 'locked', {
        anchorBottom: true, hideOnLoad: [fallbackChest],
      });
      if (done) {
        const check = gpanel(spot, 37, ry(chestFoot - 22), 34, 34, '#365F24', '#C5DB79', 2, 17);
        mainLabel(check, 0, 0, '✓', { size: 24, color: '#DEEF9F', bold: true, w: 26, h: 28 });
      }
      if (canClaim) gpanel(spot, 65, ry(chestFoot - chestH + 14), 17, 17, '#E74631', '#FFE2A3', 2, 9);
      mainLabel(spot, 0, ry(rewardH - 42), done ? '已领取' : canClaim ? '点击领取' : '未达成', {
        size: 21, color: done ? '#B8E984' : canClaim ? '#FFE58D' : '#B9B5A8', bold: true,
        w: 194, h: 28, outline: '#251F13', outlineW: 2,
      });
      mainLabel(spot, 0, ry(rewardH - 16), CHEST_COND[t], {
        size: 18, color: '#F3DFB6', w: 206, h: 24, outline: '#282216', outlineW: 1,
      });
      if (canClaim) spot.on(Node.EventType.TOUCH_END, () => {
        const result = claimChest(key, stars, tier);
        toast(result.msg);
        if (result.ok) ctx.refresh();
      });
    }

    const battle = plaque(content, -91, WY(actionTop, actionH), 490, actionH, open, !open);
    if (open) {
      swords(battle, -164, 0, 60, '#FFF0C7');
      mainLabel(battle, 38, 0, '开始战斗', { size: 43, font: 'title', color: '#422711', bold: true, w: 306, h: 66 });
      tap(battle, () => {
        if (!squadList().length) { toast('请先上阵英雄'); return; }
        flow.mode = 'battle'; flow.levelId = lv.id; flow.diff = st.d;
        director.loadScene('Main');
      });
    } else {
      mainLabel(battle, 0, 0, `通关 ${LEVELS[st.i - 1].id} 解锁`, { size: 27, color: '#C2BBA5', bold: true, w: 438, h: 48 });
    }
    const squad = plaque(content, 253, WY(actionTop, actionH), 156, actionH);
    squadIcon(squad);
    mainLabel(squad, 0, -24, '编队', { size: 25, font: 'title', color: '#FFE0A0', bold: true, w: 130, h: 36, outline: '#251A0E', outlineW: 1 });
    tap(squad, () => openSquadPanel(ctx));
  }
  render();
}
