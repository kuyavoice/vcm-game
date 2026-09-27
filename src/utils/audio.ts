import Phaser from 'phaser';
import { AUDIO_MANIFEST, type AudioCategory } from '../data/audio';
import { loadSave } from './storage';

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
      loader.audio(e.key, e.path);
    }
  }

  /** 再生したいBGM（遅延読み込みの完了後に、まだこの曲が望まれていれば再生） */
  private wantedBgm = '';

  setVolume(cat: AudioCategory, v: number): void {
    this.volumes[cat] = v;
    if (cat === 'bgm' && this.bgm && 'setVolume' in this.bgm) (this.bgm as Phaser.Sound.WebAudioSound).setVolume(v);
  }

  private has(key: string): boolean {
    return !!this.game && this.game.cache.audio.exists(key);
  }

  /** SE／ボイス。minGapMs で連打を間引く。fallback：key が未配置のときに代わりに鳴らすキー */
  play(key: string, minGapMs = 0, fallback?: string): void {
    if (!this.has(key) && fallback) key = fallback;
    if (!this.has(key) || !this.game) return;
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.lastPlayed.set(key, now);
    const entry = AUDIO_MANIFEST.find((e) => e.key === key);
    const cat = entry?.category ?? 'se';
    this.game.sound.play(key, { volume: this.volumes[cat] });
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
    loader.once(`filecomplete-audio-${key}`, () => {
      if (this.wantedBgm === key && this.has(key)) this.startBgm(key);
    });
    if (!loader.isLoading()) loader.start();
  }

  private startBgm(key: string): void {
    if (!this.game) return;
    this.stopBgm();
    this.bgm = this.game.sound.add(key, { loop: true, volume: this.volumes.bgm });
    this.bgm.play();
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
