import type { EnemyId } from './enemies';
import type { StageDef } from './stages';
import type { WaveBand } from './waves';

// ボスラッシュ（2026-10-01 ユーザー承認）：「サクッと腕試し」。
// 始める前に、図鑑に登録済みの共鳴アーツを3つ選ぶ（全部Lv8）。プレイヤーLvは40で固定、永続強化は無効。
// 城兵級 → 女王級 → 黒騎士 → 悪夢の黒騎士 と連戦。ボスを倒すごとに報酬（サポート／アーツ／宝箱）。
// 4体で1周。1周のクリア時間を競う。2周目からは同時に出るボスが増え、行動の間隔が短くなる（硬さは変えない）。
// 倒れるまで続く。数値は初期値。

export const RUSH = {
  /** プレイヤーLv（固定。ボスのHPとビルドの出発点をそろえる） */
  fixedLevel: 40,
  /** 選ぶ共鳴アーツの数 */
  pickCount: 3,
  /** 持っていけるサポートの数（0〜。最大Lvで始まる。2026-10-01 ユーザー要望：足の遅いキャラがすぐ倒れるため） */
  supportCount: 2,
  /** 最初のボスが出るまでと、ボス（の組）を倒してから次が出るまでの秒数 */
  firstDelaySec: 3,
  gapSec: 15,
  /** ボスごとのHP倍率（(3000 + 400×40) に掛ける。硬さは周で増やさない） */
  hpMul: { rook: 1.0, queen: 1.2, blackknight: 1.5, redknight: 2.0 } as Partial<Record<EnemyId, number>>,
  /** 周ごとの、ボスの行動の間隔の倍率（予兆の長さは変えない）。4周目以降は最後の値 */
  tempo: [1.0, 0.8, 0.7],
  /** 周ごとのボスの組。4周目以降は最後の並び */
  waves: [
    [['rook'], ['queen'], ['blackknight'], ['redknight']],
    [['rook', 'queen'], ['blackknight'], ['redknight']],
    [['rook', 'queen'], ['blackknight', 'redknight']],
  ] as EnemyId[][][],
  /** ボスを倒したときの報酬 */
  reward: { rook: 'support', queen: 'art', blackknight: 'chest', redknight: 'chest' } as Partial<Record<EnemyId, 'support' | 'art' | 'chest'>>,
  /** ボス撃破のエールの倍率（短いモードで稼げすぎないように） */
  yellMul: 0.5,
  /** 端末の中の記録の件数（1周のクリア時間の短い順） */
  rankingSize: 10,
};

/** 周ごとの、ボスの組の並び */
export function rushWaves(loop: number): EnemyId[][] {
  return RUSH.waves[Math.min(loop, RUSH.waves.length) - 1];
}

/** 周ごとの、行動の間隔の倍率 */
export function rushTempo(loop: number): number {
  return RUSH.tempo[Math.min(loop, RUSH.tempo.length) - 1];
}

/** 道中の雑魚（ボス戦の帯と同じくらい。ボスは GameScene が出す） */
const RUSH_WAVES: WaveBand[] = [
  { label: 'BOSS RUSH', from: 0, to: 9999, spawnPerSecStart: 1.5, spawnPerSecEnd: 2.0, weights: { grunt: 1, hunter: 0.3, knight: 0.05 }, hpMul: 2.0 },
];

export const RUSH_STAGE: StageDef = {
  id: 96, name: 'ボスラッシュ', nameEn: 'BOSS RUSH',
  desc: 'アーツ3つを選んで、ボスと連戦。1周の速さを競う。永続強化は効かない。',
  enemyHpMul: 1.5, enemySpeedMul: 1.2, spawnMul: 1, bossHpMul: 1, xpMul: 1,
  extraWeights: {},
  tint: 0xffffff, color: 0xff8c42, bgm: 'bgm_stage3',
  unlockAfter: 3, weather: 'snow',
  waves: RUSH_WAVES,
  scoreMode: false,
  rush: true,
  noPermanent: true,
};

/** 称号：1周のクリア時間で決まる（仮。ユーザーの監修待ち）。隠しキャラでも出るので、追補パッチ⑤ §1 の言葉と「終」「最後」は使わない */
export const RUSH_TITLES: { underSec: number; name: string }[] = [
  { underSec: 360, name: '夜を裂く者' },
  { underSec: 480, name: '星の疾走者' },
  { underSec: 600, name: '夜明けの挑戦者' },
  { underSec: Infinity, name: '完走者' },
];

export function rushTitle(sec: number): string {
  return RUSH_TITLES.find((t) => sec < t.underSec)?.name ?? RUSH_TITLES[RUSH_TITLES.length - 1].name;
}

export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
