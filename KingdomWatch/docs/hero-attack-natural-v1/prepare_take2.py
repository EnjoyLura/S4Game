from pathlib import Path
import json, shutil

ROOT = Path(__file__).resolve().parent
for hero in ['sniper', 'volt']:
    folder = ROOT.parent / f'{hero}-attack-natural-v1'
    archive = folder / 'takes/01'
    archive.mkdir(parents=True, exist_ok=True)
    for file in ['attack-prompt.txt','video-task.json','source.mp4','source-info.json','source-contact.jpg','weapon-contact.jpg']:
        shutil.copyfile(folder / file, archive / file)
    (archive / 'production-rejection.json').write_text(json.dumps({'reason':'Generated weapon flash/smoke or magic light despite character-only prompt',
        'action':'Regenerate the complete source; do not trim, reverse, erase, or publish this take',
        'userAcceptance':False},indent=2),encoding='utf-8')

sniper = '''Create a short animation study of the exact blue-hooded illustrated figure in the input. The image is a painted game character, with a rigid wooden and metal handheld crossbow. Locked camera and unchanged image composition. This is a purely physical shoulder-and-hand movement study, rendered as the same flat painted illustration on the same perfectly uniform RED background.

In two seconds, perform ONE small coordinated movement: both hands firmly hold the exact same object in its original level position. The connected elbows draw backward by a very small distance, about one percent of total figure height; the shoulders settle slightly backward with the hands, then the elbows and shoulders smoothly return to their exact original positions. The handheld object's direction, construction and level orientation remain constant. The movement is compact and connected, recognizable as a brief firming of the stance. The complete blue cape moves gently with normal cloth inertia throughout, settles naturally, and returns close to the original silhouette. Start and finish with the SAME input pose, body height, head position, hands, object and both planted boot positions.

At 0.0s the input ready pose; 0.2s the elbows begin the small backward motion; 0.5s the motion reaches its compact peak; from 0.5s to 1.7s the arms naturally settle to the input pose; at 2.0s the original ready silhouette is restored. Smooth forward motion throughout. Maintain the exact costume and body proportions. Entire figure, every cape tip and the handheld object stay inside the original frame with wide red margins. No walking, turning, crouching, bobbing, object raising, lowering or changing hands. The background stays uniformly red and every painted surface keeps its original steady color and brightness. Output contains only the existing painted figure and red background; all movement belongs to the existing anatomy and cloth. No additional objects, additional light, emissions, overlays, particles or cinematic embellishments. The handheld object remains inert and its mechanism does not release anything. No camera motion or resizing.'''

volt = '''Create a short animation study of the exact purple-robed illustrated figure in the input. Locked camera and unchanged image composition. This is a purely physical right-hand gesture study, rendered as the same flat painted game illustration on the same perfectly uniform RED background. Every painted surface keeps its original steady color and brightness.

In two seconds, perform ONE small coordinated movement: the free hand on screen-right gently opens its existing fingers and extends forward and slightly upward, about three percent of total figure height. The wrist, elbow and connected shoulder follow this compact movement naturally. At its peak, the palm faces forward for a brief smooth gesture, then the same fingers, hand, elbow and shoulder smoothly return to their exact original input pose. The hand on screen-left holds the exact same rigid staff in the SAME grip, direction, position and angle throughout. The staff and purple crystal remain inert, with their original painted color and stable brightness. The robe's hanging panels softly follow the body with normal cloth inertia and settle back close to their original silhouette.

At 0.0s the input ready pose; from 0.2s the right hand extends gently; at 0.5s it reaches the small forward palm gesture; from 0.5s to 1.7s it naturally returns to its original position; at 2.0s the original input pose is restored. Both boots stay planted at their exact positions. Head height and torso position remain unchanged. No walking, turning, bobbing, crouching or exaggerated arm sweep. The entire figure, all robe tips and the staff crystal remain inside the image with wide red margins. Output contains only the existing painted figure and perfectly uniform red background; all movement belongs to the existing anatomy and cloth. No additional objects, additional light, emissions, overlays, particles or cinematic embellishments. Preserve the exact costume, anatomy, colors and proportions. No camera movement, zoom or character resizing. Every frame moves naturally forward in time.'''

for hero, prompt in [('sniper',sniper),('volt',volt)]:
    (ROOT.parent / f'{hero}-attack-natural-v1/attack-prompt.txt').write_text(prompt+'\n',encoding='utf-8')
