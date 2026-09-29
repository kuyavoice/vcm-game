import type { StageDef } from './stages';
import type { WaveBand } from './waves';

// EXステージ「悪夢」：15分で3体のボス。敵のHPは STAGE 3 と同じにして、速さと数で圧をかける。
// 硬さで長引かせず、1回の被弾を重くする（敵の攻撃力 1.5倍）。予兆を見て避ければ勝てる作りを保つ。
// 時間が短いぶん経験値を増やし、15:00 までに構成が完成するようにする。数値は初期値。

export const NIGHTMARE_WAVES: WaveBand[] = [
  // 序盤は足の速い狩人級を抑える（足の遅いキャラが最初の数分で囲まれて崩れるため。2026-09-27 試遊の指摘）
  // 最初の 1:30 は雑音級だけ（ビルドを組む時間。ユーザー指定）
  { label: '雑音級', from: 0, to: 90, spawnPerSecStart: 1.2, spawnPerSecEnd: 2.0, weights: { grunt: 1 }, hpMul: 1 },
  { label: '＋狩人級・騎士級', from: 90, to: 180, spawnPerSecStart: 2.0, spawnPerSecEnd: 3.0, weights: { grunt: 1, hunter: 0.15, knight: 0.1 }, hpMul: 1.1 },
  { label: '＋司祭級', from: 180, to: 300, spawnPerSecStart: 3.0, spawnPerSecEnd: 4.0, weights: { grunt: 1, hunter: 0.3, knight: 0.14, bishop: 0.1 }, hpMul: 1.25, ambush: { type: 'hunter', count: 10, everySec: 30 } },
  // 5:00 城兵級（最初から激昂）。倒すのが遅れると、次の大群と重なる
  { label: '城兵級', from: 300, to: 420, spawnPerSecStart: 2.0, spawnPerSecEnd: 2.5, weights: { grunt: 1, hunter: 0.4, knight: 0.08 }, hpMul: 1.4, boss: 'rook', bossHpMul: 1.5, bossEnraged: true },
  { label: '大群', from: 420, to: 600, spawnPerSecStart: 4.0, spawnPerSecEnd: 5.0, weights: { grunt: 1, hunter: 0.5, knight: 0.16, bishop: 0.12 }, hpMul: 1.6, ambush: { type: 'hunter', count: 12, everySec: 25 } },
  // 10:00 女王級（2026-09-30 ユーザー指定。以前は黒騎士）。雑魚は止まらない
  { label: '女王級', from: 600, to: 720, spawnPerSecStart: 2.5, spawnPerSecEnd: 3.0, weights: { grunt: 1, hunter: 0.4, knight: 0.1 }, hpMul: 1.8, boss: 'queen', bossHpMul: 3.0 },
  { label: '満月', from: 720, to: 780, spawnPerSecStart: 3.0, spawnPerSecEnd: 3.5, weights: { grunt: 1, hunter: 0.5, knight: 0.16, bishop: 0.12 }, hpMul: 2.0, fullMoon: true },
  { label: '大群 II', from: 780, to: 900, spawnPerSecStart: 5.0, spawnPerSecEnd: 6.0, weights: { grunt: 1, hunter: 0.5, knight: 0.2, bishop: 0.15 }, hpMul: 2.2, ambush: { type: 'hunter', count: 14, everySec: 20 } },
  // 15:00 悪夢の黒騎士（最初から後半の行動）。倒せばクリア
  { label: '悪夢の黒騎士', from: 900, to: 9999, spawnPerSecStart: 3.0, spawnPerSecEnd: 3.0, weights: { grunt: 1, hunter: 0.4, knight: 0.1 }, hpMul: 2.4, boss: 'redknight', bossHpMul: 5.0, bossEnraged: true },
];

/** 公開済み（2026-09-27）。false にすると、ステージ選択から外れる */
export const NIGHTMARE_AVAILABLE = true;

/** EXステージ「悪夢」のステージ定義。スコアアタックをクリアすると解放。永続強化は効かない */
export const NIGHTMARE_STAGE: StageDef = {
  id: 98, name: '悪夢', nameEn: 'EX STAGE',
  desc: '15分。城兵、女王、そして悪夢の黒騎士。一撃が重く、永続強化は効かない。',
  enemyHpMul: 2.5, enemySpeedMul: 1.35, spawnMul: 2.0, bossHpMul: 1, xpMul: 1.4,
  enemyDamageMul: 1.5,
  extraWeights: {},
  tint: 0xffffff, color: 0xff2244, bgm: 'bgm_stage3',
  unlockAfter: 99, weather: 'snow',
  waves: NIGHTMARE_WAVES,
  finalBoss: 'redknight',
  noPermanent: true,
};
