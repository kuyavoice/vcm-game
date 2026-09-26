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

  /** Boot で呼ぶ：実在が確認できた音声だけ読み込む */
  queueLoad(loader: Phaser.Loader.LoaderPlugin): void {
    for (const e of AUDIO_MANIFEST) if (this.available.has(e.key)) loader.audio(e.key, e.path);
  }

  setVolume(cat: AudioCategory, v: number): void {
    this.volumes[cat] = v;
    if (cat === 'bgm' && this.bgm && 'setVolume' in this.bgm) (this.bgm as Phaser.Sound.WebAudioSound).setVolume(v);
  }

  private has(key: string): boolean {
    return !!this.game && this.game.cache.audio.exists(key);
  }

  /** SE／ボイス。minGapMs で連打を間引く */
  play(key: string, minGapMs = 0): void {
    if (!this.has(key) || !this.game) return;
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.lastPlayed.set(key, now);
    const entry = AUDIO_MANIFEST.find((e) => e.key === key);
    const cat = entry?.category ?? 'se';
    this.game.sound.play(key, { volume: this.volumes[cat] });
  }

  /** fallback：key が未配置のときに使うキー（ステージ別BGM → 共通BGM など） */
  playBgm(key: string, fallback?: string): void {
    if (!this.game) return;
    if (!this.has(key) && fallback) key = fallback;
    if (this.bgm && (this.bgm as Phaser.Sound.BaseSound).key === key) return;
    this.stopBgm();
    if (!this.has(key)) return;
    this.bgm = this.game.sound.add(key, { loop: true, volume: this.volumes.bgm });
    this.bgm.play();
  }

  stopBgm(): void {
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = undefined;
    }
  }
}

export const AudioBus = new AudioBusImpl();
