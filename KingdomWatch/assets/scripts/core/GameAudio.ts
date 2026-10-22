/** One persistent WebAudio mix for the web game; no scene-owned players or synthesized placeholders. */
import { assetManager, AudioClip, resources } from 'cc';
import { loadSave } from './SaveData';
import { AUDIO_CUES, CHAPTER_MUSIC, MUSIC_TRACK_GAIN, MusicScene, resolveAudioCue, SfxName } from './AudioCatalog';
import { sfxMixGain } from './AudioMix';

// Keep the established master level. Impact comes from source transients and mix space.
const AUDIO_LEVEL_BOOST = Math.SQRT2 * Math.pow(10, 1 / 20);
const SFX_BUS_GAIN = .85 * AUDIO_LEVEL_BOOST;
const MUSIC_SCENE_GAIN = { camp: .52 * AUDIO_LEVEL_BOOST, battle: .42 * AUDIO_LEVEL_BOOST } as const;

interface PlaybackShape { preparing?: boolean; gain?: number; rate?: number; fadeIn?: number; duration?: number; lowpass?: number; }
interface Voice { source: AudioBufferSourceNode; gain: GainNode; priority: number; group: string; name: SfxName; started: number; }
interface MusicVoice { source: AudioBufferSourceNode; gain: GainNode; track: string; }

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
  private musicTails = new Set<MusicVoice>();
  private scene: MusicScene = 'camp';
  private chapter = 1;
  private state = 'running';
  private musicRevision = 0;
  private musicLoading = false;
  private musicHeldForTransition = false;
  private musicRetry: ReturnType<typeof setTimeout> | null = null;
  private warming = false;
  private lastAt: Partial<Record<SfxName, number>> = {};
  private lastVariant: Partial<Record<SfxName, number>> = {};
  private lastGroup: Record<string, number> = {};
  private accentUntil = 0;
  private duckUntil = 0;
  private duckGain = 1;
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

  enter(scene: MusicScene, chapter = this.chapter): void {
    // Only the persistent gate's short collision tail crosses the covered scene swap.
    this.stopVoices(false, false, true);
    const selected = this.validChapter(chapter);
    if (this.scene !== scene || this.chapter !== selected) {
      this.scene = scene; this.chapter = selected; this.musicRevision++;
    }
    this.state = 'running';
    this.ensureContext();
    this.settingsChanged();
    // Fetch/decode may run while the context is suspended. Playback still waits
    // for a real gesture, without making that gesture start every download.
    if (this.musicEnabled) void this.buffer(this.musicTrack()).then(() => this.startMusic());
    this.startMusic();
    // Crossing the gate also eases the lobby/battle mix level, even when the theme is shared.
    this.musicLevel(1);
    this.warmChapterMusic();
    this.warm();
  }

  /** Page selection is independent of the tab; only a chapter change requests new music. */
  setChapter(chapter: number): void {
    const selected = this.validChapter(chapter);
    if (selected === this.chapter) return;
    this.chapter = selected; this.musicRevision++;
    this.startMusic(); this.warmChapterMusic();
  }

  /** Keep the current mix until the gate has fully revealed the battle. */
  holdMusicForTransition(hold: boolean): void {
    if (this.musicHeldForTransition === hold) return;
    this.musicHeldForTransition = hold; this.musicRevision++;
    if (!hold) { this.startMusic(); this.musicLevel(1); }
  }

  private validChapter(chapter: number): number {
    return Math.max(1, Math.min(Object.keys(CHAPTER_MUSIC).length, Math.floor(Number(chapter) || 1)));
  }

  private musicTrack(): string {
    return CHAPTER_MUSIC[this.chapter][this.scene];
  }

  private warmChapterMusic(): void {
    if (!this.ctx || !this.musicEnabled) return;
    // Adjacent themes are ready before a manual arrow click; the current track stays audible while loading.
    for (const chapter of [this.chapter - 1, this.chapter + 1]) {
      const tracks = CHAPTER_MUSIC[chapter];
      if (tracks) void this.buffer(tracks[this.scene]);
    }
  }

  /** Called before battle's paused/pick/settlement early returns. */
  battleState(state: string): void {
    if (this.state === state) return;
    this.state = state;
    if (state !== 'running' && state !== 'prepare') {
      this.stopVoices(state !== 'leaving', state === 'win' || state === 'lose'); this.duckUntil = 0; this.duckGain = 1;
      if (this.duckTimer !== null) { clearTimeout(this.duckTimer); this.duckTimer = null; }
    }
    this.musicLevel();
  }

  settingsChanged(): void {
    const save = loadSave();
    this.musicEnabled = save.music !== false;
    this.sfxEnabled = save.sfx !== false;
    if (this.sfxBus && this.ctx) this.ramp(this.sfxBus.gain, this.sfxEnabled ? SFX_BUS_GAIN : 0, .03);
    if (!this.sfxEnabled) this.stopVoices();
    if (!this.musicEnabled) {
      this.musicRevision++;
      if (this.music) { this.retireMusic(this.music, .25); this.music = null; }
    }
    this.musicLevel();
    if (this.musicEnabled) { this.startMusic(); this.warmChapterMusic(); }
    else if (this.musicRetry !== null) { clearTimeout(this.musicRetry); this.musicRetry = null; }
    if (this.sfxEnabled) this.warm();
  }

  prepareUltimate(hero: string, seconds: number): void {
    // Decode before the meteor falls, never wait for a download at contact.
    if (hero === 'pyro' && this.ctx && this.sfxEnabled) for (const file of AUDIO_CUES.fireUlt.files) void this.buffer(file);
    if (this.ctx && this.scene === 'battle' && this.state === 'running') this.duck(seconds, .74);
    const rates: Record<string, number> = { archer: 1.08, sniper: .94, pyro: .9, volt: 1.12, mora: 1 };
    this.play('charge', { preparing: true, gain: .6, rate: rates[hero] || 1,
      fadeIn: .07, duration: seconds, lowpass: 6500 });
  }
  /** Only elite/BOSS defeats get a shared landing, regardless of the killing element. */
  death(_element: 'physical' | 'fire' | 'volt' | 'frost', significant: boolean): void {
    if (significant) this.play('deathHeavy', { rate: .94 });
  }
  play(name: SfxName, shape: PlaybackShape = {}): void {
    const resolved = resolveAudioCue(name);
    if (!resolved) return;
    name = resolved;
    if (!this.sfxEnabled || loadSave().sfx === false || typeof document === 'undefined' || document.hidden) return;
    const cue = AUDIO_CUES[name], now = performance.now() / 1000;
    const combat = cue.group === 'shot' || cue.group === 'impact' || cue.group === 'contact' || cue.group === 'cast' || cue.group === 'death';
    if (this.scene === 'battle' && combat && this.state !== 'running' && this.state !== 'prepare') return;
    if (now - (this.lastAt[name] ?? -100) < cue.gap) return;
    // Automatic volleys share space; they never queue up to play after the action.
    const damageHit = name === 'hit' || name === 'crit' || name === 'pierceHeavy';
    // Merge contacts within one simulation instant, without the old 180/200ms attack-wide gaps.
    const groupGap = damageHit ? .008 : cue.group === 'shot' ? .12 : cue.group === 'impact' ? .2
      : cue.group === 'contact' ? .18 : cue.group === 'death' ? .5 : cue.group === 'cast' && cue.priority < 3 ? .24
      : cue.group === 'ui' ? .08 : 0;
    if (now - (this.lastGroup[cue.group] ?? -100) < groupGap) return;
    if (name === 'lootPickup' && now - (this.lastAt[name] ?? -100) < .6) return;
    if (cue.group === 'shot' && now < this.accentUntil) return;
    const available = cue.files.filter(file => this.buffers.has(file));
    if (!available.length || !this.ctx || this.ctx.state !== 'running') {
      // Never queue late shots/hits; prepare the sample for the next actual event.
      if (this.ctx) for (const file of cue.files) void this.buffer(file);
      return;
    }
    let index = Math.floor(Math.random() * available.length);
    if (available.length > 1 && index === this.lastVariant[name]) index = (index + 1) % available.length;
    const buffer = this.buffers.get(available[index])!;
    if ('restart' in cue && cue.restart) {
      for (const voice of [...this.voices]) if (voice.name === name) this.stopVoice(voice);
    }
    // Full celebrations replace their predecessor instead of stacking long melodies.
    // Shared reward/growth phrases replace their predecessor rather than piling up.
    if (cue.group === 'cue' && cue.priority >= 4) {
      for (const voice of [...this.voices]) if (voice.group === 'cue' && voice.priority <= cue.priority) this.stopVoice(voice);
    }
    if (cue.group === 'card') {
      for (const voice of [...this.voices]) if (voice.group === 'card' || voice.name === 'levelup') this.stopVoice(voice);
    }
    const family = this.voices.filter(v => v.name === name);
    if (combat && family.length >= 2) this.stopVoice(family[0]);
    const group = this.voices.filter(v => v.group === cue.group);
    const groupLimit = damageHit ? 2 : cue.group === 'death' || cue.group === 'card' || cue.group === 'cue' || cue.group === 'impact' || cue.group === 'contact' || cue.group === 'transition' ? 1 : 2;
    if (group.length >= groupLimit) {
      const victim = group.filter(v => v.priority <= cue.priority).sort((a, b) => a.priority - b.priority || a.started - b.started)[0];
      if (!victim) return;
      this.stopVoice(victim);
    }
    if (this.voices.length >= 8) {
      const victim = this.voices.filter(v => v.priority <= cue.priority).sort((a, b) => a.priority - b.priority)[0];
      if (!victim) return;
      this.stopVoice(victim);
    }
    this.lastVariant[name] = index;
    this.lastAt[name] = now; this.lastGroup[cue.group] = now;
    if (cue.priority >= 3 && !shape.preparing) {
      this.accentUntil = now + .24;
      this.duck(Math.min(combat ? .9 : 3.4, buffer.duration), combat ? .64 : .4);
      // Make room in already-playing ordinary contact tails as well as future hits.
      if (combat) for (const voice of this.voices) {
        if ((voice.group === 'shot' || voice.group === 'impact' || voice.group === 'contact') && voice.priority < 2 && now - voice.started > .035) {
          this.ramp(voice.gain.gain, voice.gain.gain.value * .55, .018);
        }
      }
    }
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buffer;
    const vary = name !== 'mageCast' && (cue.group === 'shot' || cue.group === 'impact' || cue.group === 'death');
    const rate = 'rate' in cue ? cue.rate : 1;
    source.playbackRate.value = rate * (shape.rate ?? 1) * (vary ? .9875 + Math.random() * .025 : 1);
    const recent = combat ? this.voices.filter(v => v.group === cue.group && now - v.started < .12).length : 0;
    const density = 1 / Math.sqrt(1 + recent * .42);
    const underAccent = combat && cue.priority < 2 && now < this.accentUntil ? .62 : 1;
    const level = sfxMixGain(name, available[index], cue.gain) * density * underAccent * (shape.gain ?? 1) * (vary ? .96 + Math.random() * .04 : 1);
    const offset = 'offset' in cue ? Math.max(0, Math.min(cue.offset, buffer.duration)) : 0;
    const playDuration = Math.min((buffer.duration - offset) / source.playbackRate.value, shape.duration ?? Infinity);
    if (shape.fadeIn) {
      const nowAudio = this.ctx.currentTime, attack = Math.min(shape.fadeIn, playDuration * .3);
      gain.gain.setValueAtTime(0, nowAudio);
      gain.gain.linearRampToValueAtTime(level, nowAudio + attack);
      gain.gain.setValueAtTime(level, nowAudio + Math.max(attack, playDuration - .08));
      gain.gain.linearRampToValueAtTime(0, nowAudio + playDuration);
    } else gain.gain.value = level;
    const filter = shape.lowpass ? this.ctx.createBiquadFilter() : null;
    if (filter) { filter.type = 'lowpass'; filter.frequency.value = shape.lowpass!; filter.Q.value = .6; source.connect(filter); filter.connect(gain); }
    else source.connect(gain);
    gain.connect(combat ? this.combatBus! : this.sfxBus!);
    const voice: Voice = { source, gain, priority: cue.priority, group: cue.group, name, started: now };
    this.voices.push(voice);
    source.onended = () => {
      this.voices = this.voices.filter(v => v !== voice);
      source.disconnect(); gain.disconnect(); filter?.disconnect();
    };
    source.start(0, offset);
    if (shape.duration) source.stop(this.ctx.currentTime + playDuration + .005);
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
      this.sfxBus.gain.value = this.sfxEnabled ? SFX_BUS_GAIN : 0;
      this.musicBus.gain.value = 0;
      this.combatBus = ctx.createGain();
      const lowCut = ctx.createBiquadFilter(), presence = ctx.createBiquadFilter();
      const air = ctx.createBiquadFilter(), glue = ctx.createDynamicsCompressor();
      lowCut.type = 'highpass'; lowCut.frequency.value = 60; lowCut.Q.value = .707;
      presence.type = 'peaking'; presence.frequency.value = 3400; presence.Q.value = .85; presence.gain.value = -1;
      air.type = 'highshelf'; air.frequency.value = 8000; air.gain.value = -1.5;
      glue.threshold.value = -11; glue.knee.value = 8; glue.ratio.value = 2;
      glue.attack.value = .016; glue.release.value = .12;
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
        const url = assetManager.utils.getUrlWithUuid(info.uuid, { isNative: true, nativeExt: /(^|\/)bgm_/.test(file) ? '.mp3' : '.wav' });
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
    // Decode only retained/shared sources; muted recordings stay available on disk.
    const first: SfxName[] = ['ui', 'gateSlide', 'gateClose', 'fireUlt', 'pickOpen', 'pickChoose', 'growth', 'reward',
      'victory', 'defeat', 'breakthrough', 'bow', 'crossbow', 'fire', 'thunder', 'frost', 'hit'];
    const files: string[] = [], unique = new Set<string>();
    for (const name of [...first, ...Object.keys(AUDIO_CUES) as SfxName[]]) {
      const resolved = resolveAudioCue(name);
      if (!resolved) continue;
      for (const file of AUDIO_CUES[resolved].files) if (!unique.has(file)) { unique.add(file); files.push(file); }
    }
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < files.length) { const file = files[next++]; await this.buffer(file); }
    };
    void Promise.all([worker(), worker(), worker()]).finally(() => { this.warming = false; });
  }

  private startMusic(): void {
    const track = this.musicTrack();
    if (!this.ctx || this.ctx.state !== 'running' || document.hidden || !this.musicEnabled || this.musicHeldForTransition || this.music?.track === track || this.musicLoading) return;
    if (this.musicRetry !== null) { clearTimeout(this.musicRetry); this.musicRetry = null; }
    this.musicLoading = true;
    const revision = this.musicRevision;
    void this.buffer(track).then(buffer => {
      if (!buffer || !this.ctx || !this.musicEnabled || this.musicHeldForTransition || document.hidden || this.ctx.state !== 'running' || revision !== this.musicRevision) return;
      const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.value = 0; source.connect(gain); gain.connect(this.musicBus!);
      const previous = this.music;
      if (previous) this.retireMusic(previous, 1.6);
      this.music = { source, gain, track };
      source.start(); this.ramp(gain.gain, MUSIC_TRACK_GAIN[track] ?? 1, previous ? 1.6 : .65); this.musicLevel(1);
    }).finally(() => {
      this.musicLoading = false;
      // A scene may have changed while the previous theme was being decoded.
      if (revision !== this.musicRevision) this.startMusic();
      else if (this.music?.track !== this.musicTrack() && this.musicEnabled && !document.hidden && this.ctx?.state === 'running') {
        // A transient download failure must not leave BGM silent until another click.
        this.musicRetry = setTimeout(() => { this.musicRetry = null; this.startMusic(); }, 16000);
      }
    });
  }

  private retireMusic(voice: MusicVoice, seconds: number): void {
    // Rapid chapter changes must not leave a stack of long, overlapping fades.
    for (const tail of this.musicTails) {
      this.ramp(tail.gain.gain, 0, .08);
      try { tail.source.stop(this.ctx!.currentTime + .1); } catch { /* Already ended. */ }
    }
    this.musicTails.add(voice);
    this.ramp(voice.gain.gain, 0, seconds);
    voice.source.onended = () => {
      this.musicTails.delete(voice); voice.source.disconnect(); voice.gain.disconnect();
    };
    try { voice.source.stop(this.ctx!.currentTime + seconds + .02); } catch { /* Already ended. */ }
  }

  private ramp(param: AudioParam, value: number, seconds: number): void {
    const time = this.ctx!.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
    else { const current = param.value; param.cancelScheduledValues(time); param.setValueAtTime(current, time); }
    param.linearRampToValueAtTime(value, time + seconds);
  }

  private musicLevel(seconds = .18): void {
    if (!this.ctx || !this.musicBus) return;
    if (this.musicHeldForTransition && this.musicEnabled) return;
    const sceneGain = MUSIC_SCENE_GAIN[this.scene];
    const stateGain = this.state === 'win' || this.state === 'lose' ? .2 : this.state === 'paused' || this.state === 'pick' ? .42 : 1;
    const duck = performance.now() < this.duckUntil ? this.duckGain : 1;
    this.ramp(this.musicBus.gain, this.musicEnabled ? sceneGain * stateGain * duck : 0, seconds);
  }

  private duck(seconds: number, gain = .43): void {
    this.duckGain = performance.now() < this.duckUntil ? Math.min(this.duckGain, gain) : gain;
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

  private stopVoices(combatOnly = false, keepDeathTail = false, keepGateTail = false): void {
    for (const voice of [...this.voices]) {
      // Let the final kill's short material tail survive settlement, never navigation/pause.
      if (keepDeathTail && voice.group === 'death') continue;
      if (keepGateTail && voice.group === 'transition') continue;
      if (!combatOnly || voice.group === 'shot' || voice.group === 'impact' || voice.group === 'contact' || voice.group === 'cast' || voice.group === 'death') this.stopVoice(voice);
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
