"""One still image -> a deterministic cutout walk. No generation model or video.

Run with Python + Pillow + NumPy. All paths are relative to this script.
The hand-authored masks are in the coordinate system of the 1254px source.
"""
from __future__ import annotations

import hashlib
import json
import math
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'goblin-worker-reference-style-v1/goblin-worker-front-blue-v1.png'
W = H = 1254
SIZE = 640
COUNT = 32
MS = 40
TAU = 2 * math.pi


def polygon(points):
    m = Image.new('L', (W, H))
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def union(a, b):
    return ImageChops.lighter(a, b)


def intersect(a, b):
    return ImageChops.multiply(a, b)


def sub(a, b):
    return ImageChops.subtract(a, b)


def key_blue(im):
    rgb = np.asarray(im.convert('RGB'), dtype=np.float32)
    # All the blue in this particular source is the solid-color backdrop.
    chroma = rgb[:, :, 2] - np.maximum(rgb[:, :, 0], rgb[:, :, 1])
    alpha = np.clip((65 - chroma) / 40, 0, 1)
    blue = np.median(rgb[20:100, 20:100], axis=(0, 1))
    color = (rgb - blue[None, None, :] * (1 - alpha[:, :, None])) / np.maximum(alpha[:, :, None], .025)
    color = np.clip(color, 0, 255)
    color[alpha < .015] = 0
    return Image.fromarray(np.dstack([color, alpha * 255]).astype('uint8'))


def translation(x, y):
    return np.array([[1., 0, x], [0, 1., y], [0, 0, 1.]])


def transform(pivot, target=None, angle=0., scale=(1., 1.)):
    target = pivot if target is None else target
    a = math.radians(angle)
    c, s = math.cos(a), math.sin(a)
    r = np.array([[c*scale[0], -s*scale[1], 0], [s*scale[0], c*scale[1], 0], [0, 0, 1.]])
    return translation(*target) @ r @ translation(-pivot[0], -pivot[1])


def point(m, p):
    return (m @ np.array([*p, 1.]))[:2]


def bone(src_a, src_b, dst_a, dst_b, width=1.):
    v, d = np.array(src_b)-src_a, np.array(dst_b)-dst_a
    ang = math.degrees(math.atan2(d[1], d[0]) - math.atan2(v[1], v[0]))
    direction = math.atan2(v[1], v[0])
    c, s = math.cos(direction), math.sin(direction)
    basis = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.]])
    axis_scale = np.diag([np.linalg.norm(d)/np.linalg.norm(v), width, 1.])
    r = transform((0, 0), angle=ang)
    return translation(*dst_a) @ r @ basis @ axis_scale @ basis.T @ translation(-src_a[0], -src_a[1])


class Part:
    def __init__(self, name, im, mask):
        self.name = name
        layer = im.copy()
        layer.putalpha(intersect(layer.getchannel('A'), mask))
        seeds = {
            'arm_l_upper':(440,560), 'arm_l_lower_axe':(343,811),
            'arm_r_upper':(847,596), 'arm_r_lower':(932,850),
            'body':(630,640),
        }
        if name in seeds:
            # Drop detached source crumbs left outside a hand-authored cut.
            connected=layer.getchannel('A').point(lambda a:255 if a>3 else 0)
            ImageDraw.floodfill(connected,seeds[name],128,thresh=0)
            support=connected.point(lambda a:255 if a==128 else 0).filter(ImageFilter.MaxFilter(3))
            layer.putalpha(intersect(layer.getchannel('A'),support))
        self.box = layer.getbbox()
        self.image = layer.crop(self.box)

    def paint(self, canvas, matrix):
        x, y, r, b = self.box
        corners = np.array([[x,y,1], [r,y,1], [r,b,1], [x,b,1]], dtype=float).T
        q = (matrix @ corners).T
        left = max(0, math.floor(q[:,0].min())-2)
        top = max(0, math.floor(q[:,1].min())-2)
        right = min(W, math.ceil(q[:,0].max())+2)
        bottom = min(H, math.ceil(q[:,1].max())+2)
        if left >= right or top >= bottom:
            return
        inv = translation(-x, -y) @ np.linalg.inv(matrix) @ translation(left, top)
        patch = self.image.transform((right-left, bottom-top), Image.Transform.AFFINE,
                                    tuple(inv[:2].flatten()), Image.Resampling.BICUBIC)
        canvas.alpha_composite(patch, (left, top))


def make_parts(im):
    all_white = Image.new('L', (W,H), 255)
    head = polygon([(298,130),(965,130),(965,423),(810,432),(790,446),
                    (746,450),(729,474),(698,501),(652,511),(599,520),
                    (551,498),(526,470),(496,450),(468,446),(410,436),(298,427)])
    left_arm = polygon([(425,481),(490,490),(512,536),(497,593),(462,650),
                        (465,684),(426,724),(408,747),(408,777),(423,802),
                        (423,851),(396,884),(371,891),(346,882),(321,875),
                        (292,850),(270,825),(274,780),(293,741),(298,696),
                        (314,658),(332,618),(369,601),(393,582),(410,527)])
    axe = polygon([(137,725),(473,725),(477,789),(430,837),(408,871),
                   (380,895),(410,931),(405,1009),(332,1086),(251,1118),
                   (198,1052),(178,976),(134,943)])
    left_all = union(left_arm, axe)
    right_all = polygon([(798,482),(843,492),(865,548),(899,605),(929,648),
                         (952,636),(976,699),(989,752),(1004,799),(1010,862),
                         (1004,896),(976,928),(930,957),(889,946),(856,919),
                         (854,867),(866,814),(864,785),(836,744),(841,721),
                         (825,691),(802,643),(785,590),(786,535)])

    # Natural costume edges provide the upper/lower arm articulation seams.
    left_cut = polygon([(333,602),(476,666),(492,1180),(100,1180),(100,602)])
    right_cut = polygon([(832,723),(949,637),(1050,637),(1050,1030),(814,1030)])
    masks = {
        'head': head,
        'arm_l_upper': intersect(left_arm, ImageChops.invert(left_cut).filter(ImageFilter.MaxFilter(25))),
        'arm_l_lower_axe': intersect(left_all, left_cut),
        'arm_r_upper': intersect(right_all, ImageChops.invert(right_cut).filter(ImageFilter.MaxFilter(25))),
        'arm_r_lower': intersect(right_all, right_cut),
    }

    # Boots are rigid, rotated at the knee. Thigh motion is a separate bone;
    # the hidden upper thigh is filled deterministically beneath the skirt.
    boot_l = polygon([(456,953),(482,966),(534,970),(576,957),(587,961),
                      (579,993),(573,1021),(589,1140),(365,1140),(365,1014)])
    boot_r = polygon([(719,974),(746,961),(777,977),(809,973),(840,957),
                      (854,962),(845,998),(853,1021),(947,1046),(952,1140),(710,1140)])
    thigh_l = polygon([(470,891),(494,887),(520,899),(548,924),(565,916),
                       (588,952),(589,986),(450,993),(449,960),(475,954),(465,931)])
    thigh_r = polygon([(706,910),(731,929),(749,939),(773,924),(797,918),
                       (822,903),(840,917),(837,963),(817,987),(709,990)])
    masks.update(boot_l=boot_l, boot_r=boot_r, thigh_l=thigh_l, thigh_r=thigh_r)
    legs = union(union(boot_l,boot_r), union(thigh_l,thigh_r))
    removed = union(union(head,left_all),union(right_all,legs))
    body_region = polygon([(405,430),(850,430),(859,708),(827,790),
                           (858,908),(815,973),(443,980),(435,869),
                           (478,790),(503,717),(480,673),(492,575),(408,515)])
    trunk = intersect(sub(all_white, removed),body_region)
    skirt_cut = polygon([(421,738),(859,738),(864,1000),(416,1000)])
    masks['skirt'] = intersect(trunk, skirt_cut)
    masks['body'] = intersect(trunk, ImageChops.invert(skirt_cut).filter(ImageFilter.MaxFilter(13)))
    neck_underlap=polygon([(529,476),(730,476),(749,544),(541,553)])
    masks['body']=union(masks['body'],intersect(head,neck_underlap))

    # Small hand-colored overlap caps beneath clothing prevent holes when
    # a limb uncovers pixels that the source never showed. Existing texture
    # and outlines remain on top; this is conventional cutout preparation.
    backing = Image.new('RGBA', (W,H))
    d = ImageDraw.Draw(backing)
    left_shape=[(499,844),(554,850),(566,904),(576,960),(565,983),
                (501,985),(475,962),(479,909)]
    right_shape=[(720,851),(791,844),(812,904),(834,960),(815,985),
                 (750,984),(722,956),(711,908)]
    d.polygon(left_shape,fill=(100,133,47,255),outline=(20,23,18,255),width=6)
    d.polygon([(500,856),(528,859),(526,929),(546,960),(502,973),(483,952)],fill=(123,154,54,255))
    d.polygon([(548,862),(557,897),(569,955),(556,974),(540,950),(539,906)],fill=(71,101,32,255))
    d.polygon(right_shape,fill=(96,129,43,255),outline=(20,23,18,255),width=6)
    d.polygon([(727,863),(767,854),(766,914),(794,947),(770,978),(738,961)],fill=(113,145,49,255))
    d.polygon([(786,855),(804,905),(827,957),(810,977),(797,950),(777,920)],fill=(67,95,30,255))
    masks['thigh_l'] = polygon(left_shape)
    masks['thigh_r'] = polygon(right_shape)
    # Preserve recognizable exposed green patches from the original image,
    # avoiding the old yellow trouser hem in the regions that must overlap.
    skin_l=polygon([(478,912),(491,902),(511,922),(520,917),(539,943),
                    (554,936),(565,958),(547,966),(499,963),(487,943)])
    skin_r=polygon([(720,929),(740,943),(751,937),(770,945),(787,928),
                    (813,918),(825,934),(817,962),(782,973),(748,963)])
    skin=im.copy()
    skin.putalpha(intersect(im.getchannel('A'),union(skin_l,skin_r)))
    leg_art=Image.alpha_composite(backing,skin)
    parts = {name: Part(name, leg_art if name.startswith('thigh') else im, mask)
             for name, mask in masks.items()}
    for name, part in parts.items():
        part.image.save(HERE/'parts'/f'{name}.png')
    return parts


def smooth(u):
    return u*u*(3-2*u)


def step(phase):
    """One forward cycle: heel contact, planted stance, toe-off, recovery.

    Front view: the depth of the step projects onto screen Y. A swing lifts
    the boot above that ground plane; stance does not lift it.
    """
    p = phase % 1
    if p < .60:
        u = p/.60
        depth = 19 - 38*smooth(u)
        lift = 0.
        roll = max(0., (u-.70)/.30)*5.
        swing = 0.
    else:
        u = (p-.60)/.40
        depth = -19 + 38*smooth(u)
        lift = 53 * math.sin(math.pi*u)**1.5
        roll = 5*(1-smooth(u))-6*math.sin(math.pi*u)
        swing = math.sin(math.pi*u)
    return depth, lift, roll, swing


def pose(t):
    a = TAU*t
    # Uneven weighting from the axe, but no global elastic scaling.
    sway = -8.5*math.sin(a+.12)
    bounce = 14 + 6.5*math.cos(2*a+.22)
    body = transform((625,735), (625+sway,735+bounce), angle=-1.1*math.sin(a))
    pelvis = transform((625,735), (625+sway*.8,735+bounce), angle=-.65*math.sin(a+.1))
    head_p = point(body,(624,493))
    head = transform((624,493), head_p+[1.8*math.sin(a-.25), -1.8*math.cos(2*a-.3)],
                     angle=-.85*math.sin(a-.18))
    skirt_p = point(pelvis,(625,742))
    skirt = transform((625,742), skirt_p, angle=-1.8*math.sin(a-.5))
    matrices = dict(body=body, head=head, skirt=skirt)
    feet = []
    for side, delta, hip, knee, ankle in [
        ('l',0.,(540,825),(523,970),(498,1045)),
        ('r',.5,(747,825),(789,970),(815,1045)),
    ]:
        depth, lift, roll, swing = step(t+delta)
        sign = -1 if side=='l' else 1
        # Boots retain their original proportions. Forward depth scales the
        # whole boot by at most 2.4%, instead of squashing the foot.
        boot_scale = 1 + depth*.00125
        knee_target = np.array(knee) + [sway*.18+sign*(2.5*swing), depth-lift]
        angle = sign*(roll + 3.0*math.sin(a+delta*TAU-.25))
        boot = transform(knee, knee_target, angle=angle, scale=(boot_scale,boot_scale))
        hip_target = point(pelvis, hip)
        matrices[f'thigh_{side}'] = bone(hip,knee,hip_target,knee_target,width=1.)
        matrices[f'boot_{side}'] = boot
        feet.append((point(boot,(ankle[0]+sign*12,1104)),lift,depth))

    for side, shoulder, elbow, wrist, phase, amp in [
        ('l',(458,521),(409,648),(342,801),.10,4.5),
        ('r',(821,522),(884,691),(929,852),math.pi+.10,6.),
    ]:
        arm_swing = math.sin(a+phase)
        arm_depth = -math.cos(a+phase)
        root = point(body,shoulder)
        upper_angle = amp*arm_swing
        upper = transform(shoulder,root,angle=upper_angle,scale=(1.,1.+.025*arm_depth))
        elbow_target = point(upper,elbow)
        # A small elbow bend keeps the held axe intact and adds weight lag.
        lower_angle = upper_angle*.65 + 2.8*math.sin(a+phase-.45)
        lower = transform(elbow,elbow_target,angle=lower_angle,
                          scale=(1.+.025*arm_depth,1.+.025*arm_depth))
        matrices[f'arm_{side}_upper'] = upper
        matrices['arm_l_lower_axe' if side=='l' else 'arm_r_lower'] = lower
    return matrices,feet


def render(parts,t):
    matrices,feet = pose(t)
    canvas = Image.new('RGBA',(W,H))
    # Legs are below the hem; shoulders are below the vest; weapon stays whole.
    order = ['thigh_l','thigh_r','boot_l','boot_r','arm_l_upper','arm_r_upper',
             'body','skirt','arm_l_lower_axe','arm_r_lower','head']
    for name in order:
        parts[name].paint(canvas,matrices[name])
    return canvas,feet


def font(size):
    for p in ['C:/Windows/Fonts/segoeui.ttf','C:/Windows/Fonts/arial.ttf']:
        if Path(p).exists():
            return ImageFont.truetype(p,size)
    return ImageFont.load_default()


def preview_frame(rgba, feet):
    # A neutral stage and local foot shadows make contact readable. These are
    # presentation only; exported PNGs and the atlas have true transparency.
    bg = Image.new('RGBA',(W,H),(237,231,214,255))
    d=ImageDraw.Draw(bg)
    d.ellipse((304,1060,1000,1191),fill=(219,213,193,255))
    shadow = Image.new('RGBA',(W,H))
    sd=ImageDraw.Draw(shadow)
    for foot,lift,depth in feet:
        x,y=foot
        gy = y+lift+2
        rx = 77*(1-lift*.003)
        alpha = int(54*(1-lift/90))
        sd.ellipse((x-rx,gy-10,x+rx,gy+18),fill=(54,61,45,alpha))
    bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))
    bg.alpha_composite(rgba)
    return bg.convert('RGB').resize((SIZE,SIZE),Image.Resampling.LANCZOS)


def parts_contact(parts):
    contact=Image.new('RGB',(1000,math.ceil(len(parts)/4)*270),(238,233,219))
    d=ImageDraw.Draw(contact)
    for i,(name,p) in enumerate(parts.items()):
        thumb=p.image.copy()
        thumb.thumbnail((225,226),Image.Resampling.LANCZOS)
        x=(i%4)*250+(250-thumb.width)//2
        y=(i//4)*270+8
        contact.paste(thumb,(x,y),thumb)
        d.text(((i%4)*250+8,(i//4)*270+242),name,font=font(17),fill='#374039')
    contact.save(HERE/'parts-contact.jpg',quality=93)


def main():
    (HERE/'parts').mkdir(exist_ok=True)
    (HERE/'frames').mkdir(exist_ok=True)
    im=Image.open(SOURCE).convert('RGBA')
    assert im.size==(W,H)
    im=key_blue(im)
    im.save(HERE/'source-cutout.png')
    parts=make_parts(im)
    parts_contact(parts)
    previews=[]
    atlas=Image.new('RGBA',(8*SIZE,4*SIZE))
    rects={}
    all_bounds=[]
    for i in range(COUNT):
        rgba,feet=render(parts,i/COUNT)
        all_bounds.append(rgba.getbbox())
        small=rgba.resize((SIZE,SIZE),Image.Resampling.LANCZOS)
        filename=f'walk_{i:03d}.png'
        small.save(HERE/'frames'/filename)
        atlas.alpha_composite(small,((i%8)*SIZE,(i//8)*SIZE))
        rects[f'walk_{i:03d}']=[(i%8)*SIZE,(i//8)*SIZE,SIZE,SIZE]
        previews.append(preview_frame(rgba,feet))
    atlas.save(HERE/'goblin-code-walk-atlas.png')
    # One shared palette prevents color pumping across frames.
    palette_contact=Image.new('RGB',(SIZE*4,SIZE*2))
    for j,i in enumerate(range(0,COUNT,4)):
        palette_contact.paste(previews[i],((j%4)*SIZE,(j//4)*SIZE))
    palette=palette_contact.quantize(256,method=Image.Quantize.MEDIANCUT)
    gifs=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in previews]
    gifs[0].save(HERE/'goblin-code-walk.gif',save_all=True,append_images=gifs[1:],
                 duration=MS,loop=0,disposal=2,optimize=False)
    contact=Image.new('RGB',(4*320,2*358),(237,231,214))
    d=ImageDraw.Draw(contact)
    for j,i in enumerate(range(0,COUNT,4)):
        contact.paste(previews[i].resize((320,320),Image.Resampling.LANCZOS),((j%4)*320,(j//4)*358))
        d.text(((j%4)*320+16,(j//4)*358+323),f'{i:02d} / {i*MS:04d} ms',font=font(18),fill='#46513e')
    contact.save(HERE/'walk-contact.jpg',quality=94)
    previews[0].save(HERE/'walk-poster.png')
    meta={
        'technique':'single-image deterministic cutout rig / projected stepping / rigid boots and weapon',
        'source':str(SOURCE),
        'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'source_size':[W,H], 'frame_size':[SIZE,SIZE],
        'atlas':'goblin-code-walk-atlas.png','frames':rects,
        'frame_count':COUNT,'frame_duration_ms':MS,'cycle_ms':COUNT*MS,
        'loop':True,'duplicated_endpoint':False,'game_modified':False,
        'anchor_px':[SIZE/2,1104*SIZE/H],
        'source_render_bounds':all_bounds,
        'parts':{n:{'crop':list(p.box)} for n,p in parts.items()},
    }
    (HERE/'goblin-code-walk.frames.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    with zipfile.ZipFile(HERE/'goblin-code-walk-frames.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted((HERE/'frames').glob('walk_*.png')):
            z.write(p,f'frames/{p.name}')
        z.write(HERE/'goblin-code-walk-atlas.png','goblin-code-walk-atlas.png')
        z.write(HERE/'goblin-code-walk.frames.json','goblin-code-walk.frames.json')
    print(json.dumps({'frames':COUNT,'duration_ms':COUNT*MS,'gif':str(HERE/'goblin-code-walk.gif'),
                      'min_render_margin':min(min(x,y,W-r,H-b) for x,y,r,b in all_bounds)},ensure_ascii=False))


if __name__=='__main__':
    main()
