"""Static source, type, resource and scope inspection. Does not run game code."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import difflib, hashlib, json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
changed = sorted(n for n,h in before.items() if sha(ROOT/n) != h)
expected = sorted(['assets/scripts/config/Cards.ts', 'assets/scripts/battle/Hero.ts',
    'assets/scripts/battle/Projectile.ts', 'assets/scripts/battle/UltimateTiming.ts',
    'assets/scripts/ui/Panels.ts', 'assets/scripts/ui/PickArt.ts',
    'assets/scripts/ui/BattleComicPanels.ts'])
assert changed == expected, changed
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log')) == norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS') == 10
review=[]
for name in changed:
    saved=HERE/'before'/name
    assert sha(saved)==before[name],name
    review.extend(difflib.unified_diff(read(saved).splitlines(True),read(ROOT/name).splitlines(True),
        fromfile='before/'+name,tofile='after/'+name))
(HERE/'review.diff').write_text(''.join(review),encoding='utf-8')

cards=read(ROOT/'assets/scripts/config/Cards.ts')
old=read(HERE/'before/assets/scripts/config/Cards.ts')
def block(s,a,b):
    start=s.index(a)
    return s[start:s.index(b,start)]
for a,b in [('function commonHeroCards','/** Each acquisition'),
            ('export const ARCHER_CARDS','/* ---------- 火焰法师'),
            ('export const PYRO_CARDS','/* ---------- 雷电法师'),
            ('export const VOLT_CARDS','/* ---------- 冰霜法师'),
            ('export const GLOBAL_CARDS','export const M0_POOL')]:
    assert block(cards,a,b)==block(old,a,b),a
# Every other hero retains its exact combat implementation. Only imports change above FrostHero.
hero=read(ROOT/'assets/scripts/battle/Hero.ts')
oldhero=read(HERE/'before/assets/scripts/battle/Hero.ts')
stripimports=lambda s:re.sub(r'^import .*\n','',s,flags=re.M)
assert stripimports(hero[:hero.index('export class FrostHero')])==stripimports(oldhero[:oldhero.index('export class FrostHero')])

ice=block(cards,'export const MORA_CARDS','/* ---------- 全局卡')
objects=re.findall(r"c\(\{ id: '(.*?)(?=\n  c\(\{|\n\];)",ice,re.S)
entries=[dict(id='mora_'+k,rarity=r,maxStacks=n) for k,r,n in
    [('attack','white',5),('aspd','white',4),('crit_rate','blue',4),('crit_dmg','blue',3)]]
for obj in objects:
    entries.append(dict(id=obj.split("'",1)[0],rarity=re.search(r"rarity: '([^']+)'",obj)[1],
        maxStacks=int(re.search(r'maxStacks: (\d+)',obj)[1])))
entries += [dict(id='mora_unlock_'+k,rarity='gold',maxStacks=1) for k in ['skill','ult']]
counts={r:sum(e['rarity']==r for e in entries) for r in ['white','blue','purple','gold']}
assert len(entries)==17 and len({e['id'] for e in entries})==17
assert counts==dict(white=2,blue=7,purple=5,gold=3),counts
assert 'mora_morale' not in ice
assert 'x.hero.moraFreezeLinger = (x.hero.moraFreezeLinger || 0) + 1' in ice
assert 'x.hero.moraUltFreeze = 1.5' in ice
assert 'export const MORA_ULT_HITS = 3' in cards
assert ' / MORA_ULT_HITS' in cards
assert 'this.ultimateHitsLeft = MORA_ULT_HITS' in hero
assert 'FROST_ULT_HIT_GAP = 1.2' in read(ROOT/'assets/scripts/battle/UltimateTiming.ts')
# Source-only inspection of all damage/status paths, never evaluate combat logic.
projectile=read(ROOT/'assets/scripts/battle/Projectile.ts')
assert 'sp.coldBonus && (m.slowT > 0 || m.freezeT > 0)' in projectile
assert 'if (sp.freezeChance && Math.random() < sp.freezeChance)' in projectile
assert 'target.applyFreeze' not in hero[hero.index('export class FrostHero'):]
assert 'const frozen = this.stats.moraUltFreeze && m.applyFreeze' in hero
assert 'if (!frozen) m.applySlow(slow, slowDuration)' in hero

art=json.loads(read(HERE/'art-manifest.json'))['assets']
assert len(art)==8
for a in art:
    p=ROOT/a['path']
    assert sha(p)==a['sha256']==sha(Path(a['source']))
    assert p.stem in cards
    meta=json.loads(read(p.with_suffix('.png.meta')))
    assert meta['uuid']==a['uuid']
    assert meta['subMetas']['f9941']['userData']['rawWidth']==a['width']
sheet=Image.new('RGB',(1125,520),'#d9ddd9')
draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for i,a in enumerate(art):
    im=Image.open(ROOT/a['path']).convert('RGBA'); im.thumbnail((205,205))
    x,y=(i%5)*225,(i//5)*260
    sheet.paste(im,(x+(225-im.width)//2,y+6),im)
    draw.text((x+5,y+220),a['id'],font=font,fill='#111111')
sheet.save(HERE/'final-art-contact.png')
record=dict(originalFilesChecked=len(before),changedExistingFiles=changed,
    allOriginalMediaUnchanged=True,preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,
    otherHeroCombatAndCardEffectsUnchanged=True,cardCount=17,rarityCounts=counts,cards=entries,
    generatedIcons=8,redrawnIceIcons=7,newIceIcons=1,
    designValues=dict(ultimateHits=3,ultimateContactSeconds=[.5,1.7,2.9],
        ultimateBaseTotalDamageUnchanged=True,fieldBaseFreezeSeconds=1.5,
        freezeExtensionPerCard=1,freezeExtensionMaxStacks=2,fieldBaseMaxFreezeSeconds=3.5,
        fieldFreezeWithLevel80AndSkill15=4.2,allSlowExtensionMaxSeconds=2,
        normalCardFreezeChanceWithoutBreakthrough=[0,.15,.3],
        normalCardFreezeChanceWithBreakthrough=[.15,.3,.45],
        normalFreezeSeconds=.6,coldCardMaxBonus=.6,ultimateGoldFreezeSeconds=1.5,
        ultimateRepeatedFreeze='refresh max remaining, not additive',bossFreezeImmune=True,
        slowRatioCap=.9,chargeRequirementMultiplier=.5625))
(HERE/'source-review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('Static source/type/hash review: 17 ice cards (2/7/5/3); 8 icons; 7 scripts; 10 prior type diagnostics unchanged.')
