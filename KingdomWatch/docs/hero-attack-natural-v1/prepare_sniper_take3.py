from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
folder = ROOT.parent / 'sniper-attack-natural-v1'
(folder / 'takes/02/production-rejection.json').write_text(json.dumps({
    'reason':'The crossbow and arms lower and never return to the initial ready pose',
    'action':'Regenerate full source; do not reverse recovery, trim or substitute mismatched final pose',
    'animationAcceptedByUser':False},indent=2),encoding='utf-8')
prompt='''Locked-off full-body animation of the EXACT painted blue-hooded figure in the reference, standing on a perfectly uniform RED field. Preserve the exact image composition, clothing, body proportions, boots and handheld wooden-and-metal object.

The figure keeps BOTH ARMS FROZEN in the exact input grip and elbow positions. The rigid handheld object stays continuously at the exact original SHOULDER HEIGHT, level and aimed in exactly the original direction. Its height and angle NEVER change. The figure maintains this SAME raised ready pose for the entire clip. Hands and elbows remain at the original height at every moment. Do not lower, lift, swing, rotate, extend or retract either arm or the object. Do not relax into a different pose.

Animate ONE tiny shoulder tension pulse: around 0.45 seconds, the shoulder armor and the upper back give a brief compact twitch of only TWO PIXELS, then immediately settle back by 0.85 seconds. The pulse is connected to the existing anatomy, without any arm motion or body turning. Head and torso height stay constant; both boots stay planted in exactly the input positions. The blue cape softly ripples with a little natural inertia behind the brief shoulder pulse. From 0.85 seconds to 2.00 seconds keep the original precise ready silhouette with only very small gentle cloth motion, settling close to the original cape folds and outline by the end. At 2.00 seconds the whole character, head, shoulders, hands, object and boots match the initial reference pose exactly. This is a simple small tension-and-relaxation loop of a held stance, not a change of stance. Always maintain the exact original weapon grip.

Only the already-painted anatomy and cloth move. No additional objects, additional light, emissions, clouds, overlays, particles or cinematic effects. The handheld object is completely inert and nothing exits it. Every existing painted surface has its original steady color and brightness. The solid RED field is unchanging and uniform. No camera movement, zoom, scale change, walking, leaning, body bobbing, crouching, spinning or exaggerated breathing. Keep every boot, cape tip and the whole handheld object inside the image with generous margins on every side. All movement progresses naturally forward in time.'''
(folder / 'attack-prompt.txt').write_text(prompt+'\n',encoding='utf-8')
