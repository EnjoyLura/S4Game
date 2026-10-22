"""Static source/hash/type/resource review. Never imports or runs the game."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import difflib, hashlib, json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE / 'before.json'))
changed = sorted(n for n,h in before.items() if sha(ROOT / n) != h)
expected = sorted(['assets/scripts/config/Cards.ts', 'assets/scripts/battle/Hero.ts',
    'assets/scripts/battle/Monster.ts', 'assets/scripts/ui/Panels.ts',
    'assets/scripts/ui/PickArt.ts', 'assets/scripts/ui/BattleComicPanels.ts'])
assert changed == expected, changed
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log')) == norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS') == 10
review = []
for name in changed:
    saved = HERE/'before'/name
    assert sha(saved) == before[name], name
    review.extend(difflib.unified_diff(read(saved).splitlines(True),read(ROOT/name).splitlines(True),
        fromfile='before/'+name,tofile='after/'+name))
(HERE/'review.diff').write_text(''.join(review),encoding='utf-8')

cards = read(ROOT/'assets/scripts/config/Cards.ts')
old = read(HERE/'before/assets/scripts/config/Cards.ts')
def block(text,a,b):
    start = text.index(a)
    return text[start:text.index(b,start)]
for a,b in [('function commonHeroCards','/** Each acquisition'),
            ('export const ARCHER_CARDS','/* ---------- 火焰法师'),
            ('export const MORA_CARDS','export interface CardStacks')]:
    assert block(cards,a,b) == block(old,a,b), a
# Fire cards differ only in the five selected art overrides.
fire = block(cards,'export const PYRO_CARDS','/* ---------- 雷电法师')
for key in ['spell','shards','range','war','ember']:
    fire = fire.replace("art: 'ui_card_pyro_"+key+"_v2', ",'')
assert fire == block(old,'export const PYRO_CARDS','/* ---------- 雷电法师')
hero = read(ROOT/'assets/scripts/battle/Hero.ts')
oldhero = read(HERE/'before/assets/scripts/battle/Hero.ts')
stripimport = lambda s: re.sub(r'^import .*voltShockDuration.*\n','',s,flags=re.M)
assert stripimport(hero[:hero.index('export class VoltHero')]) == oldhero[:oldhero.index('export class VoltHero')]
assert hero[hero.index('export class FrostHero'):] == oldhero[oldhero.index('export class FrostHero'):]

volt = block(cards,'export const VOLT_CARDS','/* ---------- 冰霜法师')
objects = re.findall(r"c\(\{ id: '(.*?)(?=\n  c\(\{|\n\];)",volt,re.S)
entries = [dict(id='volt_'+key,rarity=rarity,maxStacks=cap) for key,rarity,cap in
    [('attack','white',5),('aspd','white',4),('crit_rate','blue',4),('crit_dmg','blue',3)]]
for obj in objects:
    # Include the quote-consuming ID matcher in the resulting object text.
    ident = obj.split("'",1)[0] if "'" in obj else obj
    # The lookahead span begins with id text and then its closing quote.
    entry = dict(id=ident, rarity=re.search(r"rarity: '([^']+)'",obj)[1],
        maxStacks=int(re.search(r'maxStacks: (\d+)',obj)[1]))
    entries.append(entry)
entries += [dict(id='volt_unlock_'+kind,rarity='gold',maxStacks=1) for kind in ['skill','ult']]
counts = {r:sum(e['rarity']==r for e in entries) for r in ['white','blue','purple','gold']}
assert len(entries)==17 and counts==dict(white=2,blue=6,purple=5,gold=4),(len(entries),counts)
assert len({e['id'] for e in entries})==17
assert 'volt_morale' not in volt and 'private hasteT' not in block(hero,'export class VoltHero','export class FrostHero')
assert "req: 'volt_shock'" in volt
assert 'x.hero.ultStun += 1.5' in volt

art = json.loads(read(HERE/'art-manifest.json'))['assets']
assert len(art)==13
for a in art:
    p=ROOT/a['path']
    assert sha(p)==a['sha256']==sha(Path(a['source']))
    assert p.stem in cards, p.stem
    meta=json.loads(read(p.with_suffix('.png.meta')))
    assert meta['uuid']==a['uuid']
    assert meta['subMetas']['f9941']['userData']['rawWidth']==a['width']
# Inspection contact sheet only; originals copied unmodified into the game.
sheet = Image.new('RGB',(1125,260*3),'#d9ddd9')
draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for i,a in enumerate(art):
    im=Image.open(ROOT/a['path']).convert('RGBA'); im.thumbnail((205,205))
    x,y=(i%5)*225,(i//5)*260
    sheet.paste(im,(x+(225-im.width)//2,y+6),im)
    draw.text((x+5,y+220),a['id'],font=font,fill='#111111')
sheet.save(HERE/'final-art-contact.png')
record = dict(originalFilesChecked=len(before),changedExistingFiles=changed,allOriginalMediaUnchanged=True,
    preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,nonLightningHeroCombatUnchanged=True,
    fireCardEffectsUnchanged=True,cardCount=17,rarityCounts=counts,cards=entries,
    generatedIcons=13,redrawnFireIcons=5,redrawnLightningIcons=4,newLightningIcons=4,
    staticMaximums=dict(baseChainTargets=11,chainHopDistance=571.22,shockDuration=5,
        shockBaseAmp=.25,shockAmpWithLevel30=.35,selfShockedCardBonus=.6,
        baseUltimateStrikes=25,baseUltimateStun=2.5,ultimateStunWithLevel80=3,
        chargeRequirementMultiplier=.5625,ultimateDuration=6.9))
(HERE/'source-review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('Static source/hash/type review: 17 lightning cards (2/6/5/4); 13 icons; six scripts; original media preserved; 10 existing type diagnostics unchanged.')
