/** Full-character user-video idle, used only by the hero and training showcases. */
import { _decorator, Component, game, Game, isValid, JsonAsset, Node, Rect, resources, Size,
  Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { N } from './UIKit';
import { uiArtInView } from './UIArtReady';
import { reducedMotion } from './UIMotion';

const { ccclass } = _decorator;
const HEROES = new Set(['archer', 'pyro', 'sniper', 'volt']);
interface Manifest {
  frames: Record<string, [number, number, number, number]>;
  animation: { frames: string[]; seconds: number; frameDurations: number[] };
  groundAnchor: [number, number]; visibleHeightPx: number; visibleWidthPx: number;
}

@ccclass('HeroLobbyIdle')
export class HeroLobbyIdle extends Component {
  private source: SpriteFrame | null = null;
  private frames: SpriteFrame[] = [];
  private ends: number[] = [];
  private sprite: Sprite | null = null;
  private fallback: Node | null = null;
  private time = 0;
  private seconds = 0;
  private shown = -1;
  private hidden = false;

  onLoad(): void {
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }

  configure(hero: string, fallback: Node, height: number, maxWidth: number): void {
    if (!HEROES.has(hero)) return;
    this.fallback = fallback;
    const key = 'ux/hero_lobby_idle_v96/' + hero;
    // Optional animation never hides or delays the existing illustration while loading.
    resources.load(key + '.frames', JsonAsset, (error, data) => {
      if (error || !data || !isValid(this, true)) return;
      const manifest = data.json as Manifest;
      const order = manifest.animation?.frames, durations = manifest.animation?.frameDurations;
      if (!order?.length || !durations || durations.length !== order.length
        || !durations.every(t => Number.isFinite(t) && t > 0)
        || !(manifest.visibleHeightPx > 0 && manifest.visibleWidthPx > 0)) return;
      resources.load(key + '/spriteFrame', SpriteFrame, (failure, source) => {
        if (failure || !source) return;
        source.addRef();
        if (!isValid(this, true)) {
          // Let other callbacks for this same in-flight image acquire their own references first.
          void Promise.resolve().then(() => source.decRef()); return;
        }
        this.source = source;
        const first = manifest.frames[order[0]];
        if (!first || !order.every(name => {
          const r = manifest.frames[name];
          return r?.length === 4 && r[2] === first[2] && r[3] === first[3]
            && r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= source.rect.width && r[1] + r[3] <= source.rect.height;
        })) { this.source.decRef(); this.source = null; return; }
        const player = N('lobbyIdle', this.node, 0, 0, first[2], first[3]);
        const transform = player.getComponent(UITransform)!;
        transform.setAnchorPoint(manifest.groundAnchor[0] / first[2], 1 - manifest.groundAnchor[1] / first[3]);
        const scale = Math.min(height / manifest.visibleHeightPx, maxWidth / manifest.visibleWidthPx);
        transform.setContentSize(first[2] * scale, first[3] * scale);
        this.sprite = player.addComponent(Sprite);
        this.sprite.sizeMode = Sprite.SizeMode.CUSTOM; this.sprite.trim = false;
        let end = 0;
        for (let i = 0; i < order.length; i++) {
          const [x, y, w, h] = manifest.frames[order[i]], frame = new SpriteFrame();
          frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
          frame.packable = false; this.frames.push(frame);
          end += durations[i]; this.ends.push(end);
        }
        this.seconds = end;
        this.render(0);
        if (isValid(fallback, true)) fallback.active = false;
      });
    });
  }

  update(dt: number): void {
    if (!this.sprite || this.hidden || reducedMotion() || !Number.isFinite(dt) || dt < 0
      || (typeof document !== 'undefined' && document.hidden) || !uiArtInView(this.sprite.node, 0)) return;
    this.time = (this.time + Math.min(dt, .25)) % this.seconds;
    let first = 0, last = this.ends.length - 1;
    while (first < last) {
      const mid = (first + last) >>> 1;
      if (this.time < this.ends[mid]) last = mid; else first = mid + 1;
    }
    this.render(first);
  }

  private render(index: number): void {
    if (index === this.shown || !this.sprite) return;
    this.sprite.spriteFrame = this.frames[index]; this.shown = index;
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    if (this.sprite && isValid(this.sprite, true)) this.sprite.spriteFrame = null;
    this.frames.forEach(frame => frame.destroy()); this.frames.length = 0;
    this.source?.decRef(); this.source = null;
  }
}
