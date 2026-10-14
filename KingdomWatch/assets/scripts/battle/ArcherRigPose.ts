/** Renderer-independent native puppet pose. Shared by Cocos and the review player. */
export type ArcherFacing = 'up' | 'left' | 'right';
export interface RigPoint { x: number; y: number; }
export interface RigPart extends RigPoint {
  name: string; angle: number; width: number; height: number; ax: number; ay: number;
}
export interface ArcherPose {
  facing: ArcherFacing; angle: number; pull: number; age: number; parts: RigPart[];
  bowTop: RigPoint; bowBottom: RigPoint; stringPoint: RigPoint;
  arrowTail: RigPoint; arrowTip: RigPoint; arrowVisible: boolean;
  leftGrip: RigPoint; rightGrip: RigPoint; leftElbow: RigPoint; rightElbow: RigPoint;
}
type FrameRects = Record<string, number[]>;
const DEG = 180 / Math.PI;
const point = (x: number, y: number): RigPoint => ({ x, y });
const mix = (a: RigPoint, b: RigPoint, t: number): RigPoint => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const smooth = (v: number): number => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const offset = (p: RigPoint, dx: number, dy: number): RigPoint => point(p.x + dx, p.y + dy);
const rotate = (p: RigPoint, a: number): RigPoint => point(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));

/** Two-bone IK keeps completed joint overlap and hand contacts intact while aiming. */
export function solveArcherArm(shoulder: RigPoint, wrist: RigPoint, upper = 21, fore = 20, bend = 1): RigPoint {
  const dx = wrist.x - shoulder.x, dy = wrist.y - shoulder.y;
  const distance = Math.max(.001, Math.hypot(dx, dy));
  const d = Math.min(upper + fore - .01, Math.max(Math.abs(upper - fore) + .01, distance));
  const along = (upper * upper - fore * fore + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const ux = dx / distance, uy = dy / distance;
  return point(shoulder.x + ux * along - uy * height * bend, shoulder.y + uy * along + ux * height * bend);
}

export class ArcherRigPose {
  clock = 0;
  age = 10;
  pull = .25;
  angle = 0;
  facing: ArcherFacing = 'up';
  releases = 0;
  private targetAngle = 0;
  private noTarget = 0;
  private heavy = false;
  private releaseGrip: RigPoint | null = null;
  private lastPose: ArcherPose | null = null;
  private recovery = .42;

  constructor(private readonly frames: FrameRects) {}

  aim(dx: number, dy: number): void {
    this.targetAngle = Math.max(-1.08, Math.min(1.08, Math.atan2(dx, Math.max(.12, dy))));
    this.noTarget = 0;
  }

  /** Called exactly when a real row of arrows leaves the bow, including queued rows. */
  release(dx: number, dy: number, heavy = false): ArcherPose {
    this.aim(dx, dy);
    this.releaseGrip = this.lastPose ? { ...this.lastPose.rightGrip } : null;
    this.heavy = heavy;
    this.recovery = .42;
    this.age = 0;
    this.releases++;
    return this.sample();
  }

  tick(dt: number, prepare = 0, dx?: number, dy?: number): ArcherPose {
    this.clock += dt;
    this.age += dt;
    if (dx !== undefined && dy !== undefined) this.aim(dx, dy);
    else { this.noTarget += dt; if (this.noTarget > 1) this.targetAngle = 0; }
    this.angle += (this.targetAngle - this.angle) * (1 - Math.exp(-dt * 12));
    // Enter/exit thresholds differ: a target near the boundary never chatters views.
    if (this.facing === 'up') {
      if (this.angle < -.40) this.facing = 'left';
      else if (this.angle > .40) this.facing = 'right';
    } else if (this.facing === 'left') {
      if (this.angle > .40) this.facing = 'right';
      else if (this.angle > -.28) this.facing = 'up';
    } else {
      if (this.angle < -.40) this.facing = 'left';
      else if (this.angle < .28) this.facing = 'up';
    }
    // A 0.12s queued shot re-nocks sooner, without restarting from an idle pose.
    if (prepare > .25 && this.age < .19) this.recovery = Math.min(this.recovery, .10);
    const goal = this.age < Math.min(.14, this.recovery * .28) ? .06 : .25 + Math.max(0, Math.min(1, prepare)) * .75;
    this.pull += (goal - this.pull) * (1 - Math.exp(-dt * 26));
    return this.sample();
  }

  sample(): ArcherPose {
    const parts: RigPart[] = [];
    const face = this.facing;
    const breath = Math.sin(this.clock * 2.45) * .43;
    const impulse = this.age < .46 ? Math.sin(this.age / .46 * Math.PI) * Math.exp(-this.age * 6) * (this.heavy ? 1.4 : 1) : 0;
    // The torso turns slightly over the planted hips; the bow stays left of the face.
    const bodyX = 9 - Math.sin(this.angle) * 4.5;
    const bodyY = breath - impulse * .6;
    const shoulderL = point(bodyX - (face === 'right' ? 10 : 16), 92 + bodyY + (face === 'right' ? 3 : 0));
    const shoulderR = point(bodyX + (face === 'right' ? 3 : face === 'left' ? 10 : 16), 92 + bodyY + (face === 'left' ? 3 : 0));
    const dir = point(Math.sin(this.angle), Math.cos(this.angle));
    const origin = point(0, 136);
    const grip = offset(origin, -dir.x * 19, -dir.y * 19 + breath * .2 - impulse * .4);
    const nock = offset(grip, -dir.x * (7 + this.pull * 9), -dir.y * (7 + this.pull * 9));
    let drawGrip = nock;
    if (this.age < this.recovery && this.releaseGrip) {
      const recoil = Math.sin(Math.min(1, this.age / Math.min(.2, this.recovery * .55)) * Math.PI) * 2.2;
      drawGrip = mix(offset(this.releaseGrip, -dir.x * recoil, -dir.y * recoil), nock,
        smooth((this.age - this.recovery * .28) / (this.recovery * .72)));
    }
    const leftWrist = offset(grip, -dir.x * 3.8, -dir.y * 3.8);
    const rightWrist = offset(drawGrip, 1.2, -3.8);
    const leftElbow = solveArcherArm(shoulderL, leftWrist, 23, 23, 1);
    const rightElbow = solveArcherArm(shoulderR, rightWrist, 23, 23, -1);

    const add = (name: string, position: RigPoint, height: number, ax = .5, ay = .5, angle = 0, width?: number): void => {
      const rect = this.frames[name];
      if (!rect) return;
      parts.push({ name, ...position, height, width: width ?? height * rect[2] / rect[3], ax, ay, angle });
    };
    const limb = (name: string, a: RigPoint, b: RigPoint): void => {
      // Source pieces point down. The extra length covers both joint endpoints.
      add(name, a, Math.hypot(b.x - a.x, b.y - a.y) / .78, .5, .89,
        Math.atan2(b.y - a.y, b.x - a.x) * DEG + 90);
    };
    const leftArm = (): void => {
      limb('left_upper_arm', shoulderL, leftElbow);
      limb('left_forearm', leftElbow, leftWrist);
    };
    const rightArm = (): void => {
      limb('right_upper_arm', shoulderR, rightElbow);
      limb('right_forearm', rightElbow, rightWrist);
    };

    add(face + '_legs', point(0, 0), 58, .55, .018);
    add(face + '_cape', point(bodyX - 6, 96 + breath * .45), 82, face === 'right' ? .70 : .30, .94,
      Math.sin(this.clock * 1.75 - .6) * .85 + impulse * 1.3);
    // A rear view has changing occlusion as the two shoulders turn, never a mirror.
    if (face === 'right') leftArm(); else rightArm();
    add(face + '_torso', point(bodyX, 58 + bodyY), 46, .5, .25, -Math.sin(this.angle) * 1.4);
    add('quiver', point(bodyX + 16, 89 + breath * .55), 39, .5, .5, -Math.sin(this.angle) * 5 + impulse * .8);
    if (face === 'right') rightArm(); else leftArm();
    add(face + '_head', point(bodyX + (face === 'left' ? 1 : face === 'right' ? 3 : 4), 93.5 + bodyY), 32,
      .5, .07, -Math.sin(this.angle) * 2.8 + Math.sin(this.clock * 2.45 - .18) * .25);
    add('right_hand', drawGrip, 9.3, .45, .78, -this.angle * DEG * .18);

    const bowAngle = -this.angle * .30 - .045;
    const bowRect = this.frames.bow;
    const bowH = 69, bowW = bowH * bowRect[2] / bowRect[3];
    add('bow', grip, bowH, .25, .53, bowAngle * DEG);
    add('left_hand', grip, 9.3, .42, .78, Math.atan2(grip.y - leftWrist.y, grip.x - leftWrist.x) * DEG - 90);
    const top = rotate(point(bowW * .53, bowH * .43), bowAngle);
    const bottom = rotate(point(bowW * .54, -bowH * .46), bowAngle);
    const bowTop = offset(grip, top.x, top.y), bowBottom = offset(grip, bottom.x, bottom.y);
    const arrowVisible = this.age >= Math.min(.19, this.recovery * .55);
    const rest = mix(bowTop, bowBottom, .5);
    const pose: ArcherPose = { facing: face, angle: this.angle, pull: this.pull, age: this.age, parts,
      bowTop, bowBottom, stringPoint: arrowVisible ? drawGrip : rest,
      arrowTail: drawGrip, arrowTip: origin, arrowVisible,
      leftGrip: grip, rightGrip: drawGrip, leftElbow, rightElbow };
    this.lastPose = pose;
    return pose;
  }
}
