/** Virtual regions reuse delivered PNGs instead of duplicating portrait and icon textures. */
export interface NewHeroFrame { source: string; rect: readonly [number, number, number, number]; }
export const NEW_HERO_FRAMES: Record<string, NewHeroFrame> = {};
for (const hero of ['cannon', 'siphon']) {
  const source = 'new_heroes_v105/' + hero + '_lobby';
  const face = hero === 'cannon' ? [310, 110, 330, 330] as const : [425, 110, 330, 330] as const;
  const weapon = hero === 'cannon' ? [355, 320, 620, 620] as const : [45, 15, 450, 450] as const;
  NEW_HERO_FRAMES['ui_avatar_' + hero] = { source, rect: face };
  NEW_HERO_FRAMES['new_heroes_v105/avatar_' + hero] = { source, rect: face };
  NEW_HERO_FRAMES['hero_comic_v1/comic_figure_' + hero + '_v1'] = { source, rect: [0, 0, 1024, 1536] };
  for (const slot of ['atk', 'skill', 'ult']) NEW_HERO_FRAMES['ui_icon_' + slot + '_' + hero] = { source, rect: slot === 'ult' ? face : weapon };
  for (const card of hero === 'cannon' ? ['echo', 'loader', 'knockback', 'barrage'] : ['twin', 'inherit', 'shred', 'extend'])
    NEW_HERO_FRAMES['ui_card_' + hero + '_' + card] = { source, rect: weapon };
}
// comicArt prefixes unqualified keys; both consumers share the same source pixels.
for (const key of Object.keys(NEW_HERO_FRAMES)) if (!key.includes('/'))
  NEW_HERO_FRAMES['shop_comic_v1/' + key] = NEW_HERO_FRAMES[key];
