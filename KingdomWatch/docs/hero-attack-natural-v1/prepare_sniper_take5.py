from pathlib import Path
import json, urllib.request

ROOT=Path(__file__).resolve().parent
folder=ROOT.parent/'sniper-attack-natural-v1'
(folder/'takes/04/production-rejection.json').write_text(json.dumps({
    'reason':'Additional same-pose image reference did not prevent crossbow muzzle flash or restore the original weapon height',
    'action':'Regenerate whole source through the other account-available MiniMax H3 channel',
    'animationAcceptedByUser':False},indent=2),encoding='utf-8')
data=json.loads(urllib.request.urlopen('https://lensapi.cn/api/pricing',timeout=20).read())
model=next(item for item in data['data'] if item['model_name']=='lens-video-0f4c4ca37ccb')
(ROOT/'alternate-video-interface.json').write_text(json.dumps({'source':'https://lensapi.cn/api/pricing',
    'model':model['model_name'],'videoParameters':model['video_parameters'],
    'reason':'Complete restrained source from another supported H3 channel, not chopped or reversed failed source'},
    ensure_ascii=False,indent=2),encoding='utf-8')
prompt='''A four-second complete character animation cycle, using the supplied image as BOTH the exact initial pose and the exact final pose. Animate only the exact illustrated blue-caped hero, with the same rigid wooden crossbow held level in both hands. The object is an INERT WOODEN CROSSBOW, not a firearm: no light, discharge, projectile, smoke, sparks, fire or flash ever comes from it. The red background is perfectly uniform and unchanged.

Preserve the exact ready stance, head position, proportions, costume and horizontal crossbow direction. Both boots remain planted at the same fixed locations. Both hands stay in the same grip. Elbows, hands and the crossbow stay at the original shoulder height during the entire clip. Never lower, raise or rotate the crossbow. This is one small tension-and-release cycle of the held ready pose, with a restrained visible shoulder reaction and naturally following cape, not a change of stance.

Beginning: the reference ready pose. First quarter: the existing shoulders and elbows gently tense in place, without changing the weapon's height or angle. Around 1.3 seconds: the existing shoulder armor gives ONE compact rearward pulse of only a few pixels. Then shoulders relax back along a natural forward-time trajectory. The cape's connected folds ripple softly after the reaction, with natural inertia and overlapping cloth motion. During the last quarter, the entire body and cloth naturally return to the exact initial reference silhouette, grip, cape outline and original painted folds. At four seconds the whole character matches the input ready pose. Do not leave the arms lowered or the cape displaced at the end. Do not add a second gesture or a frozen ending pause.

The character is a flat painted game sprite, not a cinematic scene. Keep every painted surface at its original fixed brightness and color. Nothing new appears in the image: only the existing anatomy and cloth move. No lighting effect or anything emitted from the crossbow. No camera movement, zoom, character scaling, body turn, walking, stepping, jumping, bending, large breathing, wide arm sweep, anatomy morphing or weapon deformation. Keep the FULL body, both boots, the entire crossbow and every cape tip well inside the original image with wide margins on every side. Natural chronological forward motion throughout, without reversal or opacity transitions.'''
prompt='''Four-second closed animation cycle of the EXACT blue-caped illustrated hero in the reference. The supplied pose is BOTH the starting and finishing pose. Fixed camera, unchanged framing and scale, perfectly uniform solid RED background.

Keep both boots planted, the head and torso height fixed. Keep the same hand grip. The rigid wooden crossbow stays LEVEL at the original SHOULDER HEIGHT and original forward direction throughout. NEVER lower, lift or rotate it. The crossbow is inert wood and metal, not a firearm. Every painted surface keeps its original fixed brightness. Nothing exits the crossbow; no flash, sparks, smoke, glow, particles, arrow, projectile, fire, added light or new objects in any frame.

ONE small tension-and-release cycle of the original held stance. First quarter: gently tense the shoulders and elbows in place without changing the weapon height or angle. Around 1.3 seconds: give ONE compact rearward shoulder-armor pulse, only a few pixels. Then relax the connected shoulders back smoothly. The cape softly follows with a small natural ripple and overlapping cloth inertia. In the final quarter the shoulders, hands, crossbow and entire cape naturally settle to the EXACT original ready pose, outline and folds. At four seconds match the reference pose and weapon height. Do not finish with lowered arms or displaced cloth. No second gesture or frozen ending hold.

Preserve the exact painted anatomy, colors, costume and weapon shape. No body turn, stepping, crouching, bobbing, large arm movement, exaggerated breathing, camera movement, scaling or deformation. Keep the full body, boots, entire weapon and all cape tips well inside generous red margins. Natural chronological forward motion, no reverse recovery or opacity transition.'''
(folder/'attack-prompt.txt').write_text(prompt+'\n',encoding='utf-8')
