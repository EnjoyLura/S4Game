"""Read source and compute authored queue arithmetic; no game, tests or simulation."""
from pathlib import Path
import hashlib, json, re, difflib
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
changed = sorted(n for n,h in before.items() if sha(ROOT/n) != h)
expected = sorted('assets/scripts/'+n for n in ['config/LevelDifficulty.ts','ui/pages/LevelsPage.ts','ui/TrainingLobby.ts'])
if changed != expected: raise ValueError('Unexpected original file changes: '+str(changed))
new = sorted(p.relative_to(ROOT).as_posix() for d in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/d).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before)
expected_new = ['assets/scripts/config/SeventhLevel.ts','assets/scripts/config/SeventhLevel.ts.meta']
if new != expected_new: raise ValueError('Unexpected additions: '+str(new))
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
after = read(HERE/'types-after.log')
if norm(read(HERE/'types-before.log')) != norm(after): raise ValueError('Type diagnostics changed')
parts = []
for n in changed:
    parts.extend(difflib.unified_diff(read(HERE/'before'/n).splitlines(True), read(ROOT/n).splitlines(True),
        fromfile='before/'+n, tofile='after/'+n))
(HERE/'review.diff').write_text(''.join(parts), encoding='utf8')
source = read(ROOT/'assets/scripts/config/SeventhLevel.ts').split('export const SEVENTH_LEVEL_WAVES')[1]
waves = []
totals = dict(workers=0,slingers=0,riders=0,elite=0,shaman=0)
gold = dict(workers=2,slingers=3,riders=3,elite=25,shaman=4)
damage = dict(workers=10,slingers=8,riders=12,elite=24,shaman=0)
for i,part in enumerate(re.split(r'\{\s*groups:\s*\[', source)[1:]):
    groups = []
    for match in re.finditer(r'\b(workers|slingers|riders|elite|shaman)\(([^)]+)\)', part):
        name = match[1]
        args = [float(x.strip()) for x in match[2].split(',')]
        if name == 'workers':
            count,hp,interval = args[:3]; delay = args[3] if len(args)>3 else 0
        elif name in ['slingers','riders']:
            count,hp,delay = args; interval = 5 if name == 'slingers' else 3
        else:
            hp,delay = args; count = interval = 1
        count = int(count); totals[name] += count
        groups.append(dict(kind=name,count=count,hp=int(hp),damage=damage[name],interval=interval,delay=delay,
            lastSpawnSeconds=round(delay+(count-1)*interval,4)))
    waves.append(dict(wave=i+1,groups=groups,lastSpawnSeconds=max(g['lastSpawnSeconds'] for g in groups)))
queue_end = round(sum(w['lastSpawnSeconds'] for w in waves),4)
kill_gold = sum(totals[k]*gold[k] for k in totals)
total = sum(totals.values())
report = dict(waves=waves,counts=totals,totalEnemies=total,staticQueueEndSeconds=queue_end,
    authoredKillGold=kill_gold,oneStarGold=kill_gold+176,threeStarGold=kill_gold+208,
    averageQueueRate=total/queue_end,sixthLevelQueueRate=343/298.75,
    note='Static authored queue arithmetic only; no gameplay, combat simulation, measured duration or acceptance.')
sixth = json.loads(read(ROOT/'docs/sixth-level-balance-v47/wave-arithmetic.json'))
report['totalAuthoredHp'] = sum(g['count']*g['hp'] for w in waves for g in w['groups'])
report['sixthLevelAuthoredHp'] = sum(g['count']*g['hp'] for w in sixth['waves'] for g in w['groups'])
report['hpChangePercent'] = (report['totalAuthoredHp']/report['sixthLevelAuthoredHp']-1)*100
(HERE/'wave-arithmetic.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(dict(changed=changed,added=new,typeErrors=after.count('error TS'),counts=totals,total=total,queueEnd=queue_end)))
