// サウンド・ボイスの差し込み口。ファイルを置くだけで鳴る（未配置なら無音）。
// パスは public/ 配下。素材はオーナー側で用意（SUNO／ElevenLabs）。

export type AudioCategory = 'bgm' | 'se' | 'voice';

export interface AudioEntry {
  key: string;
  path: string;
  category: AudioCategory;
  loop?: boolean;
}

export const AUDIO_MANIFEST: AudioEntry[] = [
  // BGM（ループ）
  { key: 'bgm_title', path: 'assets/audio/bgm/title.mp3', category: 'bgm', loop: true },
  { key: 'bgm_stage', path: 'assets/audio/bgm/stage.mp3', category: 'bgm', loop: true },
  { key: 'bgm_stage2', path: 'assets/audio/bgm/stage2.mp3', category: 'bgm', loop: true },
  { key: 'bgm_stage3', path: 'assets/audio/bgm/stage3.mp3', category: 'bgm', loop: true },
  { key: 'bgm_fullmoon', path: 'assets/audio/bgm/fullmoon.mp3', category: 'bgm', loop: true },
  { key: 'bgm_boss', path: 'assets/audio/bgm/boss.mp3', category: 'bgm', loop: true },
  { key: 'bgm_result', path: 'assets/audio/bgm/result.mp3', category: 'bgm', loop: true },
  // SE
  { key: 'se_slash', path: 'assets/audio/se/slash.mp3', category: 'se' },
  { key: 'se_shot', path: 'assets/audio/se/shot.mp3', category: 'se' },
  { key: 'se_hit', path: 'assets/audio/se/hit.mp3', category: 'se' },
  { key: 'se_kill', path: 'assets/audio/se/kill.mp3', category: 'se' },
  { key: 'se_gem', path: 'assets/audio/se/gem.mp3', category: 'se' },
  { key: 'se_levelup', path: 'assets/audio/se/levelup.mp3', category: 'se' },
  { key: 'se_chest', path: 'assets/audio/se/chest.mp3', category: 'se' },
  { key: 'se_special', path: 'assets/audio/se/special.mp3', category: 'se' },
  { key: 'se_break', path: 'assets/audio/se/break.mp3', category: 'se' },
  { key: 'se_item', path: 'assets/audio/se/item.mp3', category: 'se' },
  { key: 'se_evolve', path: 'assets/audio/se/evolve.mp3', category: 'se' },
  { key: 'se_boss', path: 'assets/audio/se/boss.mp3', category: 'se' },
  // 空夜ボイス
  { key: 'vo_kuya_start', path: 'assets/audio/voice/kuya_start.mp3', category: 'voice' },
  { key: 'vo_kuya_evolve', path: 'assets/audio/voice/kuya_evolve.mp3', category: 'voice' },
  { key: 'vo_kuya_special', path: 'assets/audio/voice/kuya_special.mp3', category: 'voice' },
  { key: 'vo_kuya_levelup', path: 'assets/audio/voice/kuya_levelup.mp3', category: 'voice' },
  { key: 'vo_kuya_hit', path: 'assets/audio/voice/kuya_hit.mp3', category: 'voice' },
  { key: 'vo_kuya_gameover', path: 'assets/audio/voice/kuya_gameover.mp3', category: 'voice' },
  { key: 'vo_kuya_clear', path: 'assets/audio/voice/kuya_clear.mp3', category: 'voice' },
];
