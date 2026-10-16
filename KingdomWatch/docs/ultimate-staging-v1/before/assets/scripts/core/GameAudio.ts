/** One persistent WebAudio mix for the web game; no scene-owned players or synthesized placeholders. */
import { assetManager, AudioClip, resources } from 'cc';
import { loadSave } from './SaveData';
import { AUDIO_CUES, MUSIC_TRACKS, MusicScene, SfxName } from './AudioCatalog';

interface Voice { source: AudioBufferSourceNode; gain: GainNode; priority: number; group: string; name: SfxName; started: number; }
interface MusicVoice { source: AudioBufferSourceNode; gain: GainNode; scene: MusicScene; }

class GameAudioService {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private combatBus: GainNode | null = null;
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
  private musicRetry: ReturnType<typeof setTimeout> | null = null;
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
    const unlock = (event: Event): void => { if (event.isTrusted) this.unlock(); };
    // Cocos stops DOM mouse/touch/keyboard events at the canvas. Capture on window
    // before that happens; pointerup/touchend also cover browsers that unlock on release.
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown']) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => this.visibilityChanged());
    window.addEventListener('pagehide', () => { this.stopVoices(); void this.ctx?.suspend().catch(() => {}); });
    window.addEventListener('pageshow', () => this.visibilityChanged());
  }

  enter(scene: MusicScene): void {
    if (this.scene !== scene) { this.stopVoices(true); this.scene = scene; this.musicRevision++; }
    this.state = 'running';
    this.ensureContext();
    this.settingsChanged();
    // Fetch/decode may run while the context is suspended. Playback still waits
    // for a real gesture, without making that gesture start every download.
    if (this.musicEnabled) void this.buffer(MUSIC_TRACKS[scene]).then(() => this.startMusic());
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
    else if (this.musicRetry !== null) { clearTimeout(this.musicRetry); this.musicRetry = null; }
    if (this.sfxEnabled) this.warm();
  }

  play(name: SfxName): void {
    if (!this.sfxEnabled || loadSave().sfx === false || typeof document === 'undefined' || document.hidden) return;
    const cue = AUDIO_CUES[name], now = performance.now() / 1000;
    const combat = cue.group === 'shot' || cue.group === 'impact' || cue.group === 'cast';
    if (this.scene === 'battle' && combat && this.state !== 'running' && this.state !== 'prepare') return;
    if (now - (this.lastAt[name] ?? -100) < cue.gap) return;
    // Simultaneous heroes must all speak. Only repetitive minor contacts share a gap.
    const groupGap = cue.group === 'impact' && cue.priority < 2 ? .045 : cue.group === 'ui' ? .035 : 0;
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
    const family = this.voices.filter(v => v.name === name);
    if (combat && family.length >= 2) this.stopVoice(family[0]);
    const group = this.voices.filter(v => v.group === cue.group);
    const groupLimit = cue.group === 'shot' ? 7 : cue.group === 'impact' ? 4 : cue.group === 'cast' ? 3 : 6;
    if (group.length >= groupLimit) {
      const victim = group.filter(v => v.priority <= cue.priority).sort((a, b) => a.priority - b.priority || a.started - b.started)[0];
      if (!victim) return;
      this.stopVoice(victim);
    }
    if (this.voices.length >= 14) {
      const victim = this.voices.filter(v => v.priority <= cue.priority).sort((a, b) => a.priority - b.priority)[0];
      if (!victim) return;
      this.stopVoice(victim);
    }
    this.lastVariant[name] = index;
    this.lastAt[name] = now; this.lastGroup[cue.group] = now;
    if (cue.priority >= 3) {
      this.accentUntil = now + .14;
      this.duck(Math.min(2.6, buffer.duration));
    }
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buffer;
    const vary = cue.group === 'shot' || cue.group === 'impact';
    const rate = 'rate' in cue ? cue.rate : 1;
    source.playbackRate.value = rate * (vary ? .9875 + Math.random() * .025 : 1);
    const recent = combat ? this.voices.filter(v => v.group === cue.group && now - v.started < .12).length : 0;
    const density = 1 / Math.sqrt(1 + recent * .32);
    const underAccent = combat && cue.priority < 2 && now < this.accentUntil ? .64 : 1;
    gain.gain.value = cue.gain * density * underAccent * (vary ? .96 + Math.random() * .04 : 1);
    source.connect(gain); gain.connect(combat ? this.combatBus! : this.sfxBus!);
    const voice: Voice = { source, gain, priority: cue.priority, group: cue.group, name, started: now };
    this.voices.push(voice);
    source.onended = () => {
      this.voices = this.voices.filter(v => v !== voice);
      source.disconnect(); gain.disconnect();
    };
    source.start();
  }

  private ensureContext(): boolean {
    if (this.ctx && this.ctx.state !== 'closed') return true;
    if (typeof window === 'undefined') return false;
    const host = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = host.AudioContext || host.webkitAudioContext;
    if (!AC) return false;
    try {
      const ctx = this.ctx = new AC();
      const master = ctx.createGain(), limiter = ctx.createDynamicsCompressor();
      master.gain.value = .8;
      // Safety ceiling, not the loudness source: repeated attacks retain their transients.
      limiter.threshold.value = -3; limiter.knee.value = 2; limiter.ratio.value = 12;
      limiter.attack.value = .002; limiter.release.value = .09;
      this.sfxBus = ctx.createGain(); this.musicBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxEnabled ? .85 : 0;
      this.musicBus.gain.value = 0;
      this.combatBus = ctx.createGain();
      const lowCut = ctx.createBiquadFilter(), presence = ctx.createBiquadFilter();
      const air = ctx.createBiquadFilter(), glue = ctx.createDynamicsCompressor();
      lowCut.type = 'highpass'; lowCut.frequency.value = 65; lowCut.Q.value = .707;
      presence.type = 'peaking'; presence.frequency.value = 3100; presence.Q.value = .85; presence.gain.value = -2.5;
      air.type = 'highshelf'; air.frequency.value = 5200; air.gain.value = -2;
      glue.threshold.value = -14; glue.knee.value = 12; glue.ratio.value = 2.5;
      glue.attack.value = .008; glue.release.value = .10;
      this.combatBus.connect(lowCut); lowCut.connect(presence); presence.connect(air);
      air.connect(glue); glue.connect(this.sfxBus);
      this.sfxBus.connect(master); this.musicBus.connect(master);
      master.connect(limiter); limiter.connect(ctx.destination);
      ctx.onstatechange = () => { if (ctx.state === 'running') { this.startMusic(); this.warm(); } };
    } catch { this.ctx = null; return false; }
    return true;
  }

  private unlock(): void {
    if (document.hidden || !this.ensureContext()) return;
    if (this.ctx!.state === 'running') { this.startMusic(); this.warm(); return; }
    // Resume is synchronous with the trusted gesture, before Cocos dispatches it.
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
        const info = resources.getInfoWithPath('audio/' + (file.includes('/') ? file : 'v1/' + file), AudioClip);
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
    if (!this.ctx || this.warming || !this.sfxEnabled) return;
    this.warming = true;
    // Prepare small UI/cues before interaction; bounded fetch/decode avoids a mobile CPU spike.
    const files = Array.from(new Set(['ui_click_1', 'ui_confirm', AUDIO_CUES.bow.files[0], AUDIO_CUES.crossbow.files[0],
      'levelup', 'victory', 'defeat', ...Object.values(AUDIO_CUES).flatMap(cue => [...cue.files])]));
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < files.length) { const file = files[next++]; await this.buffer(file); }
    };
    void Promise.all([worker(), worker(), worker()]).finally(() => { this.warming = false; });
  }

  private startMusic(): void {
    if (!this.ctx || this.ctx.state !== 'running' || document.hidden || !this.musicEnabled || this.music?.scene === this.scene || this.musicLoading) return;
    if (this.musicRetry !== null) { clearTimeout(this.musicRetry); this.musicRetry = null; }
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
      else if (this.music?.scene !== this.scene && this.musicEnabled && !document.hidden && this.ctx?.state === 'running') {
        // A transient download failure must not leave BGM silent until another click.
        this.musicRetry = setTimeout(() => { this.musicRetry = null; this.startMusic(); }, 16000);
      }
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
    if (document.hidden) {
      if (this.musicRetry !== null) { clearTimeout(this.musicRetry); this.musicRetry = null; }
      this.stopVoices(); void this.ctx.suspend().catch(() => {});
    }
    else void this.ctx.resume().then(() => { this.startMusic(); this.warm(); }).catch(() => {});
  }
}

export const GameAudio = new GameAudioService();
