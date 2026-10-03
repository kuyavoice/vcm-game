import { VOICE_FILES } from './voiceIndex';

// キャラクターボイス（voice_spec_and_lines.md。2026-10-03 マージ）。
// ファイル：public/assets/audio/voice/{キャラID}_{種類}.mp3（差分が複数なら _1, _2 …）。
// 鳴らすのは AudioBus.voice()。同時に鳴るのは1つだけ。優先度が高いものが割り込む。鳴っている間は BGM を下げる。

export type VoiceKind =
  | 'start' | 'evolve' | 'special' | 'levelup' | 'hit' | 'gameover' | 'clear'
  | 'title' | 'select' | 'boss' | 'fusion' | 'fullmoon' | 'pinch' | 'idle' | 'best' | 'union';

/** 優先度（大きいほど強い）。鳴っている途中に別のボイスが来たら、優先度が高い方。同じなら後から来た方を捨てる */
export const VOICE_PRIORITY: Record<VoiceKind, number> = {
  special: 5,
  evolve: 4, gameover: 4, clear: 4, boss: 4, fusion: 4, union: 4,
  start: 3, title: 3, select: 3, fullmoon: 3, pinch: 3, best: 3,
  levelup: 2, idle: 2,
  hit: 1,
};

/**
 * 同じ種類を続けて鳴らさない時間（ms）。
 * 必殺は資料では制限なしだが、連打するとうるさいので、1回鳴ったら2分は鳴らさない（2026-10-03 ユーザー指定）
 */
export const VOICE_COOLDOWN_MS: Partial<Record<VoiceKind, number>> = {
  special: 120000,
  levelup: 4000,
  hit: 2500,
  pinch: 30000,
};

/** 1プレイで鳴らす回数の上限（GameScene が数える） */
export const VOICE_PER_RUN: Partial<Record<VoiceKind, number>> = {
  pinch: 3,
  idle: 2,
};

/** ピンチの判定：HPがこの割合を下回った瞬間 */
export const PINCH_RATIO = 0.3;

/** 専用合体技（操作キャラとこの合体が成立したとき、fusion の代わりに union を鳴らす） */
export const UNION_FUSION: Record<string, string> = {
  kuya: 'tristar',
  yukihito: 'hakugin',
  shion: 'shiningray',
  ritsuka: 'nekobako',
};

/** ボイスが鳴っている間の BGM の音量の倍率（−6dB） */
export const VOICE_DUCK = 0.5;

/** キャラごとの音量の微調整（瑞穂は人の収録で、聴感が違うことがある。初期値1.0） */
export const VOICE_GAIN: Record<string, number> = {};

/** そのキャラ・種類の差分ファイル（例：kuya_start_1.mp3, kuya_start_2.mp3。番号なしは1つ） */
export function voiceFiles(characterId: string, kind: VoiceKind): string[] {
  const one = `${characterId}_${kind}.mp3`;
  const re = new RegExp(`^${characterId}_${kind}_\\d+\\.mp3$`);
  return VOICE_FILES.filter((f) => f === one || re.test(f));
}

/** そのキャラのボイスの全ファイル */
export function voiceFilesOf(characterId: string): string[] {
  return VOICE_FILES.filter((f) => f.startsWith(`${characterId}_`));
}

export const voiceKey = (file: string) => `vo_${file.replace(/\.mp3$/, '')}`;
