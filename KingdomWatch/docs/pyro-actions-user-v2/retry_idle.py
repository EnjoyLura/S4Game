"""Retain the rejected complete take before a second same-resolution request."""
from pathlib import Path
import json
import shutil

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
current, rejected = (OUT/'idle').resolve(), (OUT/'idle-attempt-1').resolve()
# Verify absolute boundaries before moving a Windows directory.
OUT.resolve().relative_to(GAME.resolve())
current.relative_to(OUT.resolve())
rejected.relative_to(OUT.resolve())
if rejected.exists():
    raise RuntimeError('The rejected take already exists; do not overwrite provenance')
for name in ['generation.log','generation.err.log']:
    shutil.copy2(OUT/name,current/name)
current.rename(rejected)
current.mkdir()
shutil.copy2(rejected/'first-frame.png',current/'first-frame.png')
prompt = '''The two supplied images are identical. Image 1 is the exact START frame and Image 2 is the exact END frame. Animate the same full-body rear-view fire mage gently from Image 1 back to Image 2 over one two-second seamless idle cycle. The character must finish in the identical illustrated pose and the identical cape and robe outline. This is a closed periodic idle, not a shot with a beginning or ending.

Keep both feet, body location, orange hair, left hand and staff at their original positions. Very small shoulder breathing only, less than 1% height. The robe has one tiny soft flutter outward in the first half, and returns to its ORIGINAL shape in the second half, completing its motion at exactly the final frame. Keep the amplitude of the robe tips less than 1% of character height. No sustained wind blowing the cape farther to one side. Maintain natural forward-time cloth inertia, do not reverse the sequence. The final instant has the same slow movement direction as the opening, without a pause or hold. No step, no attack, no spell or large body movement.

The sole priority is a small complete breathing cycle with the START AND END matching Image 1 and Image 2. Same green background and unchanging cel illustration colors. The staff crystal is painted, with no emitted light. No fire, glow, sparks, smoke, dust, magic, particles, projectile, shadow, scenery, text or sound effects. Locked camera, unchanged framing, scale and ground anchor. Keep complete staff, head, hands, boots and robe tips fully within the frame with generous margin at all times. No zoom, crop, cut, fade, dissolve, frozen ending or exposure change. The whole two-second sequence must loop directly forward with no visible seam.
'''
(current/'idle-prompt.txt').write_text(prompt,encoding='utf-8')
(rejected/'rejection.json').write_text(json.dumps({'reason':'Source ends in a different cloth phase and cape outline',
    'published':False,'packagedForGame':False,'allOriginalFramesPreserved':True,
    'nextAttemptResolution':'768p','nextAttemptModel':'lens-minimax-h3-768p'},indent=2),encoding='utf-8')
print('Complete first take preserved; prepared identical first/end reference retry at 768p')
