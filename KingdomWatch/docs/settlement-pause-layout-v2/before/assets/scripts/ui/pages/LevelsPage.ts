/** Continuous outdoor scenery, a draggable route, and a reward dock that owns its space. */
import { Graphics, Mask, Node, ScrollView, Sprite, UIOpacity, UITransform, Vec2, director } from 'cc';
import { LO } from '../../config/GameConfig';
import { C, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicButtonControl, comicMark, comicPlate } from '../ComicUI';
import { mainLabel, PageCtx, toast, mainLayout, MAIN_RESOURCE_H } from '../PageKit';
import { CHEST_COND, CHEST_REWARD, claimChest, starKey, squadList } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { flow } from '../../core/Flow';
import { openSquadPanel } from '../SquadPanel';
import { bindButton } from '../ButtonFeedback';
import { refreshUI } from '../UIMotion';
import { enterBattle, enteringBattle } from '../BattleEntry';
import { warmBattlefield } from '../BattleEntryWarmup';

const LEVELS = [
  { id: '1-1', name: '1-1 前哨', short: '前哨', desc: '10 波 · 哥布林军团', art: 'outpost' },
  { id: '1-2', name: '1-2 深林', short: '深林', desc: '10 波 · 深林伏兵', art: 'forest' },
  { id: '1-3', name: '1-3 兽穴', short: '兽穴', desc: '10 波 · 蛮兵巢穴', art: 'lair' },
];
// Only the first three levels have battle definitions. Later stops cannot start fallback battles.
const ROUTE = [...LEVELS, { id: '1-4', short: '待开放' }, { id: '1-5', short: '待开放' }];
const DIFFS = ['普通', '精英', '地狱'];
const DIFFICULTY_ART = ['comic_difficulty_shield_v1', 'comic_swords_v1', 'comic_difficulty_skull_v1'];
const st = { i: 0, d: 0, routeOffset: 0 };

function levelArt(parent: Node, x: number, y: number, w: number, h: number, key: string): Node {
  return comicArt(parent, x, y, w, h, 'levels_comic_v1/' + key);
}
function tap(node: Node, cb: () => void): void {
  bindButton(node, cb);
}
function star(parent: Node, x: number, y: number, size: number, earned: boolean): void {
  const art = artSprite(parent, x, y, size, size, 'levels_comic_v1/comic_star_v1', {
    sliced: false, onLoaded: n => { if (!earned) n.getComponent(Sprite)!.color = C(COMIC.muted); },
  });
  if (!earned) art.addComponent(UIOpacity).opacity = 95;
}
/** Let ScrollView capture moves. Cancelled or dragged presses must never select a route stop. */
function routeTap(node: Node, cb: () => void): void {
  bindButton(node, cb, { dragThreshold: 7 });
}

export function buildLevels(ctx: PageCtx): void {
  const content = N('levelLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  function levelOpen(i: number): boolean {
    return i < LEVELS.length && (i === 0 || (loadSave().stars[starKey(LEVELS[i - 1].id, 0)] || 0) >= 1);
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
    refreshUI(content, () => {
      const sv = loadSave(), lv = LEVELS[st.i], open = levelOpen(st.i);
      const key = starKey(lv.id, st.d), stars = sv.stars[key] || 0, claimed = sv.chestClaimed[key] || 0;
      const { headerTop, bottom } = mainLayout(), height = LO.half * 2;
      const titleTop = headerTop + MAIN_RESOURCE_H + 14;
      const tabsTop = titleTop + 78, tabH = 62, sceneTop = tabsTop + tabH + 12;
      const actionH = 94, actionTop = bottom - actionH;
      // The reward content owns real vertical space instead of being squeezed under an expanding diorama.
      const rewardH = Math.min(420, Math.max(316, height * .27));
      const rewardTop = actionTop - rewardH - 14, selectorTop = rewardTop - 120;
      const sceneH = Math.max(1, selectorTop - 12 - sceneTop);

      const upper = N('levelUpperScene', content, 0, WY(0, rewardTop), 750, rewardTop);
      const terrain = artSprite(upper, 0, 0, 750, rewardTop,
        'scenes/bg_levels_' + lv.art + '_comic_v2', { sliced: false, cover: true });
      terrain.name = 'levelTerrain:' + lv.id;
      mainLabel(content, 0, WY(titleTop, 26), '第1章 · 腐朽森林', {
        size: 23, color: '#F5DA9B', w: 460, h: 28, outline: COMIC.ink, outlineW: 2,
      });
      const title = mainLabel(content, 0, WY(titleTop + 28, 44), lv.name, {
        size: 42, font: 'body', color: COMIC.cream, bold: true,
        w: 620, h: 44, outline: COMIC.ink, outlineW: 3,
      });
      title.name = 'levelTitle';

      const difficultyBar = N('levelDifficultyBar', content, 0, WY(tabsTop, tabH), 686, tabH);
      DIFFS.forEach((name, d) => {
        const unlocked = diffUnlocked(st.i, d), active = st.d === d;
        const slot = comicPlate(difficultyBar, (d - 1) * 232, 0, 222, tabH, active ? 'gold' : 'dark',
          { name: 'levelDifficulty:' + d });
        levelArt(slot, -65, 0, 40, 40, DIFFICULTY_ART[d]);
        mainLabel(slot, 7, 0, name, {
          size: 28, color: active ? COMIC.text : unlocked ? COMIC.cream : COMIC.muted,
          bold: true, w: 94, h: 40,
        });
        if (!unlocked) comicMark(slot, 80, 0, 'lock', 20, COMIC.muted);
        tap(slot, () => {
          if (!unlocked) { toast(d === 0 ? '通关上一关解锁' : '通关上一难度解锁'); return; }
          if (st.d !== d) { st.d = d; render(); }
        });
      });

      const scene = N('terrainStage', content, 0, WY(sceneTop, sceneH), 750, sceneH);
      if (!open) {
        const locked = comicPlate(scene, 0, -sceneH / 2 + 30, 314, 48, 'dark', { name: 'levelLockedHint' });
        comicMark(locked, -123, 0, 'lock', 22);
        mainLabel(locked, 16, 0, '通关 ' + LEVELS[st.i - 1].id + ' 解锁', { size: 22, color: COMIC.cream, w: 258, h: 34 });
      }

      const viewW = 704, viewH = 80, pitch = 180, itemW = 164, pad = 8;
      const routeW = pad * 2 + (ROUTE.length - 1) * pitch + itemW;
      const maxOffset = routeW - viewW;
      const view = N('levelSelectors', content, 0, WY(selectorTop, viewH), viewW, viewH);
      view.addComponent(Mask);
      const scroll = view.addComponent(ScrollView);
      const route = N('levelRouteContent', view, -viewW / 2, 0, routeW, viewH);
      route.getComponent(UITransform)!.setAnchorPoint(0, .5);
      scroll.horizontal = true; scroll.vertical = false;
      scroll.inertia = true; scroll.brake = .65; scroll.elastic = false;
      scroll.cancelInnerEvents = true; scroll.content = route;
      const remember = (): void => { st.routeOffset = Math.min(maxOffset, Math.max(0, -scroll.getScrollOffset().x)); };
      view.on('scrolling', remember);
      view.on('scroll-ended', remember);
      ROUTE.forEach((level, i) => {
        const active = st.i === i, available = i < LEVELS.length, unlocked = available && levelOpen(i);
        const item = comicPlate(route, pad + itemW / 2 + i * pitch, 0, itemW, 74, active ? 'gold' : 'dark',
          { name: 'levelSelect:' + level.id });
        mainLabel(item, unlocked ? 0 : -10, 13, level.id, {
          size: 27, bold: true, color: active ? COMIC.text : available ? COMIC.cream : COMIC.muted, w: 100, h: 32,
        });
        mainLabel(item, 0, -20, level.short, { size: 18, color: active ? COMIC.text : '#C8CFD3', w: 144, h: 26 });
        if (!unlocked) comicMark(item, 53, 13, 'lock', 18, active ? COMIC.text : COMIC.muted);
        routeTap(item, () => {
          if (!available) { toast('后续关卡即将开放'); return; }
          if (!active) selectLevel(i);
        });
      });
      scroll.scrollToOffset(new Vec2(Math.min(maxOffset, st.routeOffset), 0), 0);
      mainLabel(content, -116, WY(selectorTop + 88, 24), lv.desc, {
        size: 21, color: COMIC.cream, w: 450, h: 26, outline: COMIC.ink, outlineW: 2,
      });
      mainLabel(content, 239, WY(selectorTop + 88, 24), '左右滑动选关', {
        size: 18, color: COMIC.cream, w: 220, h: 26, outline: COMIC.ink, outlineW: 2,
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
      const bodyTop = 66, bodyH = rewardH - bodyTop - 14;
      for (let t = 0; t < 3; t++) {
        const tier = t + 1, canClaim = stars >= tier && claimed < tier, done = claimed >= tier;
        const spot = N('rewardTier' + tier, rewards, (t - 1) * 222, ry(bodyTop + bodyH / 2), 210, bodyH);
        const sy = (top: number): number => bodyH / 2 - top;
        const condition = mainLabel(spot, 0, sy(22), CHEST_COND[t], { size: 20, color: COMIC.sub, w: 208, h: 28 });
        condition.name = 'rewardCondition' + tier;
        const chestH = Math.min(126, bodyH * .4), chestCenter = bodyH * .39;
        const chest = levelArt(spot, 0, sy(chestCenter), 148, chestH, done ? 'comic_chest_open_v1' : 'comic_chest_closed_v1');
        chest.name = 'rewardChest' + tier;
        if (!done && !canClaim) {
          chest.addComponent(UIOpacity).opacity = 120;
          comicMark(spot, 48, sy(chestCenter + 10), 'lock', 23, COMIC.sub);
        }
        if (done) comicMark(spot, 62, sy(chestCenter + 14), 'check', 24, COMIC.greenShade);
        if (canClaim) {
          const dot = N('rewardReady', spot, 66, sy(chestCenter - chestH / 2 + 7)).addComponent(Graphics);
          dot.fillColor = C('#DF5538'); dot.circle(0, 0, 7); dot.fill();
          dot.strokeColor = C(COMIC.card); dot.lineWidth = 2; dot.stroke();
        }
        const reward: { gold?: number; diamonds?: number } = CHEST_REWARD[t];
        const valueTop = chestCenter + chestH / 2 + 25;
        comicArt(spot, -39, sy(valueTop), 28, 28, reward.gold ? 'comic_coin_v1' : 'comic_diamond_v1');
        const amount = mainLabel(spot, 17, sy(valueTop), String(reward.gold || reward.diamonds), {
          size: 24, color: COMIC.text, bold: true, w: 82, h: 30,
        });
        amount.name = 'rewardAmount' + tier;
        const claim = comicPlate(spot, 0, sy(bodyH - 30), 184, 44, canClaim ? 'gold' : done ? 'paper' : 'muted',
          { name: 'rewardStatus' + tier, edge: !done });
        mainLabel(claim, 0, 0, done ? '已领取' : canClaim ? '点击领取' : '未达成', {
          size: 22, color: done ? COMIC.greenShade : canClaim ? COMIC.text : COMIC.sub, bold: true, w: 172, h: 32,
        });
        if (canClaim) tap(spot, () => {
          const result = claimChest(key, stars, tier);
          toast(result.msg, { kind: result.ok ? 'reward' : 'warning', title: result.ok ? '星级宝箱已领取' : '暂时无法领取',
            icon: result.ok ? 'shop_comic_v1/' + (reward.gold ? 'comic_coin_v1' : 'comic_diamond_v1') : undefined });
          if (result.ok) ctx.refresh();
        });
      }

      const restoreBattleEntry = (): void => {
        flow.mode = 'main';
        if (!battleControl.node.isValid) return;
        toast('进入战斗失败，请重试', { kind: 'warning', title: '进入战斗失败' });
      };
      const battleControl = comicButtonControl(content, -91, WY(actionTop, actionH), 490, actionH, '', () => {
        if (!open || enteringBattle()) return;
        if (!squadList().length) { toast('请先上阵英雄'); return; }
        enterBattle(done => {
          flow.mode = 'battle'; flow.levelId = lv.id; flow.diff = st.d;
          return director.loadScene('Main', done);
        }, restoreBattleEntry, warmBattlefield(lv.id, squadList()));
      }, { tone: open ? 'gold' : 'muted', name: 'levelBattle', enabled: open });
      const battle = battleControl.node;
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
      if (open) void warmBattlefield(lv.id, squadList());
    });
  }
  render();
}
