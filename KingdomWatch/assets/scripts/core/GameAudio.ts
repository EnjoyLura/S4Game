/** One persistent WebAudio mix for the web game; no scene-owned players or synthesized placeholders. */
import { assetManager, AudioClip, resources } from 'cc';
import { loadSave } from './SaveData';
import { AUDIO_CUES, MUSIC_TRACKS, MusicScene, SfxName } from './AudioCatalog';

interface Voice { source: AudioBufferSourceNode; gain: GainNode; priority: number; group: string; }
interface MusicVoice { source: AudioBufferSourceNode; gain: GainNode; scene: MusicScene; }

class GameAudioService {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private bundleReady: Promise<void> | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private failedAt = new Map<string, number>();
  private voices: Voice[] = [];
  private music: MusicVoice | null = null;
  private scene: MusicScene = 'camp';
  private state = 'running';
  private musicRevision = 0;
  private musicLoading = false;
  private warming = false;
  private lastAt: Partial<Record<SfxName, number>> = {};
  private lastVariant: Partial<Record<SfxName, number>> = {};
  private lastGroup: Record<string, number> = {};
  private accentUntil = 0;
  private duckUntil = 0;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private musicEnabled = true;
  private sfxEnabled = true;

  constructor() {
    if (typeof document === 'undefined') return;
    const unlock = (): void => { this.unlock(); };
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('mousedown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => this.visibilityChanged());
    window.addEventListener('pagehide', () => { this.stopVoices(); void this.ctx?.suspend().catch(() => {}); });
    window.addEventListener('pageshow', () => this.visibilityChanged());
  }

  enter(scene: MusicScene): void {
    if (this.scene !== scene) { this.stopVoices(true); this.scene = scene; this.musicRevision++; }
    this.state = 'running';
    this.settingsChanged();
    this.startMusic();
    this.warm();
  }

  /** Called before battle's paused/pick/settlement early returns. */
  battleState(state: string): void {
    if (this.state === state) return;
    this.state = state;
    if (state !== 'running' && state !== 'prepare') this.stopVoices(true);
    this.musicLevel();
  }

  settingsChanged(): void {
    const save = loadSave();
    this.musicEnabled = save.music !== false;
    this.sfxEnabled = save.sfx !== false;
    if (this.sfxBus && this.ctx) this.ramp(this.sfxBus.gain, this.sfxEnabled ? .85 : 0, .03);
    if (!this.sfxEnabled) this.stopVoices();
    if (!this.musicEnabled) {
      this.musicRevision++;
      if (this.music) { this.retireMusic(this.music, .25); this.music = null; }
    }
    this.musicLevel();
    if (this.musicEnabled) this.startMusic();
  }

  play(name: SfxName): void {
    if (!this.sfxEnabled || loadSave().sfx === false || typeof document === 'undefined' || document.hidden) return;
    const cue = AUDIO_CUES[name], now = performance.now() / 1000;
    const combat = cue.group === 'shot' || cue.group === 'impact' || cue.group === 'cast';
    if (this.scene === 'battle' && combat && this.state !== 'running' && this.state !== 'prepare') return;
    if (now - (this.lastAt[name] ?? -100) < cue.gap) return;
    if (cue.priority < 2 && now < this.accentUntil) return;
    const groupGap = cue.group === 'impact' ? .075 : cue.group === 'shot' ? .025 : 0;
    if (now - (this.lastGroup[cue.group] ?? -100) < groupGap) return;
    const available = cue.files.filter(file => this.buffers.has(file));
    if (!available.length || !this.ctx || this.ctx.state !== 'running') {
      // Never queue late shots/hits; prepare the sample for the next actual event.
      if (this.ctx) for (const file of cue.files) void this.buffer(file);
      return;
    }
    let index = Math.floor(Math.random() * available.length);
    if (available.length > 1 && index === this.lastVariant[name]) index = (index + 1) % available.length;
    const buffer = this.buffers.get(available[index])!;
    this.lastVariant[name] = index;
    this.lastAt[name] = now; this.lastGroup[cue.group] = now;
    if (cue.priority >= 3) {
      this.accentUntil = now + .14;
      this.duck(Math.min(2.6, buffer.duration));
    }
    if (this.voices.length >= 14) {
      const victim = this.voices.filter(v => v.priority <= cue.priority).sort((a, b) => a.priority - b.priority)[0];
      if (!victim) return;
      this.stopVoice(victim);
    }
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buffer;
    const vary = cue.group === 'shot' || cue.group === 'impact';
    source.playbackRate.value = vary ? .975 + Math.random() * .05 : 1;
    gain.gain.value = cue.gain * (vary ? .94 + Math.random() * .06 : 1);
    source.connect(gain); gain.connect(this.sfxBus!);
    const voice: Voice = { source, gain, priority: cue.priority, group: cue.group };
    this.voices.push(voice);
    source.onended = () => {
      this.voices = this.voices.filter(v => v !== voice);
      source.disconnect(); gain.disconnect();
    };
    source.start();
  }

  private unlock(): void {
    if (document.hidden) return;
    if (!this.ctx) {
      const host = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = host.AudioContext || host.webkitAudioContext;
      if (!AC) return;
      try {
        const ctx = this.ctx = new AC();
        const master = ctx.createGain(), limiter = ctx.createDynamicsCompressor();
        master.gain.value = .8;
        limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 8;
        limiter.attack.value = .003; limiter.release.value = .14;
        this.sfxBus = ctx.createGain(); this.musicBus = ctx.createGain();
        this.sfxBus.gain.value = this.sfxEnabled ? .85 : 0;
        this.musicBus.gain.value = 0;
        this.sfxBus.connect(master); this.musicBus.connect(master);
        master.connect(limiter); limiter.connect(ctx.destination);
        ctx.onstatechange = () => { if (ctx.state === 'running') this.startMusic(); };
      } catch { this.ctx = null; return; }
    }
    // Creation/resume happens directly inside the trusted browser gesture.
    void this.ctx.resume().then(() => { this.startMusic(); this.warm(); }).catch(() => {});
  }

  private ready(): Promise<void> {
    if (!this.bundleReady) {
      this.bundleReady = new Promise<void>((resolve, reject) => {
        assetManager.loadBundle('resources', (error) => error ? reject(error) : resolve());
      }).catch(error => { this.bundleReady = null; throw error; });
    }
    return this.bundleReady;
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(file);
    if (cached) return Promise.resolve(cached);
    if (!this.ctx || performance.now() - (this.failedAt.get(file) ?? -30000) < 15000) return Promise.resolve(null);
    const existing = this.pending.get(file);
    if (existing) return existing;
    const job = (async (): Promise<AudioBuffer | null> => {
      try {
        await this.ready();
        const info = resources.getInfoWithPath('audio/v1/' + file, AudioClip);
        if (!info) throw new Error('Missing bundled audio: ' + file);
        const url = assetManager.utils.getUrlWithUuid(info.uuid, { isNative: true, nativeExt: file.startsWith('bgm_') ? '.mp3' : '.wav' });
        const response = await fetch(url);
        if (!response.ok) throw new Error('Audio HTTP ' + response.status);
        const decoded = await this.ctx!.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(file, decoded);
        return decoded;
      } catch (error) {
        this.failedAt.set(file, performance.now());
        console.warn('[GameAudio] Cannot load ' + file, error);
        return null;
      } finally { this.pending.delete(file); }
    })();
    this.pending.set(file, job);
    return job;
  }

  private warm(): void {
    if (!this.ctx || this.warming) return;
    this.warming = true;
    // Small UI/cues first; bounded fetch/decode avoids a mobile CPU spike.
    const files = Array.from(new Set(['ui_click_1', 'ui_confirm', 'bow_1', 'crossbow_1',
      'levelup', 'victory', 'defeat', ...Object.values(AUDIO_CUES).flatMap(cue => [...cue.files])]));
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < files.length) { const file = files[next++]; await this.buffer(file); }
    };
    void Promise.all([worker(), worker(), worker()]).finally(() => { this.warming = false; });
  }

  private startMusic(): void {
    if (!this.ctx || this.ctx.state !== 'running' || document.hidden || !this.musicEnabled || this.music?.scene === this.scene || this.musicLoading) return;
    this.musicLoading = true;
    const scene = this.scene, revision = this.musicRevision;
    void this.buffer(MUSIC_TRACKS[scene]).then(buffer => {
      if (!buffer || !this.ctx || !this.musicEnabled || document.hidden || this.ctx.state !== 'running' || revision !== this.musicRevision) return;
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.value = 0; source.connect(gain); gain.connect(this.musicBus!);
      if (this.music) this.retireMusic(this.music, .65);
      this.music = { source, gain, scene };
      source.start(); this.ramp(gain.gain, 1, .65); this.musicLevel();
    }).finally(() => {
      this.musicLoading = false;
      // A scene may have changed while the previous theme was being decoded.
      if (revision !== this.musicRevision) this.startMusic();
    });
  }

  private retireMusic(voice: MusicVoice, seconds: number): void {
    this.ramp(voice.gain.gain, 0, seconds);
    voice.source.onended = () => { voice.source.disconnect(); voice.gain.disconnect(); };
    try { voice.source.stop(this.ctx!.currentTime + seconds + .02); } catch { /* Already ended. */ }
  }

  private ramp(param: AudioParam, value: number, seconds: number): void {
    const time = this.ctx!.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
    else { const current = param.value; param.cancelScheduledValues(time); param.setValueAtTime(current, time); }
    param.linearRampToValueAtTime(value, time + seconds);
  }

  private musicLevel(): void {
    if (!this.ctx || !this.musicBus) return;
    const sceneGain = this.scene === 'camp' ? .52 : .42;
    const stateGain = this.state === 'win' || this.state === 'lose' ? .2 : this.state === 'paused' || this.state === 'pick' ? .42 : 1;
    const duck = performance.now() < this.duckUntil ? .43 : 1;
    this.ramp(this.musicBus.gain, this.musicEnabled ? sceneGain * stateGain * duck : 0, .18);
  }

  private duck(seconds: number): void {
    this.duckUntil = Math.max(this.duckUntil, performance.now() + (seconds + .12) * 1000);
    if (this.duckTimer !== null) clearTimeout(this.duckTimer);
    this.musicLevel();
    this.duckTimer = setTimeout(() => { this.duckTimer = null; this.musicLevel(); }, Math.max(0, this.duckUntil - performance.now()) + 20);
  }

  private stopVoice(voice: Voice): void {
    // Detach from the voice budget immediately; a short gain ramp avoids clicks on interruption.
    this.voices = this.voices.filter(v => v !== voice);
    this.ramp(voice.gain.gain, 0, .015);
    try { voice.source.stop(this.ctx!.currentTime + .02); } catch { /* Already stopped. */ }
  }

  private stopVoices(combatOnly = false): void {
    for (const voice of [...this.voices]) {
      if (!combatOnly || voice.group === 'shot' || voice.group === 'impact' || voice.group === 'cast') this.stopVoice(voice);
    }
  }

  private visibilityChanged(): void {
    if (!this.ctx) return;
    if (document.hidden) { this.stopVoices(); void this.ctx.suspend().catch(() => {}); }
    else void this.ctx.resume().then(() => this.startMusic()).catch(() => {});
  }
}

export const GameAudio = new GameAudioService();
