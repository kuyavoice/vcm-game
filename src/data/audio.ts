// サウンド・ボイスの差し込み口。ファイルを置くだけで鳴る（未配置なら無音）。
// パスは public/ 配下。素材はオーナー側で用意（SUNO／ElevenLabs）。

import { VOICE_FILES } from './voiceIndex';
import { voiceKey } from './voice';

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
  // 旧版のボス戦の曲。いまは、専用の曲が無いボスの代わりに流れる
  { key: 'bgm_boss', path: 'assets/audio/bgm/boss.mp3', category: 'bgm', loop: true },
  // 城兵級『動く城塞』・女王級『茨の女王』（無ければ boss）
  { key: 'bgm_boss_rook', path: 'assets/audio/bgm/boss_rook.mp3', category: 'bgm', loop: true },
  { key: 'bgm_boss_queen', path: 'assets/audio/bgm/boss_queen.mp3', category: 'bgm', loop: true },
  { key: 'bgm_boss_blackknight', path: 'assets/audio/bgm/boss_blackknight.mp3', category: 'bgm', loop: true },
  // 黒騎士の形態変化後（無ければ boss_blackknight のまま）
  { key: 'bgm_boss_blackknight2', path: 'assets/audio/bgm/boss_blackknight2.mp3', category: 'bgm', loop: true },
  // EXステージ最後のボス『悪夢の黒騎士 ― Knight of the Black Snow』（前半・後半とも同じ曲。無ければ黒騎士の曲）
  { key: 'bgm_boss_redknight', path: 'assets/audio/bgm/boss_redknight.mp3', category: 'bgm', loop: true },
  // 道中はキャラソンのバトルアレンジ（無ければ stageN → stage）
  { key: 'bgm_chara_kuya', path: 'assets/audio/bgm/chara_kuya.mp3', category: 'bgm', loop: true },
  { key: 'bgm_chara_mizuho', path: 'assets/audio/bgm/chara_mizuho.mp3', category: 'bgm', loop: true },
  { key: 'bgm_chara_yukihito', path: 'assets/audio/bgm/chara_yukihito.mp3', category: 'bgm', loop: true },
  { key: 'bgm_chara_ritsuka', path: 'assets/audio/bgm/chara_ritsuka.mp3', category: 'bgm', loop: true },
  { key: 'bgm_chara_shion', path: 'assets/audio/bgm/chara_shion.mp3', category: 'bgm', loop: true },
  { key: 'bgm_result', path: 'assets/audio/bgm/result.mp3', category: 'bgm', loop: true },
  // ゲームオーバー・時間切れのリザルト（無ければ result → title）
  { key: 'bgm_gameover', path: 'assets/audio/bgm/gameover.mp3', category: 'bgm', loop: true },
  // クリア後の曲（操作キャラ別。無ければ result → title）
  { key: 'bgm_clear_kuya', path: 'assets/audio/bgm/clear_kuya.mp3', category: 'bgm', loop: true },
  { key: 'bgm_clear_mizuho', path: 'assets/audio/bgm/clear_mizuho.mp3', category: 'bgm', loop: true },
  { key: 'bgm_clear_yukihito', path: 'assets/audio/bgm/clear_yukihito.mp3', category: 'bgm', loop: true },
  { key: 'bgm_clear_ritsuka', path: 'assets/audio/bgm/clear_ritsuka.mp3', category: 'bgm', loop: true },
  { key: 'bgm_clear_shion', path: 'assets/audio/bgm/clear_shion.mp3', category: 'bgm', loop: true },
  // SE
  { key: 'se_slash', path: 'assets/audio/se/slash.mp3', category: 'se' },
  // 雪人の斬撃（大剣・『乱れ雪月花』）。未配置なら slash で代用
  { key: 'se_yukihito_slash', path: 'assets/audio/se/yukihito_slash.mp3', category: 'se' },
  // 黒騎士の斬撃（剣閃・二連斬・連撃）。重い音。右向きは heavy、左向きは heavy2。未配置なら slash で代用
  { key: 'se_slash_heavy', path: 'assets/audio/se/slash_heavy.mp3', category: 'se' },
  { key: 'se_slash_heavy2', path: 'assets/audio/se/slash_heavy2.mp3', category: 'se' },
  // 黒騎士の突進（予備動作の開始から鳴らす。元素材『鉄の騎馬』を1.6秒に切ってフェードアウト）
  { key: 'se_knight_charge', path: 'assets/audio/se/knight_charge.mp3', category: 'se' },
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
  // ボスの激昂・開花（未配置なら boss で代用）
  { key: 'se_boss_enrage', path: 'assets/audio/se/boss_enrage.mp3', category: 'se' },
  // 城兵級（未配置なら、それぞれ近い音で代用。docs/SE依頼リスト_ボスの行動.md）
  { key: 'se_rook_cannon', path: 'assets/audio/se/rook_cannon.mp3', category: 'se' },
  { key: 'se_rook_impact', path: 'assets/audio/se/rook_impact.mp3', category: 'se' },
  { key: 'se_rook_wall', path: 'assets/audio/se/rook_wall.mp3', category: 'se' },
  { key: 'se_rook_wall_break', path: 'assets/audio/se/rook_wall_break.mp3', category: 'se' },
  { key: 'se_rook_stomp', path: 'assets/audio/se/rook_stomp.mp3', category: 'se' },
  { key: 'se_rook_charge', path: 'assets/audio/se/rook_charge.mp3', category: 'se' },
  // 女王級
  { key: 'se_queen_emerge', path: 'assets/audio/se/queen_emerge.mp3', category: 'se' },
  { key: 'se_queen_summon', path: 'assets/audio/se/queen_summon.mp3', category: 'se' },
  { key: 'se_queen_hatch', path: 'assets/audio/se/queen_hatch.mp3', category: 'se' },
  { key: 'se_queen_whip', path: 'assets/audio/se/queen_whip.mp3', category: 'se' },
  { key: 'se_queen_thrust', path: 'assets/audio/se/queen_thrust.mp3', category: 'se' },
  { key: 'se_queen_pollen', path: 'assets/audio/se/queen_pollen.mp3', category: 'se' },
  { key: 'se_queen_burrow', path: 'assets/audio/se/queen_burrow.mp3', category: 'se' },
  { key: 'se_queen_cage', path: 'assets/audio/se/queen_cage.mp3', category: 'se' },
  // 悪夢の黒騎士の専用技（未配置なら無音）
  { key: 'se_redknight_moon', path: 'assets/audio/se/redknight_moon.mp3', category: 'se' },
  { key: 'se_redknight_fang', path: 'assets/audio/se/redknight_fang.mp3', category: 'se' },
  { key: 'se_redknight_flame', path: 'assets/audio/se/redknight_flame.mp3', category: 'se' },
  // そのほか
  { key: 'se_fusion', path: 'assets/audio/se/fusion.mp3', category: 'se' },
  { key: 'se_beam', path: 'assets/audio/se/beam.mp3', category: 'se' },
  { key: 'se_freeze', path: 'assets/audio/se/freeze.mp3', category: 'se' },
];

// キャラクターボイス：配置されているファイルの一覧（voiceIndex.ts。make_voice.py が書き出す）から作る。
// 起動時には読まず、使うキャラのぶんだけ読む（AudioBus.preloadVoices）
for (const f of VOICE_FILES) AUDIO_MANIFEST.push({ key: voiceKey(f), path: `assets/audio/voice/${f}`, category: 'voice' });

