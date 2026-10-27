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
// v120 wind/ninja real atlas regions.
Object.assign(NEW_HERO_FRAMES, {
  "new_heroes_v120/wind_lobby": {
    "source": "wind_ninja_v120/wind_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "hero_comic_v1/comic_figure_wind_v1": {
    "source": "wind_ninja_v120/wind_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "new_heroes_v120/wind_battle": {
    "source": "wind_ninja_v120/wind_figures",
    "rect": [
      512,
      0,
      512,
      768
    ]
  },
  "new_heroes_v120/ninja_lobby": {
    "source": "wind_ninja_v120/ninja_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "hero_comic_v1/comic_figure_ninja_v1": {
    "source": "wind_ninja_v120/ninja_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "new_heroes_v120/ninja_battle": {
    "source": "wind_ninja_v120/ninja_figures",
    "rect": [
      512,
      0,
      512,
      768
    ]
  },
  "ui_icon_atk_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "ui_icon_skill_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "ui_icon_ult_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      516,
      4,
      248,
      248
    ]
  },
  "ui_card_volt_field": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      772,
      4,
      248,
      248
    ]
  },
  "ui_icon_atk_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "ui_icon_skill_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      260,
      260,
      248,
      248
    ]
  },
  "ui_icon_ult_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      516,
      260,
      248,
      248
    ]
  },
  "ui_avatar_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      772,
      260,
      248,
      248
    ]
  },
  "ui_avatar_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      4,
      516,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_atk_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      516,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_card_volt_field": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      772,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_atk_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      260,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      516,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_avatar_ninja": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      772,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_avatar_wind": {
    "source": "wind_ninja_v120/abilities",
    "rect": [
      4,
      516,
      248,
      248
    ]
  }
});
// v127 space/sword atlas regions.
Object.assign(NEW_HERO_FRAMES, {
  "new_heroes_v127/space_lobby": {
    "source": "space_sword_v127/space_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "hero_comic_v1/comic_figure_space_v1": {
    "source": "space_sword_v127/space_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "new_heroes_v127/space_battle": {
    "source": "space_sword_v127/space_figures",
    "rect": [
      512,
      0,
      512,
      768
    ]
  },
  "ui_avatar_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "ui_icon_atk_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "ui_icon_skill_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      516,
      4,
      248,
      248
    ]
  },
  "ui_icon_ult_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      772,
      4,
      248,
      248
    ]
  },
  "new_heroes_v127/sword_lobby": {
    "source": "space_sword_v127/sword_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "hero_comic_v1/comic_figure_sword_v1": {
    "source": "space_sword_v127/sword_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "new_heroes_v127/sword_battle": {
    "source": "space_sword_v127/sword_figures",
    "rect": [
      512,
      0,
      512,
      768
    ]
  },
  "ui_avatar_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "ui_icon_atk_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      260,
      260,
      248,
      248
    ]
  },
  "ui_icon_skill_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      516,
      260,
      248,
      248
    ]
  },
  "ui_icon_ult_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      772,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_avatar_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_atk_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      516,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_space": {
    "source": "space_sword_v127/abilities",
    "rect": [
      772,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_avatar_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_atk_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      260,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      516,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_sword": {
    "source": "space_sword_v127/abilities",
    "rect": [
      772,
      260,
      248,
      248
    ]
  }
});
// v128 revised space/sword UI abilities.
Object.assign(NEW_HERO_FRAMES, {
  "ui_icon_skill_space": {
    "source": "space_sword_v128/icons",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_space": {
    "source": "space_sword_v128/icons",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "ui_icon_ult_space": {
    "source": "space_sword_v128/icons",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_space": {
    "source": "space_sword_v128/icons",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "ui_icon_skill_sword": {
    "source": "space_sword_v128/icons",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_sword": {
    "source": "space_sword_v128/icons",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "ui_icon_ult_sword": {
    "source": "space_sword_v128/icons",
    "rect": [
      260,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_sword": {
    "source": "space_sword_v128/icons",
    "rect": [
      260,
      260,
      248,
      248
    ]
  }
});
// v137 thunder lance atlas regions.
Object.assign(NEW_HERO_FRAMES, {
  "new_heroes_v137/lance_lobby": {
    "source": "thunder_lance_v137/lance_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "hero_comic_v1/comic_figure_lance_v1": {
    "source": "thunder_lance_v137/lance_figures",
    "rect": [
      0,
      0,
      512,
      768
    ]
  },
  "new_heroes_v137/lance_battle": {
    "source": "thunder_lance_v137/lance_figures",
    "rect": [
      512,
      0,
      512,
      768
    ]
  },
  "ui_avatar_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "ui_icon_atk_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "ui_icon_skill_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "ui_icon_ult_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      260,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_avatar_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      4,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_atk_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      260,
      4,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_skill_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      4,
      260,
      248,
      248
    ]
  },
  "shop_comic_v1/ui_icon_ult_lance": {
    "source": "thunder_lance_v137/abilities",
    "rect": [
      260,
      260,
      248,
      248
    ]
  }
});
