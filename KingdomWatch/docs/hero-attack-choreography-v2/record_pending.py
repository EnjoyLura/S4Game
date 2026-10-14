"""Record a failed generation accurately; do not build or publish defective character clips."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import json

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
source = GAME / 'docs/sniper-attack-choreography-v2'
rejection = {'status': 'rejected', 'usableForPackaging': False, 'animationAcceptedByUser': False,
             'taskId': 'task_xS9uVQXeUR0N1jZUJFYQW3GgorQMQYk2', 'frames': 107,
             'reason': 'Source video contains two baked-in muzzle flashes around frames 9-11 and 45-47; reload does not clearly follow the requested single mechanical cycle.',
             'requiredAction': 'Regenerate the complete source. Do not omit flashes, crop, reverse, relabel or publish the failed take.',
             'reviewScope': 'Local source production annotation; no game, browser, test or online QA.'}
for folder in [source, source / 'takes/01']:
    (folder / 'source-rejection.json').write_text(json.dumps(rejection, ensure_ascii=False, indent=2), encoding='utf-8')
production = {'date': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
              'status': 'awaiting_project_video_credit', 'availableHeroes': [], 'gameChanged': False,
              'buildPerformed': False, 'published': False, 'animationAcceptedByUser': False,
              'sniper': rejection,
              'volt': {'status': 'not_submitted', 'providerCode': 'insufficient_user_quota', 'promptPrepared': True},
              'retained': {'sniperIdle': 'sniper_idle_natural_v2', 'voltIdle': 'volt_idle_natural_v1',
                           'archer': 'unchanged', 'displayHeight': {'sniper': 153, 'volt': 146, 'archer': 185.64}},
              'nextAction': 'After the user replenishes credit, regenerate both attacks, annotate complete chronological phases, integrate valid full clips, build and publish.'}
(ROOT / 'production.json').write_text(json.dumps(production, ensure_ascii=False, indent=2), encoding='utf-8')
readme = ROOT / 'README.md'
readme.write_text(readme.read_text(encoding='utf-8') + '\n重弩手新任务已返回 107 帧，但出现两次枪焰且没有清晰完整上弩过程，已记录 `source-rejection.json` 并作废，不制作图集、不构建、不发布。雷法师未创建任务。两人均待补充项目 AI 视频额度后重生成；当前线上没有本版新攻击。\n', encoding='utf-8')
paragraph = ('2026-10-14 用户明确否定 `hero-attack-natural-v1` 的两人攻击。最新动作要求：重弩手小幅瞄准 → 机械发射 → 清楚的上弩手势 → 回正继续瞄准；雷法师前脚原地轻踏稳住重心 → 法杖小幅前伸施法 → 收杖回位。'
             '当前待机、静态图、握持设计与弓箭手保持，首尾衔接约束继续适用。新制作目录 `docs/hero-attack-choreography-v2/`，重弩手新任务返回的完整源片含两次枪焰且上弩过程不清晰，已作废，禁止包装或发布；雷法师提交因 `insufficient_user_quota` 失败，未创建任务。'
             '已告知用户补充 AI 视频额度。游戏代码与资源未更换，未构建或发布，不将旧版或本轮失败源片记为认可。待补充额度后重新生成完整源片，不能裁掉坏帧或强行发布。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
print(json.dumps({'status': production['status'], 'published': False, 'rejectedTask': rejection['taskId']}, ensure_ascii=False))
