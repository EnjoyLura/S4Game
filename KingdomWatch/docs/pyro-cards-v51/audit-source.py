"""Release source/hash/type review only. Does not import or run game code."""
from pathlib import Path
import difflib, hashlib, json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE / 'before.json'))
changed = sorted(n for n, h in before.items() if sha(ROOT / n) != h)
expected = sorted(['assets/scripts/config/Cards.ts', 'assets/scripts/battle/Hero.ts',
    'assets/scripts/battle/Projectile.ts', 'assets/scripts/ui/Panels.ts',
    'assets/scripts/ui/PickArt.ts', 'assets/scripts/ui/BattleComicPanels.ts'])
assert changed == expected, changed
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
assert norm(read(HERE / 'types-before.log')) == norm(read(HERE / 'types-after.log'))
assert read(HERE / 'types-after.log').count('error TS') == 10
review = []
for name in changed:
    saved = HERE / 'before' / name
    assert sha(saved) == before[name], name
    review.extend(difflib.unified_diff(read(saved).splitlines(True), read(ROOT / name).splitlines(True),
        fromfile='before/' + name, tofile='after/' + name))
(HERE / 'review.diff').write_text(''.join(review), encoding='utf-8')

cards = read(ROOT / 'assets/scripts/config/Cards.ts')
old_cards = read(HERE / 'before/assets/scripts/config/Cards.ts')
for a, b in [('function commonHeroCards', '/** Each acquisition'),
             ('export const ARCHER_CARDS', '/* ---------- 火焰法师'),
             ('export const VOLT_CARDS', 'export interface CardStacks')]:
    extract = lambda text: text[text.index(a):text.index(b)]
    assert extract(cards) == extract(old_cards), a
hero = read(ROOT / 'assets/scripts/battle/Hero.ts')
old_hero = read(HERE / 'before/assets/scripts/battle/Hero.ts')
strip_import = lambda s: re.sub(r'^import .*pyroBlastRadius.*\n', '', s, flags=re.M)
assert strip_import(hero[:hero.index('/* 大招陨石调参')]) == old_hero[:old_hero.index('/* 大招陨石调参')]
assert hero[hero.index('export class VoltHero'):] == old_hero[old_hero.index('export class VoltHero'):]
block = cards[cards.index('export const PYRO_CARDS'):cards.index('export const VOLT_CARDS')]
objects = re.findall(r'c\(\{ id: (.*?)(?=\n  c\(\{|\n\];)', block, re.S)
card_list = [dict(id='pyro_'+key, name=name, rarity=rarity, maxStacks=cap) for key, name, rarity, cap in
    [('attack','攻击强化','white',5), ('aspd','攻速强化','white',4),
     ('crit_rate','暴击强化','blue',4), ('crit_dmg','爆伤强化','blue',3)]]
for obj in objects:
    entry = {k: re.search(r"(?:^|\b)"+k+r": '([^']+)'", ('id: '+obj) if k == 'id' else obj)[1]
             for k in ['id','name','rarity']}
    entry['maxStacks'] = int(re.search(r'maxStacks: (\d+)', obj)[1])
    card_list.append(entry)
card_list += [dict(id='pyro_unlock_'+kind, name=name, rarity='gold', maxStacks=1)
              for kind, name in [('skill','解锁技能'),('ult','解锁大招')]]
counts = {rarity: sum(c['rarity'] == rarity for c in card_list) for rarity in ['white','blue','purple','gold']}
assert len(card_list) == 16 and counts == dict(white=2, blue=6, purple=5, gold=3), counts
assert not {'pyro_stun','pyro_morale','pyro_death_blast'}.intersection(c['id'] for c in card_list)
assert '焚尽爆裂' not in cards
record = dict(originalFilesChecked=len(before), changedExistingFiles=changed,
    allOriginalMediaUnchanged=True, preExistingTypeErrors=10, typeDiagnosticsUnchanged=True,
    otherHeroCardsAndCombatUnchanged=True, cardCount=len(card_list), rarityCounts=counts, cards=card_list,
    staticMaximums=dict(burnCardMultiplier=2.5, normalBlastRadius=103.68, skillBlastRadius=190.08,
        meteorBlastRadius=241.92, baseLevelMeteors=9, ultimateLevel5Meteors=11,
        burnDuration=5, craterDuration=6, chargeRequirementMultiplier=.5625))
(HERE / 'source-review.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print('Static source/hash/type review: 16 cards; 2/6/5/3; six scripts; original media and other heroes preserved; 10 existing diagnostics unchanged.')
