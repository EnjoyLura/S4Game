/** Authored sixteen-region content. No engine imports or save mutations. */
export interface EnemyHealing {
  windup: number; fraction: number; capRatio: number; radius: number; targets: number;
}
/** A cast heals 4% of target HP, capped at 20% of the caster's HP per target. */
export const ENEMY_HEALING: Readonly<EnemyHealing> = { windup: 1.2, fraction: .04, capRatio: .2, radius: 200, targets: 3 };
export interface EnemyFeatures {
  homeChapter?: number;
  artAtlas?: string;
  description?: string;
  traits?: string[];
  weak?: string;
  airborne?: boolean;
  magicRes?: number;
  /** Raw physical damage required to break armor, as a fraction of maximum HP. */
  armorBreakRatio?: number;
  /** Raw magic damage required to break a one-use ward, as a fraction of maximum HP. */
  wardBreakRatio?: number;
  healing?: EnemyHealing;
  guard?: { period: number; duration: number; reduction: number };
  rush?: { period: number; duration: number; multiplier: number; windup?: number; impactMul?: number };
  venom?: { duration: number; portion: number };
  regen?: number;
  aura?: { radius: number; attackMul: number };
  summon?: { id: string; count: number; every: number; limit: number };
  split?: { id: string; count: number };
  revive?: number;
  windup?: number;
  phase?: { threshold: number; attackMul: number; speedMul: number };
  /** Encounter-created offspring cannot generate equipment or farmable currency. */
  offspring?: boolean;
}
export interface ExpandedMobDef extends EnemyFeatures {
  id: string; name: string; kind: 'melee' | 'ranged' | 'heal';
  hp: number; dmg: number; atkInterval: number; speed: number; radius: number;
  exp: number; charge: number; gold: number; color: string;
  atkRange?: number; healAmount?: number; physRes?: number; elite?: boolean; boss?: boolean;
}
export interface ChapterContent {
  number: number; name: string; art: string; region: string; stages: string[];
  color: string; mapPoint: number[]; roster: string[];
}
export const CHAPTER_CONTENT: readonly ChapterContent[] = [
  {
    "number": 1,
    "name": "前哨",
    "art": "outpost",
    "region": "王国边境",
    "stages": [
      "城外小径",
      "废弃岗亭",
      "林缘营地",
      "石桥隘口",
      "哨塔争夺",
      "补给小道",
      "旧墙防线",
      "烽火营地",
      "前哨围攻",
      "守望堡垒"
    ],
    "color": "#637B3B",
    "mapPoint": [0.2,0.84],
    "roster": []
  },
  {
    "number": 2,
    "name": "深林",
    "art": "forest",
    "region": "王国边境",
    "stages": [
      "林间入口",
      "迷雾小径",
      "古树廊道",
      "密林伏击",
      "狼影岔路",
      "苔石遗迹",
      "萨满祭地",
      "幽林深处",
      "荆棘围阵",
      "深林腹地"
    ],
    "color": "#3E7D4D",
    "mapPoint": [0.41,0.78],
    "roster": [
      "forest_spider",
      "forest_wasp",
      "forest_vine",
      "forest_guard",
      "thorn_ancient"
    ]
  },
  {
    "number": 3,
    "name": "兽穴",
    "art": "lair",
    "region": "王国边境",
    "stages": [
      "洞口险道",
      "碎骨坑道",
      "兽群营地",
      "獠牙石窟",
      "战鼓大厅",
      "地底暗河",
      "驯兽巢室",
      "蛮兵要塞",
      "兽穴围城",
      "巢穴核心"
    ],
    "color": "#927047",
    "mapPoint": [0.63,0.88],
    "roster": [
      "lair_gnawer",
      "lair_hunter",
      "lair_tamer",
      "lair_mauler",
      "fang_beast"
    ]
  },
  {
    "number": 4,
    "name": "雾苇沼泽",
    "art": "marsh",
    "region": "王国边境",
    "stages": [
      "芦苇浅滩",
      "腐木渡口",
      "蛙鸣小径",
      "沉屋泥潭",
      "毒囊水洼",
      "蜥族营地",
      "枯根长堤",
      "迷雾浮桥",
      "深沼围攻",
      "巨蛙沉潭"
    ],
    "color": "#708956",
    "mapPoint": [0.82,0.79],
    "roster": [
      "marsh_frog",
      "venom_bug",
      "lizard_medic",
      "marsh_guard",
      "marsh_toad"
    ]
  },
  {
    "number": 5,
    "name": "碎帆海岸",
    "art": "coast",
    "region": "南方远征",
    "stages": [
      "潮痕沙滩",
      "断桅湾口",
      "礁石浅滩",
      "漂木营地",
      "沉船残骸",
      "鱼人渔场",
      "盐风栈桥",
      "废港防线",
      "潮汐围城",
      "巨钳巢穴"
    ],
    "color": "#3B91A0",
    "mapPoint": [0.86,0.62],
    "roster": [
      "shell_crab",
      "reef_spearman",
      "tide_priest",
      "anchor_crab",
      "claw_king"
    ]
  },
  {
    "number": 6,
    "name": "赤金沙海",
    "art": "desert",
    "region": "南方远征",
    "stages": [
      "沙海边缘",
      "商道残营",
      "蝎尾沙丘",
      "枯井绿洲",
      "风蚀石阵",
      "甲虫沙窝",
      "流沙古道",
      "断柱驿站",
      "沙暴前线",
      "巨虫沙穴"
    ],
    "color": "#C19A45",
    "mapPoint": [0.55,0.5],
    "roster": [
      "dune_beetle",
      "sand_scorpion",
      "sand_lizard",
      "dune_guard",
      "sand_worm"
    ]
  },
  {
    "number": 7,
    "name": "失落王庭",
    "art": "ruins",
    "region": "南方远征",
    "stages": [
      "埋沙城门",
      "残柱长街",
      "陶俑庭院",
      "石像廊桥",
      "王陵前殿",
      "沙漏祭室",
      "断壁宫苑",
      "守灵长阶",
      "古王禁庭",
      "王座封印"
    ],
    "color": "#AA995F",
    "mapPoint": [0.4,0.6],
    "roster": [
      "clay_sentinel",
      "stone_archer",
      "tomb_spirit",
      "royal_guard",
      "ancient_warden"
    ]
  },
  {
    "number": 8,
    "name": "赤岩峡谷",
    "art": "canyon",
    "region": "南方远征",
    "stages": [
      "赤岩入口",
      "鹰巢断崖",
      "落石狭道",
      "岩羊栈道",
      "悬桥争夺",
      "投矛岩台",
      "碎谷隘口",
      "裂角营地",
      "峡谷重围",
      "岩兽巢顶"
    ],
    "color": "#AB6645",
    "mapPoint": [0.16,0.47],
    "roster": [
      "canyon_ram",
      "cliff_eagle",
      "cliff_spear",
      "cliff_bulwark",
      "split_horn"
    ]
  },
  {
    "number": 9,
    "name": "锈铁矿区",
    "art": "mine",
    "region": "北境探险",
    "stages": [
      "旧矿入口",
      "废轨岔路",
      "蝠影坑道",
      "矿车斜坡",
      "钻甲工棚",
      "升降井口",
      "锈炉大厅",
      "采矿深井",
      "矿机暴走",
      "掘山核心"
    ],
    "color": "#756E60",
    "mapPoint": [0.23,0.3],
    "roster": [
      "mine_bat",
      "drill_beetle",
      "mining_drone",
      "iron_loader",
      "mountain_drill"
    ]
  },
  {
    "number": 10,
    "name": "霜牙雪岭",
    "art": "snow",
    "region": "北境探险",
    "stages": [
      "雪松坡道",
      "冻河浅滩",
      "狼踪山口",
      "冰晶洞口",
      "霜甲营地",
      "断冰石桥",
      "雪岭堡垒",
      "风雪长阶",
      "巨兽冰原",
      "霜背王巢"
    ],
    "color": "#718EA4",
    "mapPoint": [0.49,0.35],
    "roster": [
      "snow_wolf",
      "ice_shooter",
      "frost_giant",
      "frost_guard",
      "frostback"
    ]
  },
  {
    "number": 11,
    "name": "雷鸣高地",
    "art": "storm",
    "region": "北境探险",
    "stages": [
      "高地风口",
      "雷羽巢台",
      "风蚀石林",
      "悬崖古道",
      "蓄雷岩场",
      "风灵长桥",
      "雷痕祭坛",
      "黑云山脊",
      "雷翼围猎",
      "风暴之巅"
    ],
    "color": "#6879A1",
    "mapPoint": [0.65,0.28],
    "roster": [
      "thunder_eagle",
      "wind_spirit",
      "storm_stone",
      "storm_guard",
      "storm_lord"
    ]
  },
  {
    "number": 12,
    "name": "菌光地窟",
    "art": "fungus",
    "region": "北境探险",
    "stages": [
      "荧光洞口",
      "菌丝小径",
      "伞盖林地",
      "孢子水潭",
      "盾菇营地",
      "紫菌长桥",
      "菌网腹地",
      "母巢前厅",
      "孢潮围阵",
      "孢冠巢心"
    ],
    "color": "#83688D",
    "mapPoint": [0.89,0.32],
    "roster": [
      "fungal_worm",
      "spore_spitter",
      "shield_mushroom",
      "split_mushroom",
      "spore_mother"
    ]
  },
  {
    "number": 13,
    "name": "幽影墓园",
    "art": "grave",
    "region": "黑暗腹地",
    "stages": [
      "墓园铁门",
      "枯树小径",
      "残碑长街",
      "骨犬荒岗",
      "亡魂渡口",
      "缚魂祭地",
      "陵墓回廊",
      "古墓深庭",
      "百骨围城",
      "守墓王陵"
    ],
    "color": "#6B7D85",
    "mapPoint": [0.85,0.14],
    "roster": [
      "bone_soldier",
      "grave_wraith",
      "soul_binder",
      "grave_guard",
      "tomb_colossus"
    ]
  },
  {
    "number": 14,
    "name": "黑铁要塞",
    "art": "fortress",
    "region": "黑暗腹地",
    "stages": [
      "黑铁吊桥",
      "外墙缺口",
      "战旗营地",
      "军械长街",
      "铠卫庭院",
      "傀儡工坊",
      "重门甬道",
      "内城防线",
      "统帅亲卫",
      "黑铁王座"
    ],
    "color": "#686B79",
    "mapPoint": [0.49,0.14],
    "roster": [
      "living_armor",
      "siege_puppet",
      "banner_guard",
      "iron_captain",
      "iron_commander"
    ]
  },
  {
    "number": 15,
    "name": "熔火裂谷",
    "art": "volcano",
    "region": "黑暗腹地",
    "stages": [
      "焦土边缘",
      "焰灵岩道",
      "熔壳滩地",
      "黑曜石桥",
      "岩浆虫穴",
      "灰烬祭台",
      "火山前庭",
      "熔流隘口",
      "巨兽苏醒",
      "熔山深核"
    ],
    "color": "#AE654A",
    "mapPoint": [0.64,0.06],
    "roster": [
      "lava_larva",
      "flame_spirit",
      "magma_shell",
      "obsidian_guard",
      "molten_beast"
    ]
  },
  {
    "number": 16,
    "name": "裂隙王座",
    "art": "rift",
    "region": "黑暗腹地",
    "stages": [
      "裂隙边境",
      "浮岩断道",
      "镜影庭院",
      "虚空回廊",
      "祭司高台",
      "破碎城门",
      "异界长桥",
      "王座前庭",
      "裂隙重围",
      "终焉王座"
    ],
    "color": "#7D6A9C",
    "mapPoint": [0.18,0.11],
    "roster": [
      "rift_hound",
      "mirror_fiend",
      "rift_priest",
      "rift_guard",
      "rift_sovereign"
    ]
  }
];
export const EXPANSION_MOBS: Readonly<Record<string, ExpandedMobDef>> = {
  "forest_eagle": {
    "id": "forest_eagle",
    "name": "黑羽猛禽",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v87",
    "airborne": true,
    "exp": 14,
    "charge": 1,
    "gold": 2,
    "description": "深林的飞行近战单位。振翅逼近防线，可被全部英雄攻击。",
    "traits": ["飞行单位，可被全部英雄攻击", "成群出现，单体生命较低"],
    "weak": "范围攻击覆盖敌群"
  },
  "forest_bat": {
    "id": "forest_bat",
    "name": "赤翼魔蝠",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v87",
    "airborne": true,
    "exp": 14,
    "charge": 1,
    "gold": 2,
    "description": "深林的飞行近战单位。拍翼成群靠近防线，可被全部英雄攻击。",
    "traits": ["飞行单位，可被全部英雄攻击", "成群出现，单体生命较低"],
    "weak": "范围攻击覆盖敌群"
  },
  "forest_wolf": {
    "id": "forest_wolf",
    "name": "灰鬃狼怪",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v85",
    "exp": 14,
    "charge": 1,
    "gold": 2,
    "description": "深林的双足近战单位。双爪逼近防线，成群出现时需要及时清理。",
    "traits": ["双足行走，近战围攻防线", "成群出现，单体生命较低"],
    "weak": "范围攻击覆盖前排"
  },
  "forest_spider": {
    "id": "forest_spider",
    "name": "荆背林蛛",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v85",
    "exp": 14,
    "charge": 1,
    "gold": 2,
    "description": "深林的群体近战单位。成群接近防线，单体生命较低。",
    "traits": [
      "成群接近防线，单体生命较低"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "forest_wasp": {
    "id": "forest_wasp",
    "name": "毒针蜂",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v87",
    "airborne": true,
    "venom": {
      "duration": 3,
      "portion": 0.25
    },
    "exp": 14,
    "charge": 2,
    "gold": 2,
    "description": "深林的远程攻击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "攻击附带3秒毒伤"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "forest_vine": {
    "id": "forest_vine",
    "name": "盘根藤怪",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v85",
    "regen": 0.012,
    "exp": 14,
    "charge": 2,
    "gold": 2,
    "description": "深林的重型前排单位。每秒回复1.2%最大生命。",
    "traits": [
      "每秒回复1.2%最大生命"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "forest_guard": {
    "id": "forest_guard",
    "name": "荆棘守卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "mobs_forest_v66",
    "guard": {
      "period": 8,
      "duration": 3,
      "reduction": 0.35
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 27,
    "description": "深林的精英单位。每8秒防御3秒，减伤35%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "每8秒防御3秒，物理减伤35%",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "thorn_ancient": {
    "id": "thorn_ancient",
    "name": "赤甲蛛王",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#3E7D4D",
    "homeChapter": 2,
    "artAtlas": "forest_mob_walk_v87",
    "summon": {
      "id": "forest_spider",
      "count": 2,
      "every": 14,
      "limit": 6
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.25,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 68,
    "description": "深林的首领单位。定时召唤援军，每只最多6只。",
    "traits": [
      "定时召唤援军，每只最多6只",
      "生命低于45%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "lair_gnawer": {
    "id": "lair_gnawer",
    "rush": {
      "period": 7,
      "duration": 1.1,
      "multiplier": 1.6
    },
    "name": "洞穴蛮兵",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#927047",
    "homeChapter": 3,
    "artAtlas": "mobs_lair_v66",
    "charge": 2,
    "exp": 15,
    "gold": 3,
    "description": "兽穴的快速突击单位。每7秒短暂加速推进。",
    "traits": [
      "每7秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "lair_hunter": {
    "id": "lair_hunter",
    "name": "獠牙投猎手",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#927047",
    "homeChapter": 3,
    "artAtlas": "mobs_lair_v66",
    "exp": 15,
    "charge": 2,
    "gold": 3,
    "description": "兽穴的远程攻击单位。停在远处攻击防线。",
    "traits": [
      "停在远处攻击防线"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "lair_tamer": {
    "id": "lair_tamer",
    "name": "兽穴驯兽师",
    "kind": "heal",
    "hp": 640,
    "dmg": 0,
    "atkInterval": 4,
    "speed": 24,
    "radius": 23,
    "healAmount": 48,
    "color": "#927047",
    "homeChapter": 3,
    "artAtlas": "mobs_lair_v66",
    "exp": 15,
    "charge": 2,
    "gold": 3,
    "description": "生命较高的支援单位，读条后治疗附近伤员；冰封、眩晕可打断。",
    "traits": [
      "每4秒治疗，施法准备1.2秒",
      "回复4%生命，最多治疗3名伤员",
      "冰封、眩晕可打断，治疗者不互疗"
    ],
    "weak": "范围伤害覆盖后排，或用冰封、眩晕打断治疗"
  },
  "lair_mauler": {
    "id": "lair_mauler",
    "name": "战鼓蛮卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#927047",
    "homeChapter": 3,
    "artAtlas": "mobs_lair_v66",
    "aura": {
      "radius": 180,
      "attackMul": 1.16
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 28,
    "description": "兽穴的精英单位。提高附近友军16%攻线伤害。",
    "traits": [
      "提高附近友军16%攻线伤害"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "fang_beast": {
    "id": "fang_beast",
    "rush": {
      "period": 9,
      "duration": 1.4,
      "multiplier": 1.7
    },
    "name": "巨牙兽王",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#927047",
    "homeChapter": 3,
    "artAtlas": "mobs_lair_v66",
    "charge": 20,
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.25,
      "speedMul": 1.12
    },
    "boss": true,
    "exp": 140,
    "gold": 72,
    "description": "兽穴的首领单位。每9秒短暂加速推进。",
    "traits": [
      "每9秒短暂加速推进",
      "生命低于45%进入强化阶段"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "marsh_frog": {
    "id": "marsh_frog",
    "rush": {
      "period": 6,
      "duration": 0.8,
      "multiplier": 1.65
    },
    "name": "苇沼蛙兵",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#708956",
    "homeChapter": 4,
    "artAtlas": "mobs_marsh_v66",
    "charge": 2,
    "exp": 16,
    "gold": 3,
    "description": "雾苇沼泽的快速突击单位。每6秒短暂加速推进。",
    "traits": [
      "每6秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "venom_bug": {
    "id": "venom_bug",
    "name": "毒囊虫",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#708956",
    "homeChapter": 4,
    "artAtlas": "mobs_marsh_v66",
    "venom": {
      "duration": 4,
      "portion": 0.4
    },
    "exp": 16,
    "charge": 2,
    "gold": 3,
    "description": "雾苇沼泽的远程攻击单位。攻击附带4秒毒伤。",
    "traits": [
      "攻击附带4秒毒伤"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "lizard_medic": {
    "id": "lizard_medic",
    "name": "蜥蜴巫医",
    "kind": "heal",
    "hp": 640,
    "dmg": 0,
    "atkInterval": 4,
    "speed": 24,
    "radius": 23,
    "healAmount": 48,
    "color": "#708956",
    "homeChapter": 4,
    "artAtlas": "mobs_marsh_v66",
    "exp": 16,
    "charge": 2,
    "gold": 3,
    "description": "有35%法抗符盾。生命较高的支援单位，读条后治疗附近伤员；冰封、眩晕可打断。",
    "traits": [
      "每4秒治疗，施法准备1.2秒",
      "回复4%生命，最多治疗3名伤员",
      "冰封、眩晕可打断，治疗者不互疗",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "marsh_guard": {
    "id": "marsh_guard",
    "name": "泥甲蛙卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#708956",
    "homeChapter": 4,
    "artAtlas": "mobs_marsh_v66",
    "regen": 0.015,
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 29,
    "description": "雾苇沼泽的精英单位。每秒回复1.5%最大生命。 铠甲减少25%物理伤害，法术不受影响。",
    "traits": [
      "每秒回复1.5%最大生命",
      "物抗25%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.25,
    "armorBreakRatio": 0.3
  },
  "marsh_toad": {
    "id": "marsh_toad",
    "name": "沼潭巨蛙",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#708956",
    "homeChapter": 4,
    "artAtlas": "mobs_marsh_v66",
    "venom": {
      "duration": 5,
      "portion": 0.35
    },
    "summon": {
      "id": "marsh_frog",
      "count": 2,
      "every": 16,
      "limit": 6
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.25,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 76,
    "description": "雾苇沼泽的首领单位。攻击附带5秒毒伤。",
    "traits": [
      "攻击附带5秒毒伤",
      "定时召唤援军，每只最多6只",
      "生命低于45%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "shell_crab": {
    "id": "shell_crab",
    "name": "船壳蟹兵",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#3B91A0",
    "homeChapter": 5,
    "artAtlas": "mobs_coast_v66",
    "guard": {
      "period": 9,
      "duration": 3,
      "reduction": 0.4
    },
    "exp": 17,
    "charge": 2,
    "gold": 3,
    "description": "碎帆海岸的重型前排单位。每9秒防御3秒，减伤40%。 铠甲减少25%物理伤害，法术不受影响。",
    "traits": [
      "每9秒防御3秒，物理减伤40%",
      "物抗25%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.25,
    "armorBreakRatio": 0.3
  },
  "reef_spearman": {
    "id": "reef_spearman",
    "name": "礁鳍掷叉手",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#3B91A0",
    "homeChapter": 5,
    "artAtlas": "mobs_coast_v66",
    "exp": 17,
    "charge": 2,
    "gold": 3,
    "description": "碎帆海岸的远程攻击单位。停在远处攻击防线。",
    "traits": [
      "停在远处攻击防线"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "tide_priest": {
    "id": "tide_priest",
    "name": "潮汐祭司",
    "kind": "heal",
    "hp": 640,
    "dmg": 0,
    "atkInterval": 4,
    "speed": 24,
    "radius": 23,
    "healAmount": 48,
    "color": "#3B91A0",
    "homeChapter": 5,
    "artAtlas": "mobs_coast_v66",
    "exp": 17,
    "charge": 2,
    "gold": 3,
    "description": "有35%法抗符盾。生命较高的支援单位，读条后治疗附近伤员；冰封、眩晕可打断。",
    "traits": [
      "每4秒治疗，施法准备1.2秒",
      "回复4%生命，最多治疗3名伤员",
      "冰封、眩晕可打断，治疗者不互疗",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "anchor_crab": {
    "id": "anchor_crab",
    "name": "铁锚巨蟹",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#3B91A0",
    "homeChapter": 5,
    "artAtlas": "mobs_coast_v66",
    "physRes": 0.28,
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 30,
    "description": "碎帆海岸的精英单位。常驻减伤28%。 铠甲减少28%物理伤害，法术不受影响。",
    "traits": [
      "物抗28%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发"
  },
  "claw_king": {
    "id": "claw_king",
    "name": "巨钳蟹王",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#3B91A0",
    "homeChapter": 5,
    "artAtlas": "mobs_coast_v66",
    "guard": {
      "period": 9,
      "duration": 3,
      "reduction": 0.35
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.35,
      "speedMul": 1.08
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 80,
    "description": "碎帆海岸的首领单位。每9秒防御3秒，减伤35%。",
    "traits": [
      "每9秒防御3秒，减伤35%",
      "生命低于45%进入强化阶段"
    ],
    "weak": "利用防御间隙集中爆发"
  },
  "dune_beetle": {
    "id": "dune_beetle",
    "name": "沙丘甲虫",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#C19A45",
    "homeChapter": 6,
    "artAtlas": "mobs_desert_v66",
    "exp": 18,
    "charge": 1,
    "gold": 4,
    "description": "赤金沙海的群体近战单位。成群接近防线，单体生命较低。",
    "traits": [
      "成群接近防线，单体生命较低"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "sand_scorpion": {
    "id": "sand_scorpion",
    "name": "赤尾沙蝎",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#C19A45",
    "homeChapter": 6,
    "artAtlas": "mobs_desert_v66",
    "venom": {
      "duration": 3,
      "portion": 0.3
    },
    "exp": 18,
    "charge": 2,
    "gold": 4,
    "description": "赤金沙海的远程攻击单位。攻击附带3秒毒伤。",
    "traits": [
      "攻击附带3秒毒伤"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "sand_lizard": {
    "id": "sand_lizard",
    "rush": {
      "period": 6,
      "duration": 1.2,
      "multiplier": 1.7
    },
    "name": "沙蜥猎手",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#C19A45",
    "homeChapter": 6,
    "artAtlas": "mobs_desert_v66",
    "charge": 2,
    "exp": 18,
    "gold": 4,
    "description": "赤金沙海的快速突击单位。每6秒短暂加速推进。",
    "traits": [
      "每6秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "dune_guard": {
    "id": "dune_guard",
    "name": "铲角甲卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#C19A45",
    "homeChapter": 6,
    "artAtlas": "mobs_desert_v66",
    "guard": {
      "period": 8,
      "duration": 2.8,
      "reduction": 0.4
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 31,
    "description": "赤金沙海的精英单位。每8秒防御2.8秒，减伤40%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "每8秒防御2.8秒，物理减伤40%",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "sand_worm": {
    "id": "sand_worm",
    "name": "沙潜巨虫",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#C19A45",
    "homeChapter": 6,
    "artAtlas": "mobs_desert_v66",
    "summon": {
      "id": "dune_beetle",
      "count": 3,
      "every": 15,
      "limit": 9
    },
    "phase": {
      "threshold": 0.4,
      "attackMul": 1.3,
      "speedMul": 1.12
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 84,
    "description": "赤金沙海的首领单位。定时召唤援军，每只最多9只。",
    "traits": [
      "定时召唤援军，每只最多9只",
      "生命低于40%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "clay_sentinel": {
    "id": "clay_sentinel",
    "name": "陶俑卫士",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#AA995F",
    "homeChapter": 7,
    "artAtlas": "mobs_ruins_v66",
    "guard": {
      "period": 8,
      "duration": 3,
      "reduction": 0.35
    },
    "exp": 19,
    "charge": 2,
    "gold": 4,
    "description": "失落王庭的重型前排单位。每8秒防御3秒，减伤35%。 铠甲减少25%物理伤害，法术不受影响。",
    "traits": [
      "每8秒防御3秒，物理减伤35%",
      "物抗25%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.25,
    "armorBreakRatio": 0.3
  },
  "stone_archer": {
    "id": "stone_archer",
    "name": "石像射手",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#AA995F",
    "homeChapter": 7,
    "artAtlas": "mobs_ruins_v66",
    "exp": 19,
    "charge": 2,
    "gold": 4,
    "description": "失落王庭的远程攻击单位。停在远处攻击防线。",
    "traits": [
      "停在远处攻击防线"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "tomb_spirit": {
    "id": "tomb_spirit",
    "name": "守墓灵",
    "kind": "heal",
    "hp": 640,
    "dmg": 0,
    "atkInterval": 4,
    "speed": 24,
    "radius": 23,
    "healAmount": 48,
    "color": "#AA995F",
    "homeChapter": 7,
    "artAtlas": "mobs_ruins_v66",
    "airborne": true,
    "exp": 19,
    "charge": 2,
    "gold": 4,
    "description": "有35%法抗符盾。生命较高的支援单位，读条后治疗附近伤员；冰封、眩晕可打断。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "每4秒治疗，施法准备1.2秒",
      "回复4%生命，最多治疗3名伤员",
      "冰封、眩晕可打断，治疗者不互疗",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "royal_guard": {
    "id": "royal_guard",
    "name": "王庭重卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#AA995F",
    "homeChapter": 7,
    "artAtlas": "mobs_ruins_v66",
    "guard": {
      "period": 9,
      "duration": 3.5,
      "reduction": 0.4
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 32,
    "description": "失落王庭的精英单位。每9秒防御3.5秒，减伤40%。 铠甲减少35%物理伤害，法术不受影响。",
    "traits": [
      "每9秒防御3.5秒，物理减伤40%",
      "物抗35%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.35,
    "armorBreakRatio": 0.3
  },
  "ancient_warden": {
    "id": "ancient_warden",
    "name": "古王守卫",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#AA995F",
    "homeChapter": 7,
    "artAtlas": "mobs_ruins_v66",
    "guard": {
      "period": 10,
      "duration": 3,
      "reduction": 0.4
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.25,
      "speedMul": 1.08
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 88,
    "description": "失落王庭的首领单位。每10秒防御3秒，减伤40%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "每10秒防御3秒，物理减伤40%",
      "生命低于45%进入强化阶段",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "canyon_ram": {
    "id": "canyon_ram",
    "rush": {
      "period": 6,
      "duration": 1.3,
      "multiplier": 1.85
    },
    "name": "岩羊撞兽",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#AB6645",
    "homeChapter": 8,
    "artAtlas": "mobs_canyon_v66",
    "charge": 2,
    "exp": 20,
    "gold": 4,
    "description": "赤岩峡谷的快速突击单位。每6秒短暂加速推进。",
    "traits": [
      "每6秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "cliff_eagle": {
    "id": "cliff_eagle",
    "rush": {
      "period": 7,
      "duration": 1,
      "multiplier": 1.65
    },
    "name": "峡谷猛禽",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#AB6645",
    "homeChapter": 8,
    "artAtlas": "mobs_canyon_v66",
    "airborne": true,
    "charge": 2,
    "exp": 20,
    "gold": 4,
    "description": "赤岩峡谷的快速突击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "每7秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "cliff_spear": {
    "id": "cliff_spear",
    "name": "崖居投矛手",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#AB6645",
    "homeChapter": 8,
    "artAtlas": "mobs_canyon_v66",
    "exp": 20,
    "charge": 2,
    "gold": 4,
    "description": "赤岩峡谷的远程攻击单位。停在远处攻击防线。",
    "traits": [
      "停在远处攻击防线"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "cliff_bulwark": {
    "id": "cliff_bulwark",
    "name": "赤岩厚甲兽",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#AB6645",
    "homeChapter": 8,
    "artAtlas": "mobs_canyon_v66",
    "physRes": 0.3,
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 33,
    "description": "赤岩峡谷的精英单位。常驻减伤30%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发"
  },
  "split_horn": {
    "id": "split_horn",
    "rush": {
      "period": 8,
      "duration": 1.6,
      "multiplier": 1.9
    },
    "name": "裂角岩兽",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#AB6645",
    "homeChapter": 8,
    "artAtlas": "mobs_canyon_v66",
    "charge": 20,
    "phase": {
      "threshold": 0.4,
      "attackMul": 1.3,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "gold": 92,
    "description": "赤岩峡谷的首领单位。每8秒短暂加速推进。",
    "traits": [
      "每8秒短暂加速推进",
      "生命低于40%进入强化阶段"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "mine_bat": {
    "id": "mine_bat",
    "name": "矿穴蝠",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#756E60",
    "homeChapter": 9,
    "artAtlas": "mobs_mine_v66",
    "airborne": true,
    "exp": 21,
    "charge": 2,
    "gold": 5,
    "description": "锈铁矿区的快速突击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "drill_beetle": {
    "id": "drill_beetle",
    "rush": {
      "period": 8,
      "duration": 1.2,
      "multiplier": 1.6
    },
    "name": "钻地甲虫",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#756E60",
    "homeChapter": 9,
    "artAtlas": "mobs_mine_v66",
    "charge": 2,
    "exp": 21,
    "gold": 5,
    "description": "锈铁矿区的重型前排单位。每8秒短暂加速推进。",
    "traits": [
      "每8秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "mining_drone": {
    "id": "mining_drone",
    "name": "失控采矿机",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#756E60",
    "homeChapter": 9,
    "artAtlas": "mobs_mine_v66",
    "windup": 1.1,
    "exp": 21,
    "charge": 2,
    "gold": 5,
    "description": "锈铁矿区的远程攻击单位。攻击前蓄力1.1秒，可用眩晕或冰封打断。",
    "traits": [
      "攻击前蓄力1.1秒，可用眩晕或冰封打断"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "iron_loader": {
    "id": "iron_loader",
    "name": "重载矿机",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#756E60",
    "homeChapter": 9,
    "artAtlas": "mobs_mine_v66",
    "physRes": 0.3,
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 34,
    "description": "锈铁矿区的精英单位。常驻减伤30%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发"
  },
  "mountain_drill": {
    "id": "mountain_drill",
    "name": "掘山钻机",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#756E60",
    "homeChapter": 9,
    "artAtlas": "mobs_mine_v66",
    "windup": 1.5,
    "summon": {
      "id": "mining_drone",
      "count": 1,
      "every": 16,
      "limit": 4
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.25,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 96,
    "description": "锈铁矿区的首领单位。定时召唤援军，每只最多4只。",
    "traits": [
      "定时召唤援军，每只最多4只",
      "攻击前蓄力1.5秒，可用眩晕打断",
      "生命低于45%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "snow_wolf": {
    "id": "snow_wolf",
    "rush": {
      "period": 6,
      "duration": 1.1,
      "multiplier": 1.7
    },
    "name": "雪岭灰狼",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#718EA4",
    "homeChapter": 10,
    "artAtlas": "mobs_snow_v66",
    "charge": 2,
    "exp": 22,
    "gold": 5,
    "description": "霜牙雪岭的快速突击单位。每6秒短暂加速推进。",
    "traits": [
      "每6秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "ice_shooter": {
    "id": "ice_shooter",
    "name": "冰晶射手",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#718EA4",
    "homeChapter": 10,
    "artAtlas": "mobs_snow_v66",
    "exp": 22,
    "charge": 2,
    "gold": 5,
    "description": "霜牙雪岭的远程攻击单位。停在远处攻击防线。",
    "traits": [
      "停在远处攻击防线"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "frost_giant": {
    "id": "frost_giant",
    "name": "冻甲巨人",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#718EA4",
    "homeChapter": 10,
    "artAtlas": "mobs_snow_v66",
    "guard": {
      "period": 9,
      "duration": 3,
      "reduction": 0.35
    },
    "exp": 22,
    "charge": 2,
    "gold": 5,
    "description": "霜牙雪岭的重型前排单位。每9秒防御3秒，减伤35%。 铠甲减少25%物理伤害，法术不受影响。",
    "traits": [
      "每9秒防御3秒，物理减伤35%",
      "物抗25%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.25,
    "armorBreakRatio": 0.3
  },
  "frost_guard": {
    "id": "frost_guard",
    "name": "冰脊重卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#718EA4",
    "homeChapter": 10,
    "artAtlas": "mobs_snow_v66",
    "regen": 0.012,
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 35,
    "description": "霜牙雪岭的精英单位。每秒回复1.2%最大生命。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "每秒回复1.2%最大生命",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "frostback": {
    "id": "frostback",
    "name": "霜背巨兽",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#718EA4",
    "homeChapter": 10,
    "artAtlas": "mobs_snow_v66",
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.3,
      "speedMul": 1.18
    },
    "summon": {
      "id": "snow_wolf",
      "count": 2,
      "every": 17,
      "limit": 6
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 100,
    "description": "霜牙雪岭的首领单位。定时召唤援军，每只最多6只。",
    "traits": [
      "定时召唤援军，每只最多6只",
      "生命低于45%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "thunder_eagle": {
    "id": "thunder_eagle",
    "rush": {
      "period": 6,
      "duration": 1,
      "multiplier": 1.8
    },
    "name": "雷羽鹰",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#6879A1",
    "homeChapter": 11,
    "artAtlas": "mobs_storm_v66",
    "airborne": true,
    "charge": 2,
    "exp": 23,
    "gold": 5,
    "description": "雷鸣高地的快速突击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "每6秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "wind_spirit": {
    "id": "wind_spirit",
    "name": "回旋风灵",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#6879A1",
    "homeChapter": 11,
    "artAtlas": "mobs_storm_v66",
    "airborne": true,
    "windup": 1.2,
    "exp": 23,
    "charge": 2,
    "gold": 5,
    "description": "有35%法抗符盾。雷鸣高地的远程攻击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "攻击前蓄力1.2秒，可用眩晕或冰封打断",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "storm_stone": {
    "id": "storm_stone",
    "name": "蓄雷石怪",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#6879A1",
    "homeChapter": 11,
    "artAtlas": "mobs_storm_v66",
    "windup": 1.8,
    "exp": 23,
    "charge": 2,
    "gold": 5,
    "description": "有35%法抗符盾。雷鸣高地的远程攻击单位。攻击前蓄力1.8秒，可用眩晕或冰封打断。",
    "traits": [
      "攻击前蓄力1.8秒，可用眩晕或冰封打断",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "storm_guard": {
    "id": "storm_guard",
    "name": "雷痕重卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#6879A1",
    "homeChapter": 11,
    "artAtlas": "mobs_storm_v66",
    "aura": {
      "radius": 170,
      "attackMul": 1.15
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 36,
    "description": "雷鸣高地的精英单位。提高附近友军15%攻线伤害。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "提高附近友军15%攻线伤害",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "storm_lord": {
    "id": "storm_lord",
    "name": "雷翼领主",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#6879A1",
    "homeChapter": 11,
    "artAtlas": "mobs_storm_v66",
    "airborne": true,
    "windup": 2,
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.3,
      "speedMul": 1.15
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 104,
    "description": "雷鸣高地的首领单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "攻击前蓄力2秒，可用眩晕打断",
      "生命低于45%进入强化阶段"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "fungal_worm": {
    "id": "fungal_worm",
    "name": "菌丝虫",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#83688D",
    "homeChapter": 12,
    "artAtlas": "mobs_fungus_v66",
    "exp": 24,
    "charge": 1,
    "gold": 6,
    "description": "菌光地窟的群体近战单位。成群接近防线，单体生命较低。",
    "traits": [
      "成群接近防线，单体生命较低"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "spore_spitter": {
    "id": "spore_spitter",
    "name": "喷孢怪",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#83688D",
    "homeChapter": 12,
    "artAtlas": "mobs_fungus_v66",
    "summon": {
      "id": "fungal_worm",
      "count": 1,
      "every": 16,
      "limit": 2
    },
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "菌光地窟的远程攻击单位。定时召唤援军，每只最多2只。",
    "traits": [
      "定时召唤援军，每只最多2只"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "shield_mushroom": {
    "id": "shield_mushroom",
    "name": "伞盖盾菇",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#83688D",
    "homeChapter": 12,
    "artAtlas": "mobs_fungus_v66",
    "guard": {
      "period": 8,
      "duration": 3,
      "reduction": 0.35
    },
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "菌光地窟的重型前排单位。每8秒防御3秒，减伤35%。",
    "traits": [
      "每8秒防御3秒，减伤35%"
    ],
    "weak": "利用防御间隙集中爆发"
  },
  "split_mushroom": {
    "id": "split_mushroom",
    "name": "裂孢重菇",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#83688D",
    "homeChapter": 12,
    "artAtlas": "mobs_fungus_v66",
    "split": {
      "id": "fungal_worm",
      "count": 3
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 37,
    "description": "菌光地窟的精英单位。被击败后分裂出3只小怪。",
    "traits": [
      "被击败后分裂出3只小怪"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "spore_mother": {
    "id": "spore_mother",
    "name": "孢冠母体",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#83688D",
    "homeChapter": 12,
    "artAtlas": "mobs_fungus_v66",
    "summon": {
      "id": "fungal_worm",
      "count": 3,
      "every": 13,
      "limit": 12
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.2,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 108,
    "description": "菌光地窟的首领单位。定时召唤援军，每只最多12只。",
    "traits": [
      "定时召唤援军，每只最多12只",
      "生命低于45%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "bone_soldier": {
    "id": "bone_soldier",
    "name": "残骨兵",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#6B7D85",
    "homeChapter": 13,
    "artAtlas": "mobs_grave_v66",
    "revive": 0.22,
    "exp": 24,
    "charge": 1,
    "gold": 6,
    "description": "幽影墓园的群体近战单位。第一次倒下后恢复部分生命，仅复生一次。",
    "traits": [
      "第一次倒下后恢复部分生命，仅复生一次"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "grave_wraith": {
    "id": "grave_wraith",
    "name": "游荡亡魂",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#6B7D85",
    "homeChapter": 13,
    "artAtlas": "mobs_grave_v66",
    "airborne": true,
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "有35%法抗符盾。幽影墓园的远程攻击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "soul_binder": {
    "id": "soul_binder",
    "name": "缚魂巫师",
    "kind": "heal",
    "hp": 640,
    "dmg": 0,
    "atkInterval": 4,
    "speed": 24,
    "radius": 23,
    "healAmount": 48,
    "color": "#6B7D85",
    "homeChapter": 13,
    "artAtlas": "mobs_grave_v66",
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "有35%法抗符盾。生命较高的支援单位，读条后治疗附近伤员；冰封、眩晕可打断。",
    "traits": [
      "每4秒治疗，施法准备1.2秒",
      "回复4%生命，最多治疗3名伤员",
      "冰封、眩晕可打断，治疗者不互疗",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "grave_guard": {
    "id": "grave_guard",
    "name": "墓门重卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#6B7D85",
    "homeChapter": 13,
    "artAtlas": "mobs_grave_v66",
    "physRes": 0.28,
    "revive": 0.18,
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 38,
    "description": "幽影墓园的精英单位。第一次倒下后恢复部分生命，仅复生一次。 铠甲减少28%物理伤害，法术不受影响。",
    "traits": [
      "第一次倒下后恢复部分生命，仅复生一次",
      "物抗28%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发"
  },
  "tomb_colossus": {
    "id": "tomb_colossus",
    "name": "守墓巨像",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#6B7D85",
    "homeChapter": 13,
    "artAtlas": "mobs_grave_v66",
    "summon": {
      "id": "bone_soldier",
      "count": 2,
      "every": 16,
      "limit": 8
    },
    "phase": {
      "threshold": 0.4,
      "attackMul": 1.25,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 112,
    "description": "幽影墓园的首领单位。定时召唤援军，每只最多8只。",
    "traits": [
      "定时召唤援军，每只最多8只",
      "生命低于40%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "living_armor": {
    "id": "living_armor",
    "name": "黑铁铠兵",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#686B79",
    "homeChapter": 14,
    "artAtlas": "mobs_fortress_v66",
    "physRes": 0.25,
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "黑铁要塞的重型前排单位。常驻减伤25%。 铠甲减少25%物理伤害，法术不受影响。",
    "traits": [
      "物抗25%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发"
  },
  "siege_puppet": {
    "id": "siege_puppet",
    "name": "攻城傀儡",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#686B79",
    "homeChapter": 14,
    "artAtlas": "mobs_fortress_v66",
    "windup": 1.4,
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "黑铁要塞的远程攻击单位。攻击前蓄力1.4秒，可用眩晕或冰封打断。",
    "traits": [
      "攻击前蓄力1.4秒，可用眩晕或冰封打断"
    ],
    "weak": "持续输出与控制，保留大招应对高压波次"
  },
  "banner_guard": {
    "id": "banner_guard",
    "name": "战旗卫士",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#686B79",
    "homeChapter": 14,
    "artAtlas": "mobs_fortress_v66",
    "aura": {
      "radius": 185,
      "attackMul": 1.18
    },
    "exp": 24,
    "charge": 2,
    "gold": 6,
    "description": "黑铁要塞的重型前排单位。提高附近友军18%攻线伤害。",
    "traits": [
      "提高附近友军18%攻线伤害"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "iron_captain": {
    "id": "iron_captain",
    "name": "黑铁亲卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#686B79",
    "homeChapter": 14,
    "artAtlas": "mobs_fortress_v66",
    "guard": {
      "period": 8,
      "duration": 3,
      "reduction": 0.4
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 39,
    "description": "黑铁要塞的精英单位。每8秒防御3秒，减伤40%。 铠甲减少35%物理伤害，法术不受影响。",
    "traits": [
      "每8秒防御3秒，物理减伤40%",
      "物抗35%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.35,
    "armorBreakRatio": 0.3
  },
  "iron_commander": {
    "id": "iron_commander",
    "name": "黑铁统帅",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#686B79",
    "homeChapter": 14,
    "artAtlas": "mobs_fortress_v66",
    "aura": {
      "radius": 210,
      "attackMul": 1.2
    },
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.3,
      "speedMul": 1.1
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 116,
    "description": "黑铁要塞的首领单位。提高附近友军20%攻线伤害。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "提高附近友军20%攻线伤害",
      "生命低于45%进入强化阶段",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "lava_larva": {
    "id": "lava_larva",
    "name": "岩浆虫",
    "kind": "melee",
    "hp": 180,
    "dmg": 27,
    "atkInterval": 3.8,
    "speed": 36,
    "radius": 18,
    "color": "#AE654A",
    "homeChapter": 15,
    "artAtlas": "mobs_volcano_v66",
    "exp": 24,
    "charge": 1,
    "gold": 7,
    "description": "熔火裂谷的群体近战单位。成群接近防线，单体生命较低。",
    "traits": [
      "成群接近防线，单体生命较低"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "flame_spirit": {
    "id": "flame_spirit",
    "name": "灰烬焰灵",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#AE654A",
    "homeChapter": 15,
    "artAtlas": "mobs_volcano_v66",
    "airborne": true,
    "exp": 24,
    "charge": 2,
    "gold": 7,
    "description": "有35%法抗符盾。熔火裂谷的远程攻击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "magma_shell": {
    "id": "magma_shell",
    "name": "熔壳兽",
    "kind": "melee",
    "hp": 580,
    "dmg": 48,
    "atkInterval": 4.6,
    "speed": 20,
    "radius": 27,
    "color": "#AE654A",
    "homeChapter": 15,
    "artAtlas": "mobs_volcano_v66",
    "split": {
      "id": "lava_larva",
      "count": 2
    },
    "exp": 24,
    "charge": 2,
    "gold": 7,
    "description": "熔火裂谷的重型前排单位。被击败后分裂出2只小怪。",
    "traits": [
      "被击败后分裂出2只小怪"
    ],
    "weak": "范围攻击，并为后续小怪保留技能"
  },
  "obsidian_guard": {
    "id": "obsidian_guard",
    "name": "黑曜重卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#AE654A",
    "homeChapter": 15,
    "artAtlas": "mobs_volcano_v66",
    "guard": {
      "period": 8,
      "duration": 2.8,
      "reduction": 0.35
    },
    "split": {
      "id": "lava_larva",
      "count": 3
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 40,
    "description": "熔火裂谷的精英单位。每8秒防御2.8秒，减伤35%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "每8秒防御2.8秒，物理减伤35%",
      "被击败后分裂出3只小怪",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "molten_beast": {
    "id": "molten_beast",
    "name": "熔山巨兽",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#AE654A",
    "homeChapter": 15,
    "artAtlas": "mobs_volcano_v66",
    "phase": {
      "threshold": 0.45,
      "attackMul": 1.35,
      "speedMul": 1.08
    },
    "summon": {
      "id": "lava_larva",
      "count": 2,
      "every": 15,
      "limit": 8
    },
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 120,
    "description": "熔火裂谷的首领单位。定时召唤援军，每只最多8只。",
    "traits": [
      "定时召唤援军，每只最多8只",
      "生命低于45%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  },
  "rift_hound": {
    "id": "rift_hound",
    "rush": {
      "period": 6,
      "duration": 1.4,
      "multiplier": 1.8
    },
    "name": "虚空猎兽",
    "kind": "melee",
    "hp": 240,
    "dmg": 36,
    "atkInterval": 3.6,
    "speed": 48,
    "radius": 21,
    "color": "#7D6A9C",
    "homeChapter": 16,
    "artAtlas": "mobs_rift_v66",
    "charge": 2,
    "exp": 24,
    "gold": 7,
    "description": "裂隙王座的快速突击单位。每6秒短暂加速推进。",
    "traits": [
      "每6秒短暂加速推进"
    ],
    "weak": "减速与眩晕，及时清理快攻单位"
  },
  "mirror_fiend": {
    "id": "mirror_fiend",
    "name": "镜影魔",
    "kind": "ranged",
    "hp": 220,
    "dmg": 30,
    "atkInterval": 4.8,
    "speed": 25,
    "radius": 22,
    "atkRange": 285,
    "color": "#7D6A9C",
    "homeChapter": 16,
    "artAtlas": "mobs_rift_v66",
    "airborne": true,
    "revive": 0.2,
    "exp": 24,
    "charge": 2,
    "gold": 7,
    "description": "有35%法抗符盾。裂隙王座的远程攻击单位。飞行单位，可被全部英雄攻击。",
    "traits": [
      "飞行单位，可被全部英雄攻击",
      "第一次倒下后恢复部分生命，仅复生一次",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "rift_priest": {
    "id": "rift_priest",
    "name": "裂隙祭司",
    "kind": "heal",
    "hp": 640,
    "dmg": 0,
    "atkInterval": 4,
    "speed": 24,
    "radius": 23,
    "healAmount": 48,
    "color": "#7D6A9C",
    "homeChapter": 16,
    "artAtlas": "mobs_rift_v66",
    "exp": 24,
    "charge": 2,
    "gold": 7,
    "description": "有35%法抗符盾。生命较高的支援单位，读条后治疗附近伤员；冰封、眩晕可打断。",
    "traits": [
      "每4秒治疗，施法准备1.2秒",
      "回复4%生命，最多治疗3名伤员",
      "冰封、眩晕可打断，治疗者不互疗",
      "法抗35%，持续法术命中可破盾"
    ],
    "weak": "物理输出，或法术集火破盾；冰封、眩晕仍有效",
    "magicRes": 0.35,
    "wardBreakRatio": 0.3
  },
  "rift_guard": {
    "id": "rift_guard",
    "name": "裂隙重卫",
    "kind": "melee",
    "hp": 2800,
    "dmg": 96,
    "atkInterval": 4.8,
    "speed": 18,
    "radius": 34,
    "color": "#7D6A9C",
    "homeChapter": 16,
    "artAtlas": "mobs_rift_v66",
    "guard": {
      "period": 8,
      "duration": 3,
      "reduction": 0.4
    },
    "elite": true,
    "exp": 65,
    "charge": 8,
    "gold": 41,
    "description": "裂隙王座的精英单位。每8秒防御3秒，减伤40%。 铠甲减少30%物理伤害，法术不受影响。",
    "traits": [
      "每8秒防御3秒，物理减伤40%",
      "物抗30%，持续物理命中可破甲"
    ],
    "weak": "法术输出，或物理集火破甲后爆发",
    "physRes": 0.3,
    "armorBreakRatio": 0.3
  },
  "rift_sovereign": {
    "id": "rift_sovereign",
    "name": "裂隙君主",
    "kind": "melee",
    "hp": 9000,
    "dmg": 132,
    "atkInterval": 5.2,
    "speed": 16,
    "radius": 47,
    "color": "#7D6A9C",
    "homeChapter": 16,
    "artAtlas": "mobs_rift_v66",
    "summon": {
      "id": "rift_hound",
      "count": 2,
      "every": 15,
      "limit": 8
    },
    "phase": {
      "threshold": 0.5,
      "attackMul": 1.4,
      "speedMul": 1.2
    },
    "windup": 1.5,
    "boss": true,
    "exp": 140,
    "charge": 20,
    "gold": 124,
    "description": "裂隙王座的首领单位。定时召唤援军，每只最多8只。",
    "traits": [
      "定时召唤援军，每只最多8只",
      "攻击前蓄力1.5秒，可用眩晕打断",
      "生命低于50%进入强化阶段"
    ],
    "weak": "优先集火支援者，避免敌群积累"
  }
};
/** Preserve the former chapter 1..3 scale, grow linearly instead of exponentially. */
export function chapterPower(chapter: number): number { return 1 + Math.max(0, chapter - 1) * .55; }
export function chapterNumeral(chapter: number): string {
  const n = Math.floor(chapter), digits = ['零','一','二','三','四','五','六','七','八','九'];
  return n < 10 ? digits[n] : n < 20 ? '十' + (n % 10 ? digits[n % 10] : '') : String(n);
}
/** All live portraits and combat sprites share this registry. */
export function enemyArtRef(id: string, portrait = false): { atlas: string; frame: string } {
  const mob = EXPANSION_MOBS[id];
  if (mob) return { atlas: mob.artAtlas!, frame: id };
  if (['orc_axeman','orc_siege_cart','goblin_slinger','goblin_king'].includes(id))
    return { atlas: 'chapter1_mob_walk_v84', frame: portrait ? id + '_w0' : id };
  if (['goblin_worker','goblin_shaman','goblin_brute','wolf_rider'].includes(id))
    return { atlas: 'chapter1_mob_walk_v81', frame: portrait ? id + '_w0' : id };
  if (portrait && ['goblin_worker','goblin_slinger','goblin_shaman','wolf_rider','goblin_brute'].includes(id))
    return { atlas: 'battle_mob_anim_v1', frame: id + '_w0' };
  return { atlas: 'battle_mobs_v2', frame: id };
}
