import type { EnemyId } from './enemies';
import { SCORE_STAGE_REF, type StageDef } from './stages';
import type { WaveBand } from './waves';

// スコアアタック（v2 §10.5）：全ステージクリアで解放。30分。数値は初期値。

export const SCORE = {
  /** 撃破点 */
  points: {
    grunt: 1, hunter: 1, bishop: 4, knight: 5, cavalry: 5, king: 500, blackknight: 1000, redknight: 1500, speaker: 0,
  } as Record<EnemyId, number>,
  /** 連撃：この秒数以内に次の撃破で倍率上昇 */
  comboWindowSec: 1.0,
  /** 1撃破ごとの倍率上昇と上限 */
  comboStep: 0.1,
  comboMax: 3,
  /** ボーナス：生存1秒あたり／ノーダメージ1秒あたり */
  survivalPerSec: 10,
  noDamagePerSec: 5,
  /** 30:00 の強化黒騎士を倒せなければ時間切れ（秒）。33:00 → 35:00 に延長（2026-09-27） */
  timeLimitSec: 2100,
  /** 残り時間がこの秒数を切ったら、画面に残り時間を出す（＝黒騎士が出る 30:00 から） */
  countdownFromSec: 300,
  /** ランキングの保存件数 */
  rankingSize: 10,
};

/** スコアアタックの時間帯 */
export const SCORE_WAVES: WaveBand[] = [
  { label: '雑音級', from: 0, to: 120, spawnPerSecStart: 1.5, spawnPerSecEnd: 3, weights: { grunt: 1 }, hpMul: 1 },
  { label: '雑音級＋狩人級', from: 120, to: 300, spawnPerSecStart: 3, spawnPerSecEnd: 4, weights: { grunt: 1, hunter: 0.4 }, hpMul: 1.1, ambush: { type: 'hunter', count: 14, everySec: 25 } },
  { label: '＋騎士級', from: 300, to: 480, spawnPerSecStart: 4, spawnPerSecEnd: 5, weights: { grunt: 1, hunter: 0.45, knight: 0.12 }, hpMul: 1.25, ambush: { type: 'hunter', count: 16, everySec: 30 } },
  { label: '＋司祭級', from: 480, to: 600, spawnPerSecStart: 5, spawnPerSecEnd: 6, weights: { grunt: 1, hunter: 0.45, knight: 0.14, bishop: 0.1 }, hpMul: 1.4 },
  { label: '王級', from: 600, to: 900, spawnPerSecStart: 2, spawnPerSecEnd: 4, weights: { grunt: 1, hunter: 0.4, knight: 0.1 }, hpMul: 1.5, boss: 'king' },
  { label: '大群', from: 900, to: 1200, spawnPerSecStart: 6, spawnPerSecEnd: 8, weights: { grunt: 1, hunter: 0.5, knight: 0.18, bishop: 0.14 }, hpMul: 1.8, ambush: { type: 'hunter', count: 20, everySec: 25 } },
  { label: '王級×2', from: 1200, to: 1500, spawnPerSecStart: 3, spawnPerSecEnd: 5, weights: { grunt: 1, hunter: 0.5, knight: 0.15 }, hpMul: 2.0, boss: 'king', bossCount: 2 },
  { label: '満月', from: 1500, to: 1620, spawnPerSecStart: 6, spawnPerSecEnd: 7, weights: { grunt: 1, hunter: 0.5, knight: 0.2, bishop: 0.15 }, hpMul: 2.2, fullMoon: true },
  { label: '大群 II', from: 1620, to: 1800, spawnPerSecStart: 8, spawnPerSecEnd: 10, weights: { grunt: 1, hunter: 0.6, knight: 0.22, bishop: 0.18 }, hpMul: 2.5, ambush: { type: 'hunter', count: 24, everySec: 20 } },
  { label: '黒騎士', from: 1800, to: 9999, spawnPerSecStart: 2, spawnPerSecEnd: 2, weights: { grunt: 1, hunter: 0.4 }, hpMul: 2.5, boss: 'blackknight', bossHpMul: 1.5 },
];

/** スコアアタック用のステージ定義（ステージ選択の4枚目） */
export const SCORE_STAGE: StageDef = {
  id: 99, name: 'スコアアタック', nameEn: 'SCORE ATTACK',
  desc: '30分。敵はすべて1.5倍から始まり、時間とともに強くなる。最後は強化された黒騎士。',
  enemyHpMul: 1.5, enemySpeedMul: 1.5, spawnMul: 1.5, bossHpMul: 1, xpMul: 1.3,
  extraWeights: { knight: 0.08, bishop: 0.06 },
  tint: 0xffffff, color: 0xffd700, bgm: 'bgm_stage3',
  weather: 'snow',
  waves: SCORE_WAVES,
  /** 時間とともに上昇（1分ごとの加算率） */
  ramp: { hpPerMin: 0.04, spawnPerMin: 0.03, speedPerMin: 0.01 },
  scoreMode: true,
};
SCORE_STAGE_REF.value = SCORE_STAGE;
