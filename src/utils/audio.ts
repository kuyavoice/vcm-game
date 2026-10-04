import Phaser from 'phaser';
import { AUDIO_MANIFEST, type AudioCategory } from '../data/audio';
import { loadSave } from './storage';
import { VOICE_PRIORITY, VOICE_COOLDOWN_MS, VOICE_DUCK, VOICE_GAIN, voiceFiles, voiceFilesOf, voiceKey, type VoiceKind } from '../data/voice';

/** 未配置ファイルでも落ちないサウンド窓口。音量はカテゴリ別 */
class AudioBusImpl {
  private game?: Phaser.Game;
  private bgm?: Phaser.Sound.BaseSound;
  private volumes: Record<AudioCategory, number> = { bgm: 0.7, se: 0.8, voice: 1 };
  private lastPlayed = new Map<string, number>();

  init(game: Phaser.Game): void {
    this.game = game;
    const s = loadSave().settings;
    this.volumes = { bgm: s.bgm, se: s.se, voice: s.voice };
  }

  private available = new Set<string>();

  /**
   * 起動前に呼ぶ：マニフェストの各ファイルが実在するか HEAD で確認する。
   * （開発サーバは未配置パスに index.html を返すため、Content-Type が audio のものだけ採用）
   */
  async probe(baseUrl: string): Promise<void> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    await Promise.all(
      AUDIO_MANIFEST.map(async (e) => {
        // ボイスは、配置済みの一覧から作っているので確認しない
        if (e.category === 'voice') { this.available.add(e.key); return; }
        try {
          const res = await fetch(baseUrl + e.path, { method: 'HEAD', signal: ctl.signal });
          const type = res.headers.get('content-type') ?? '';
          if (res.ok && (type.startsWith('audio/') || type.startsWith('video/') || type === 'application/octet-stream')) {
            this.available.add(e.key);
          }
        } catch {
          /* 未配置・タイムアウトは無音扱い */
        }
      }),
    );
    clearTimeout(timer);
  }

  /** Boot で呼ぶ：実在が確認できた SE・ボイスとタイトル曲だけ読み込む（他のBGMは再生時に遅延読み込み。起動を軽くするため） */
  queueLoad(loader: Phaser.Loader.LoaderPlugin): void {
    for (const e of AUDIO_MANIFEST) {
      if (!this.available.has(e.key)) continue;
      if (e.category === 'bgm' && e.key !== 'bgm_title') continue;
      if (e.category === 'voice') continue;
      loader.audio(e.key, e.path);
    }
  }

  /** 再生したいBGM（遅延読み込みの完了後に、まだこの曲が望まれていれば再生） */
  private wantedBgm = '';

  setVolume(cat: AudioCategory, v: number): void {
    this.volumes[cat] = v;
    if (cat === 'bgm' && this.bgm && 'setVolume' in this.bgm) (this.bgm as Phaser.Sound.WebAudioSound).setVolume(this.voiceSound ? v * VOICE_DUCK : v);
    if (cat === 'voice' && this.voiceSound && 'setVolume' in this.voiceSound) (this.voiceSound as Phaser.Sound.WebAudioSound).setVolume(v * this.voiceGain);
  }

  private has(key: string): boolean {
    return !!this.game && this.game.cache.audio.exists(key);
  }

  /** SE／ボイス。minGapMs で連打を間引く。fallback：key が未配置のときに代わりに鳴らすキー */
  /** ゲームオーバーの曲が流れていたら、タイトルの曲に戻す（リザルトから選択画面へ戻ったとき） */
  leaveGameOver(): void {
    if (this.currentKey() === 'bgm_gameover') this.playBgm('bgm_title');
  }

  /** volumeMul：この1回だけの音量の倍率（同じ音を場面によって少し小さく鳴らすとき） */
  play(key: string, minGapMs = 0, fallback?: string, volumeMul = 1): void {
    if (!this.has(key) && fallback) key = fallback;
    if (!this.has(key) || !this.game) return;
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.lastPlayed.set(key, now);
    const entry = AUDIO_MANIFEST.find((e) => e.key === key);
    const cat = entry?.category ?? 'se';
    this.game.sound.play(key, { volume: this.volumes[cat] * volumeMul });
  }

  /** fallbacks：key が未配置のときに順に試すキー（キャラ曲 → ステージ曲 → 共通曲 など） */
  playBgm(key: string, ...fallbacks: string[]): void {
    if (!this.game) return;
    // 実在する候補（読み込み済みでなくてもよい）
    const found = [key, ...fallbacks].find((k) => this.available.has(k));
    if (!found) return; // 候補が無ければ今の曲を続ける
    key = found;
    this.wantedBgm = key;
    if (this.bgm && (this.bgm as Phaser.Sound.BaseSound).key === key) return;
    if (this.has(key)) {
      this.startBgm(key);
      return;
    }
    this.loadBgm(key, () => {
      if (this.wantedBgm === key && this.has(key)) this.startBgm(key);
    });
  }

  /** 先読み：近いうちに切り替える曲を読んでおく（再生はしない）。ボスの形態変化で曲が途切れないように */
  preloadBgm(key: string): void {
    if (!this.game || !this.available.has(key) || this.has(key)) return;
    this.loadBgm(key);
  }

  private loadBgm(key: string, onLoaded?: () => void): void {
    if (!this.game) return;
    // 遅延読み込み：生きているシーン（起動中〜一時停止中。create() 実行中の Game も含む）のローダーで読む。
    // getScenes(true) は RUNNING のみを返すため、create() から呼ばれると空になり読み込めなかった（タイトル曲が続く不具合）
    const alive = this.game.scene.getScenes(false).filter((x) => {
      const st = x.sys.settings.status;
      return st >= Phaser.Scenes.INIT && st <= Phaser.Scenes.PAUSED;
    });
    const scene = alive.find((x) => x.scene.key === 'Game') ?? alive[alive.length - 1];
    const entry = AUDIO_MANIFEST.find((e) => e.key === key);
    if (!scene || !entry) return;
    const loader = scene.load;
    loader.audio(key, entry.path);
    // ファイル単位の完了で受ける（全体の COMPLETE だと、読み込み中に別の曲を足したとき取りこぼす）
    if (onLoaded) loader.once(`filecomplete-audio-${key}`, onLoaded);
    if (!loader.isLoading()) loader.start();
  }

  private startBgm(key: string): void {
    if (!this.game) return;
    this.stopBgm();
    this.wantedBgm = key; // stopBgm が消すので入れ直す
    this.bgm = this.game.sound.add(key, { loop: true, volume: this.voiceSound ? this.volumes.bgm * VOICE_DUCK : this.volumes.bgm });
    this.bgm.play();
  }

  /** 音声ファイルが置かれているか（起動時の存在確認の結果） */
  isAvailable(key: string): boolean {
    return this.available.has(key);
  }

  /** いま流している（流そうとしている）曲のキー。無ければ空文字 */
  currentKey(): string {
    return this.bgm ? this.bgm.key : this.wantedBgm;
  }

  // ─────────────────────────── ボイス ───────────────────────────

  private voiceSound?: Phaser.Sound.BaseSound;
  private voicePriority = 0;
  private voiceGain = 1;
  /** 種類ごとの、最後に鳴らした時刻（連続を間引く） */
  private voiceLastAt = new Map<string, number>();
  /** 種類ごとの、最後に鳴らした差分（直前と同じものは避ける） */
  private voiceLastVariant = new Map<string, string>();
  /** 鳴り終わったら鳴らすもの（queue 指定） */
  private voiceQueued: { characterId: string; kind: VoiceKind } | null = null;
  /** 読み込み中のキーと、読み終わったら鳴らすか */
  private voiceLoading = new Set<string>();

  /** そのキャラのボイスを先に読んでおく（ゲーム開始時）。無いキャラなら何もしない */
  preloadVoices(characterId: string, scene: Phaser.Scene): void {
    const files = voiceFilesOf(characterId);
    let queued = false;
    for (const f of files) {
      const key = voiceKey(f);
      if (this.has(key) || this.voiceLoading.has(key)) continue;
      this.voiceLoading.add(key);
      scene.load.audio(key, `assets/audio/voice/${f}`);
      scene.load.once(`filecomplete-audio-${key}`, () => this.voiceLoading.delete(key));
      queued = true;
    }
    if (queued && !scene.load.isLoading()) scene.load.start();
  }

  /** そのキャラのその種類のボイスがあるか */
  hasVoice(characterId: string, kind: VoiceKind): boolean {
    return voiceFiles(characterId, kind).length > 0;
  }

  /**
   * ボイスを鳴らす。返り値：鳴らした（または鳴らす予約をした）か。
   * - 同時に鳴るのは1つ。鳴っている途中なら、優先度が高いときだけ割り込む（同じ優先度は捨てる）。queue なら鳴り終わってから鳴らす
   * - 種類ごとの間引き（VOICE_COOLDOWN_MS）。差分はランダムで、直前と同じものは避ける
   * - 鳴っている間は BGM を下げる
   * - まだ読んでいなければ読んでから鳴らす
   */
  voice(characterId: string, kind: VoiceKind, opts: { queue?: boolean } = {}): boolean {
    if (!this.game || this.volumes.voice <= 0) return false;
    const files = voiceFiles(characterId, kind);
    if (files.length === 0) return false;
    const now = performance.now();
    const cdKey = `${characterId}:${kind}`;
    const cd = VOICE_COOLDOWN_MS[kind] ?? 0;
    if (cd > 0 && now - (this.voiceLastAt.get(cdKey) ?? -Infinity) < cd) return false;
    const prio = VOICE_PRIORITY[kind];
    if (this.voiceSound && this.voiceSound.isPlaying) {
      if (prio <= this.voicePriority) {
        if (opts.queue) { this.voiceQueued = { characterId, kind }; return true; }
        return false;
      }
      this.stopVoice();
    }
    // 差分を選ぶ（直前と同じものは避ける）
    let pool = files;
    const last = this.voiceLastVariant.get(cdKey);
    if (files.length > 1 && last) pool = files.filter((f) => f !== last);
    const file = pool[Math.floor(Math.random() * pool.length)];
    this.voiceLastVariant.set(cdKey, file);
    this.voiceLastAt.set(cdKey, now);
    const key = voiceKey(file);
    this.voicePriority = prio;
    this.voiceGain = VOICE_GAIN[characterId] ?? 1;
    if (this.has(key)) {
      this.startVoice(key);
      return true;
    }
    // まだ読んでいない：読んでから鳴らす（そのあいだに強いボイスが来たら、そちらを優先）
    const scene = this.aliveScene();
    if (!scene) return false;
    const want = this.voicePriority;
    this.voiceLoading.add(key);
    scene.load.audio(key, `assets/audio/voice/${file}`);
    scene.load.once(`filecomplete-audio-${key}`, () => {
      this.voiceLoading.delete(key);
      if (this.voicePriority === want && !(this.voiceSound && this.voiceSound.isPlaying)) this.startVoice(key);
    });
    if (!scene.load.isLoading()) scene.load.start();
    return true;
  }

  /**
   * 鑑賞用の再生（図鑑のボイス一覧）。間引きと優先度を通さず、鳴っている途中でも切り替える。
   * file は voiceFiles() が返すファイル名。まだ読んでいなければ読んでから鳴らす
   */
  previewVoice(characterId: string, file: string, scene: Phaser.Scene): void {
    if (!this.game || this.volumes.voice <= 0) return;
    const key = voiceKey(file);
    this.voiceQueued = null;
    this.voicePriority = 99;
    this.voiceGain = VOICE_GAIN[characterId] ?? 1;
    if (this.has(key)) {
      this.startVoice(key);
      return;
    }
    if (this.voiceLoading.has(key)) return;
    this.voiceLoading.add(key);
    scene.load.audio(key, `assets/audio/voice/${file}`);
    scene.load.once(`filecomplete-audio-${key}`, () => {
      this.voiceLoading.delete(key);
      if (this.voicePriority === 99) this.startVoice(key);
    });
    if (!scene.load.isLoading()) scene.load.start();
  }

  private startVoice(key: string): void {
    if (!this.game) return;
    this.stopVoice();
    const snd = this.game.sound.add(key, { volume: this.volumes.voice * this.voiceGain });
    this.voiceSound = snd;
    // BGM を下げる
    if (this.bgm && 'setVolume' in this.bgm) (this.bgm as Phaser.Sound.WebAudioSound).setVolume(this.volumes.bgm * VOICE_DUCK);
    snd.once('complete', () => this.onVoiceEnd(snd));
    snd.once('stop', () => this.onVoiceEnd(snd));
    snd.play();
  }

  private onVoiceEnd(snd: Phaser.Sound.BaseSound): void {
    if (this.voiceSound !== snd) return;
    this.voiceSound = undefined;
    this.voicePriority = 0;
    snd.destroy();
    if (this.bgm && 'setVolume' in this.bgm) (this.bgm as Phaser.Sound.WebAudioSound).setVolume(this.volumes.bgm);
    const q = this.voiceQueued;
    if (q) {
      this.voiceQueued = null;
      this.voice(q.characterId, q.kind);
    }
  }

  /** 鳴っているボイスを止める（画面の切り替えなど） */
  stopVoice(): void {
    const snd = this.voiceSound;
    if (!snd) return;
    this.voiceSound = undefined;
    this.voicePriority = 0;
    snd.stop();
    snd.destroy();
    if (this.bgm && 'setVolume' in this.bgm) (this.bgm as Phaser.Sound.WebAudioSound).setVolume(this.volumes.bgm);
  }

  /** 生きているシーン（遅延読み込みのローダーに使う） */
  private aliveScene(): Phaser.Scene | undefined {
    if (!this.game) return undefined;
    const alive = this.game.scene.getScenes(false).filter((x) => {
      const st = x.sys.settings.status;
      return st >= Phaser.Scenes.INIT && st <= Phaser.Scenes.PAUSED;
    });
    return alive.find((x) => x.scene.key === 'Game') ?? alive[alive.length - 1];
  }

  stopBgm(): void {
    this.wantedBgm = '';
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = undefined;
    }
  }
}

export const AudioBus = new AudioBusImpl();
// 確認用（ブラウザのコンソールから状態を見る）
(window as unknown as { __AudioBus?: unknown }).__AudioBus = AudioBus;
