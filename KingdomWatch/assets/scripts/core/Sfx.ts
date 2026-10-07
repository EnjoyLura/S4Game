/**
 * 音效服务（合成占位 + 资源自动替换）：
 * - 占位：WebAudio 程序合成（零素材），首次触摸解锁 AudioContext，走存档 sfx 开关
 * - 替换：美术阶段把音频文件放到 assets/resources/audio/（命名见 SAMPLES，如 sfx_shoot.mp3），
 *   运行时自动优先播放资源样本，无需改代码；缺资源的音效继续走合成占位
 * - 高频事件（命中/射击）按类型限流，避免全屏怪时的声音糊成一团
 */
import { AudioClip, director, Node, resources, AudioSource } from 'cc';
import { loadSave } from './SaveData';

export type SfxName = 'shoot' | 'hit' | 'crit' | 'kill' | 'ult' | 'levelup' | 'ready' | 'snipe'
  | 'bow' | 'crossbow' | 'fire' | 'thunder' | 'frost' | 'skill' | 'wall' | 'surge' | 'victory'
  | 'pierce' | 'crush' | 'zapHit' | 'icebreak';

/** 资源占位命名约定：assets/resources/audio/<file>（美术阶段直接放文件即替换） */
const SAMPLES: Record<SfxName, string> = {
  shoot: 'audio/sfx_shoot',
  hit: 'audio/sfx_hit',
  crit: 'audio/sfx_crit',
  kill: 'audio/sfx_kill',
  ult: 'audio/sfx_ult',
  levelup: 'audio/sfx_levelup',
  ready: 'audio/sfx_ready',
  snipe: 'audio/sfx_snipe',
  bow: 'audio/sfx_bow', crossbow: 'audio/sfx_crossbow', fire: 'audio/sfx_fire',
  thunder: 'audio/sfx_thunder', frost: 'audio/sfx_frost', skill: 'audio/sfx_skill',
  wall: 'audio/sfx_wall', surge: 'audio/sfx_surge', victory: 'audio/sfx_victory',
  pierce: 'audio/sfx_pierce', crush: 'audio/sfx_crush', zapHit: 'audio/sfx_zap_hit', icebreak: 'audio/sfx_icebreak',
};

/** 资源样本播放音量（合成音量在 switch 内独立调，互不影响） */
const SAMPLE_GAIN: Record<SfxName, number> = {
  shoot: 1, hit: 0.8, crit: 0.9, kill: 0.9, ult: 1, levelup: 0.9, ready: 0.9, snipe: 1.25,
  bow: 0.65, crossbow: 0.75, fire: 0.7, thunder: 0.7, frost: 0.65, skill: 0.85,
  wall: 0.65, surge: 0.8, victory: 0.85,
  pierce: 0.85, crush: 0.8, zapHit: 0.7, icebreak: 0.65,
};

class SfxService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastAt: Partial<Record<SfxName, number>> = {};
  private static MIN_GAP: Record<SfxName, number> = {
    shoot: 0.07, hit: 0.075, crit: 0.12, kill: 0.1, ult: 0.12, levelup: 0.15, ready: 0.3, snipe: 0.15,
    bow: 0.08, crossbow: 0.13, fire: 0.12, thunder: 0.12, frost: 0.12, skill: 0.15,
    wall: 0.25, surge: 1.5, victory: 1.5,
    pierce: 0.11, crush: 0.13, zapHit: 0.11, icebreak: 0.11,
  };
  private priorityUntil = 0;
  private lastImpactAt = -1;
  private flagCache = { v: true, at: 0 };
  // 资源样本缓存（未加载/加载失败 → 走合成占位）
  private clips: Partial<Record<SfxName, AudioClip>> = {};
  private tried = false;
  private srcNode: Node | null = null;
  private src: AudioSource | null = null;

  constructor() {
    // 移动端 H5：AudioContext 必须在用户手势里创建/恢复
    const unlock = () => this.ensure();
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('mousedown', unlock);
  }

  /** 预载资源样本（缺文件静默失败，回退合成）；解锁时调用一次 */
  private preloadSamples(): void {
    if (this.tried) return;
    this.tried = true;
    for (const name of Object.keys(SAMPLES) as SfxName[]) {
      try {
        resources.load(SAMPLES[name], AudioClip, (err, clip) => { if (!err && clip) this.clips[name] = clip; });
      } catch { /* resources bundle 不存在时整体回退合成 */ }
    }
  }

  /** 资源样本走常驻 AudioSource oneShot（跨场景自动重建） */
  private playSample(name: SfxName): void {
    const clip = this.clips[name];
    if (!clip) return;
    const scene = director.getScene();
    if (!scene) return;
    if (!this.srcNode || !this.srcNode.isValid || this.srcNode.scene !== scene) {
      this.srcNode = new Node('sfxPlayer');
      scene.addChild(this.srcNode);
      this.src = this.srcNode.addComponent(AudioSource);
      this.src.playOnAwake = false;
    }
    this.src?.playOneShot(clip, SAMPLE_GAIN[name] ?? 1);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* 忽略 */ });
      return this.ctx;
    }
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -18; limiter.knee.value = 8; limiter.ratio.value = 5;
      limiter.attack.value = 0.003; limiter.release.value = 0.12;
      this.master.connect(limiter); limiter.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { return null; }
    this.preloadSamples();
    return this.ctx;
  }

  /** 开关缓存 1s，避免高频命中时反复 JSON.parse 存档 */
  private enabled(): boolean {
    const now = performance.now();
    if (now - this.flagCache.at > 1000) {
      try { this.flagCache.v = loadSave().sfx !== false; } catch { /* 存档异常时默认开 */ }
      this.flagCache.at = now;
    }
    return this.flagCache.v;
  }

  play(name: SfxName): void {
    if (!this.enabled()) return;
    const now = performance.now() / 1000;
    // Let casts/readiness/level-ups read clearly during crowded volleys.
    const priority = name === 'ult' || name === 'snipe' || name === 'levelup' || name === 'ready' || name === 'surge' || name === 'victory';
    if (!priority && now < this.priorityUntil && (name === 'hit' || name === 'kill' || name === 'bow' || name === 'crossbow' || name === 'fire' || name === 'thunder' || name === 'frost')) return;
    if (this.lastAt[name] !== undefined && now - this.lastAt[name] < SfxService.MIN_GAP[name]) return;
    this.lastAt[name] = now;
    if (priority) this.priorityUntil = now + 0.18;
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    // 资源优先：美术音频已就位则播放样本，否则合成占位
    if (this.clips[name]) { this.playSample(name); return; }
    switch (name) {
      case 'shoot': this.noiseHit(0.07, 0.2, 2400); this.tone('sine', 950, 300, 0.08, 0.1); break;
      case 'bow': this.noiseHit(0.045, 0.13, 3200); this.tone('triangle', 1120, 340, 0.075, 0.07); break;
      case 'crossbow': this.noiseHit(0.065, 0.19, 1800); this.tone('triangle', 310, 140, 0.095, 0.13); break;
      case 'fire': this.noiseHit(0.16, 0.16, 950, 'lowpass'); this.tone('sine', 190, 65, 0.16, 0.09); break;
      case 'thunder': this.noiseHit(0.045, 0.17, 4200); this.tone('sawtooth', 900, 180, 0.075, 0.065); break;
      case 'frost': this.tone('sine', 1470, 1080, 0.13, 0.08); this.tone('sine', 2200, 1700, 0.1, 0.035, 0.02); break;
      case 'skill': this.tone('triangle', 240, 560, 0.14, 0.13); this.noiseHit(0.12, 0.14, 1800); break;
      case 'wall': this.noiseHit(0.15, 0.22, 620, 'lowpass'); this.tone('triangle', 210, 95, 0.13, 0.14); break;
      case 'surge': [220, 277, 330].forEach((f, i) => this.tone('triangle', f, f * 0.9, 0.32, 0.12, i * 0.1)); break;
      case 'victory': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.12, i * 0.1)); break;
      // Short high-frequency contact over a compact mid-frequency body.
      case 'hit': {
        const det = 0.9 + Math.random() * 0.2;
        this.noiseHit(0.025, 0.2, 2600 * det);
        this.tone('triangle', 620 * det, 260, 0.055, 0.16);
        break;
      }
      case 'crit': {
        const det = 0.94 + Math.random() * 0.12;
        this.tone('square', 560 * det, 170, 0.12, 0.24);
        this.noiseHit(0.07, 0.22, 2400 * det);
        this.tone('sine', 320 * det, 150, 0.09, 0.12);
        break;
      }
      case 'kill': this.noiseHit(0.1, 0.2, 800, 'lowpass'); this.tone('triangle', 660, 90, 0.18, 0.18); break;
      case 'pierce': {
        const det = 0.94 + Math.random() * 0.12;
        this.noiseHit(0.035, 0.24, 1800 * det);
        this.tone('triangle', 470 * det, 150, 0.085, 0.23);
        this.tone('sine', 230, 100, 0.1, 0.12); break;
      }
      case 'crush': this.noiseHit(0.055, 0.24, 1100, 'lowpass'); this.tone('triangle', 340, 100, 0.12, 0.22); break;
      case 'zapHit': this.noiseHit(0.025, 0.17, 3900); this.tone('triangle', 610, 190, 0.075, 0.17); break;
      case 'icebreak': {
        const det = 0.93 + Math.random() * 0.14;
        this.noiseHit(0.035, 0.15, 3400 * det);
        this.tone('sine', 1700 * det, 950, 0.075, 0.065);
        this.tone('triangle', 440, 240, 0.055, 0.1); break;
      }
      case 'ult': this.tone('triangle', 230, 90, 0.18, 0.19); this.noiseHit(0.08, 0.13, 900, 'lowpass'); break;
      // Mechanical release + body + short decay; no long whistling tail.
      case 'snipe':
        this.noiseHit(0.035, 0.26, 2300);
        this.tone('triangle', 300, 80, 0.17, 0.3);
        this.noiseHit(0.12, 0.16, 800, 'lowpass', 0.015);
        break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone('sine', f, f, 0.14, 0.13, i * 0.08)); break;
      case 'ready': this.tone('sine', 880, 880, 0.35, 0.11); this.tone('sine', 1318, 1318, 0.4, 0.07, 0.06); break;
    }
  }

  shoot(heroId: string): void {
    const sounds: Record<string, SfxName> = { archer: 'bow', sniper: 'crossbow', pyro: 'fire', volt: 'thunder', mora: 'frost' };
    this.play(sounds[heroId] || 'shoot');
  }

  /** Shared contact budget prevents five simultaneous sound families becoming a wall of noise. */
  impact(heroId: string, heavy = false): void {
    const now = performance.now() / 1000;
    if (!heavy && now < this.priorityUntil || now - this.lastImpactAt < (heavy ? 0.07 : 0.11)) return;
    this.lastImpactAt = now;
    const name: SfxName = heroId === 'pyro' ? 'crush' : heroId === 'volt' ? 'zapHit'
      : heroId === 'mora' ? 'icebreak' : heavy ? 'pierce' : 'hit';
    this.play(name);
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.env(g, t, 0.003, peak, dur);
    o.connect(g); g.connect(this.master!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noiseHit(dur: number, peak: number, freq: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise!;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = 1;
    const g = c.createGain();
    this.env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(this.master!);
    s.start(t); s.stop(t + dur + 0.05);
  }
}

export const Sfx = new SfxService();
