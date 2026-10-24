/** Full-character user-video idle, used only by the hero and training showcases. */
import { _decorator, Component, game, Game, isValid, JsonAsset, Node, Rect, resources, Size,
  Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { N } from './UIKit';
import { trackUIArt, uiArtInView } from './UIArtReady';
import { reducedMotion } from './UIMotion';
import { ArtPriority, higherArtPriority, prefetchUXArt, promoteUXArt, uxFrame } from './Ux';

const { ccclass } = _decorator;
const HEROES = new Set(['archer', 'pyro', 'sniper', 'volt', 'mora']);
interface Manifest {
  frames: Record<string, [number, number, number, number]>;
  animation: { frames: string[]; seconds: number; frameDurations: number[] };
  groundAnchor: [number, number]; visibleHeightPx: number; visibleWidthPx: number;
}

interface LobbyClip { manifest: Manifest; source: SpriteFrame; }
const clips = new Map<string, LobbyClip>();
const loads = new Map<string, ((clip: LobbyClip | null) => void)[]>();
const priorities = new Map<string, ArtPriority>();
export function supportsHeroLobbyIdle(hero: string): boolean { return HEROES.has(hero); }
export function heroLobbyIdleKey(hero: string): string | null {
  if (!HEROES.has(hero)) return null;
  const directory = hero === 'pyro' ? 'hero_lobby_idle_v99/'
    : hero === 'archer' ? 'hero_lobby_idle_v103/'
    : hero === 'mora' ? 'hero_lobby_idle_v102/' : 'hero_lobby_idle_v100/';
  return directory + hero;
}
function loadLobbyClip(hero: string, done: (clip: LobbyClip | null) => void, priority: ArtPriority): void {
  const key = heroLobbyIdleKey(hero);
  if (!key) { done(null); return; }
  const cached = clips.get(key);
  if (cached) { void Promise.resolve().then(() => done(cached)); return; }
  priorities.set(key, higherArtPriority(priorities.get(key) || priority, priority)); promoteUXArt(key, priority);
  const prior = loads.get(key);
  if (prior) { prior.push(done); return; }
  loads.set(key, [done]);
  const finish = (clip: LobbyClip | null): void => {
    if (clip) { clip.source.addRef(); clips.set(key, clip); }
    const callbacks = loads.get(key) || []; loads.delete(key); priorities.delete(key);
    callbacks.forEach(callback => callback(clip));
  };
  resources.load('ux/' + key + '.frames', JsonAsset, (error, asset) => {
    if (error || !asset) { finish(null); return; }
    const manifest = asset.json as Manifest;
    const order = manifest.animation?.frames, durations = manifest.animation?.frameDurations;
    if (!order?.length || !durations || durations.length !== order.length || !durations.every(t => Number.isFinite(t) && t > 0)
      || !(manifest.visibleHeightPx > 0 && manifest.visibleWidthPx > 0)
      || !manifest.groundAnchor || !manifest.groundAnchor.every(Number.isFinite)) { finish(null); return; }
    uxFrame(key, source => { finish(source ? { manifest, source } : null); }, priorities.get(key) || priority);
  });
}
export function warmHeroLobbyIdle(hero: string, priority: ArtPriority = 'next'): Promise<void> {
  return new Promise(resolve => loadLobbyClip(hero, () => resolve(), priority));
}
export function prefetchHeroLobbyIdle(hero: string): Promise<void> {
  const key = heroLobbyIdleKey(hero);
  if (!key) return Promise.resolve();
  return prefetchUXArt([key + '.frames', key]);
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
  private request = 0;
  private artReady: (() => void) | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private onFallback: (() => void) | null = null;

  onLoad(): void {
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }

  configure(hero: string, fallback: Node, height: number, maxWidth: number, onFallback?: () => void): void {
    if (!HEROES.has(hero)) return;
    this.fallback = fallback;
    this.finishLoading();
    this.onFallback = onFallback || null;
    const request = ++this.request;
    // Hero/training refreshes retain the previous surface until this exact
    // animation frame and its final geometry are ready for their first draw.
    this.artReady = trackUIArt(this.node);
    const pending = (): boolean => isValid(this, true) && request === this.request && this.artReady !== null;
    // Settle before the enclosing surface's 8s fallback. A late atlas must not
    // replace an already-visible illustration with a differently framed body.
    this.loadTimer = setTimeout(() => { if (request === this.request) this.finishLoading(true); }, 6000);
    loadLobbyClip(hero, clip => {
      if (!pending()) return;
      if (!clip) { this.finishLoading(true); return; }
      const { manifest, source } = clip;
      const order = manifest.animation?.frames, durations = manifest.animation?.frameDurations;
      if (!order?.length || !durations || durations.length !== order.length
        || !durations.every(t => Number.isFinite(t) && t > 0)
        || !(manifest.visibleHeightPx > 0 && manifest.visibleWidthPx > 0)
        || !manifest.groundAnchor || manifest.groundAnchor.length !== 2
        || !manifest.groundAnchor.every(Number.isFinite)) { this.finishLoading(true); return; }
      source.addRef();
      if (!pending()) {
        // Let other callbacks for this same in-flight image acquire their own references first.
        void Promise.resolve().then(() => source.decRef()); return;
      }
      this.source = source;
      const first = manifest.frames[order[0]];
      if (!first || !order.every(name => {
        const r = manifest.frames[name];
        return r?.length === 4 && r[2] === first[2] && r[3] === first[3]
          && r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= source.rect.width && r[1] + r[3] <= source.rect.height;
      })) { this.source.decRef(); this.source = null; this.finishLoading(true); return; }
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
      this.finishLoading();
    }, 'visible');
  }

  private finishLoading(fallback = false): void {
    if (this.loadTimer !== null) { clearTimeout(this.loadTimer); this.loadTimer = null; }
    if (fallback && this.artReady && this.fallback && isValid(this.fallback, true)) this.onFallback?.();
    this.onFallback = null;
    this.artReady?.(); this.artReady = null;
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
    ++this.request; this.finishLoading();
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    if (this.sprite && isValid(this.sprite, true)) this.sprite.spriteFrame = null;
    this.frames.forEach(frame => frame.destroy()); this.frames.length = 0;
    this.source?.decRef(); this.source = null;
  }
}
