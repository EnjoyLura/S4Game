/** Circular painted icons share three atlases; full hero figures retain their existing sources. */
export interface NewHeroFrame { source: string; rect: readonly [number, number, number, number]; }
export const NEW_HERO_FRAMES: Record<string, NewHeroFrame> = {
  "ui_avatar_cannon": { source: "new_hero_icons_v117/icon_core", rect: [4, 4, 504, 504] },
  "ui_avatar_siphon": { source: "new_hero_icons_v117/icon_core", rect: [516, 4, 504, 504] },
  "ui_icon_atk_cannon": { source: "new_hero_icons_v117/icon_core", rect: [1028, 4, 504, 504] },
  "ui_icon_skill_cannon": { source: "new_hero_icons_v117/icon_core", rect: [1540, 4, 504, 504] },
  "ui_icon_ult_cannon": { source: "new_hero_icons_v117/icon_core", rect: [4, 516, 504, 504] },
  "ui_icon_atk_siphon": { source: "new_hero_icons_v117/icon_core", rect: [516, 516, 504, 504] },
  "ui_icon_skill_siphon": { source: "new_hero_icons_v117/icon_core", rect: [1028, 516, 504, 504] },
  "ui_icon_ult_siphon": { source: "new_hero_icons_v117/icon_core", rect: [1540, 516, 504, 504] },
  "ui_card_cannon_echo": { source: "new_hero_icons_v117/cannon_cards", rect: [4, 4, 504, 504] },
  "ui_card_cannon_loader": { source: "new_hero_icons_v117/cannon_cards", rect: [516, 4, 504, 504] },
  "ui_card_cannon_knockback": { source: "new_hero_icons_v117/cannon_cards", rect: [1028, 4, 504, 504] },
  "ui_card_cannon_barrage": { source: "new_hero_icons_v117/cannon_cards", rect: [1540, 4, 504, 504] },
  "ui_card_cannon_fragments": { source: "new_hero_icons_v117/cannon_cards", rect: [4, 516, 504, 504] },
  "ui_card_cannon_pierce": { source: "new_hero_icons_v117/cannon_cards", rect: [516, 516, 504, 504] },
  "ui_card_cannon_center": { source: "new_hero_icons_v117/cannon_cards", rect: [1028, 516, 504, 504] },
  "ui_card_cannon_heavy": { source: "new_hero_icons_v117/cannon_cards", rect: [1540, 516, 504, 504] },
  "ui_card_cannon_cluster": { source: "new_hero_icons_v117/cannon_cards", rect: [4, 1028, 504, 504] },
  "ui_card_cannon_wave": { source: "new_hero_icons_v117/cannon_cards", rect: [516, 1028, 504, 504] },
  "ui_card_cannon_interrupt": { source: "new_hero_icons_v117/cannon_cards", rect: [1028, 1028, 504, 504] },
  "ui_card_cannon_charges": { source: "new_hero_icons_v117/cannon_cards", rect: [1540, 1028, 504, 504] },
  "ui_card_cannon_refund": { source: "new_hero_icons_v117/cannon_cards", rect: [4, 1540, 504, 504] },
  "ui_card_cannon_ult_center": { source: "new_hero_icons_v117/cannon_cards", rect: [516, 1540, 504, 504] },
  "ui_card_cannon_ult_radius": { source: "new_hero_icons_v117/cannon_cards", rect: [1028, 1540, 504, 504] },
  "ui_card_cannon_ult_stun": { source: "new_hero_icons_v117/cannon_cards", rect: [1540, 1540, 504, 504] },
  "ui_card_siphon_twin": { source: "new_hero_icons_v117/siphon_cards", rect: [4, 4, 504, 504] },
  "ui_card_siphon_inherit": { source: "new_hero_icons_v117/siphon_cards", rect: [516, 4, 504, 504] },
  "ui_card_siphon_shred": { source: "new_hero_icons_v117/siphon_cards", rect: [1028, 4, 504, 504] },
  "ui_card_siphon_extend": { source: "new_hero_icons_v117/siphon_cards", rect: [1540, 4, 504, 504] },
  "ui_card_siphon_relay": { source: "new_hero_icons_v117/siphon_cards", rect: [4, 516, 504, 504] },
  "ui_card_siphon_slow": { source: "new_hero_icons_v117/siphon_cards", rect: [516, 516, 504, 504] },
  "ui_card_siphon_healcut": { source: "new_hero_icons_v117/siphon_cards", rect: [1028, 516, 504, 504] },
  "ui_card_siphon_relay_time": { source: "new_hero_icons_v117/siphon_cards", rect: [1540, 516, 504, 504] },
  "ui_card_siphon_fork": { source: "new_hero_icons_v117/siphon_cards", rect: [4, 1028, 504, 504] },
  "ui_card_siphon_ult_duration": { source: "new_hero_icons_v117/siphon_cards", rect: [516, 1028, 504, 504] },
  "ui_card_siphon_ult_ticks": { source: "new_hero_icons_v117/siphon_cards", rect: [1028, 1028, 504, 504] },
  "ui_card_siphon_heavy_grip": { source: "new_hero_icons_v117/siphon_cards", rect: [1540, 1028, 504, 504] },
  "ui_card_siphon_skill_targets": { source: "new_hero_icons_v117/siphon_cards", rect: [4, 1540, 504, 504] },
};
for (const hero of ['cannon', 'siphon']) {
  NEW_HERO_FRAMES['new_heroes_v105/avatar_' + hero] = NEW_HERO_FRAMES['ui_avatar_' + hero];
  NEW_HERO_FRAMES['hero_comic_v1/comic_figure_' + hero + '_v1'] = { source: 'new_heroes_v105/' + hero + '_lobby', rect: [0, 0, 1024, 1536] };
}
// All callers and prewarm requests resolve to the same source texture, never a second placeholder.
for (const key of Object.keys(NEW_HERO_FRAMES)) if (!key.includes('/'))
  NEW_HERO_FRAMES['shop_comic_v1/' + key] = NEW_HERO_FRAMES[key];
