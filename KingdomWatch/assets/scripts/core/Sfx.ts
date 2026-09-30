/**
 * WebAudio 程序合成音效（零素材）：首次触摸解锁 AudioContext，走存档 sfx 开关。
 * 高频事件（命中/射击）按类型限流，避免全屏怪时的声音糊成一团。
 */
import { loadSave } from './SaveData';

export type SfxName = 'shoot' | 'hit' | 'crit' | 'kill' | 'ult' | 'levelup' | 'ready';

class SfxService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastAt: Partial<Record<SfxName, number>> = {};
  private static MIN_GAP: Record<SfxName, number> = { shoot: 0.06, hit: 0.045, crit: 0.09, kill: 0.06, ult: 0, levelup: 0.15, ready: 0.2 };
  private flagCache = { v: true, at: 0 };

  constructor() {
    // 移动端 H5：AudioContext 必须在用户手势里创建/恢复
    const unlock = () => this.ensure();
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('mousedown', unlock);
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
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { return null; }
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
    if (this.lastAt[name] !== undefined && now - this.lastAt[name] < SfxService.MIN_GAP[name]) return;
    this.lastAt[name] = now;
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    switch (name) {
      case 'shoot': this.noiseHit(0.07, 0.09, 2400); this.tone('sine', 950, 300, 0.08, 0.05); break;
      case 'hit': this.noiseHit(0.045, 0.11, 900, 'lowpass'); this.tone('sine', 200, 120, 0.06, 0.09); break;
      case 'crit': this.tone('square', 330, 90, 0.12, 0.13); this.noiseHit(0.06, 0.15, 1400); this.tone('sine', 200, 110, 0.08, 0.09); break;
      case 'kill': this.noiseHit(0.09, 0.15, 700, 'lowpass'); this.tone('triangle', 520, 70, 0.16, 0.13); break;
      case 'ult': this.tone('sawtooth', 130, 55, 0.45, 0.2); this.noiseHit(0.35, 0.11, 500, 'lowpass'); this.tone('sine', 700, 1400, 0.3, 0.05, 0.05); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone('sine', f, f, 0.14, 0.13, i * 0.08)); break;
      case 'ready': this.tone('sine', 880, 880, 0.35, 0.11); this.tone('sine', 1318, 1318, 0.4, 0.07, 0.06); break;
    }
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
    this.env(g, t, 0.008, peak, dur);
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
