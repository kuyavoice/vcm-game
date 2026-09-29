import type { StageDef } from './stages';
import type { WaveBand } from './waves';

// エンドレス：時間切れもクリアも無い。倒れるまで続く（2026-09-30 ユーザー承認）。
// 5分ごとにボスが1体。4体（城兵級 → 女王級 → 黒騎士 → 悪夢の黒騎士）で1周＝20分。
// 永続強化は効かない。1周するたびに、ボスのHPと敵の攻撃力が上がる。雑魚は1分ごとに少しずつ強くなる。
// 数値は初期値。

/** 公開済み（2026-09-30）。false にすると、URL に `?endless` か `?debug` を付けたときだけ、ステージ選択に出る */
export const ENDLESS_AVAILABLE = true;

/** いま、ステージ選択に出してよいか */
export function isEndlessShown(): boolean {
  if (ENDLESS_AVAILABLE) return true;
  return typeof location !== 'undefined' && /[?&](endless|debug)(?:[&=]|$)/.test(location.search);
}

/** 1周目（0:00〜20:00）。最初はビルドを組む時間 */
const FIRST: WaveBand[] = [
  { label: '雑音級', from: 0, to: 90, spawnPerSecStart: 1.5, spawnPerSecEnd: 2.5, weights: { grunt: 1 }, hpMul: 1 },
  { label: '＋狩人級', from: 90, to: 300, spawnPerSecStart: 2.5, spawnPerSecEnd: 4, weights: { grunt: 1, hunter: 0.3 }, hpMul: 1.1, ambush: { type: 'hunter', count: 12, everySec: 30 } },
  { label: '＋騎士級', from: 300, to: 600, spawnPerSecStart: 4, spawnPerSecEnd: 5, weights: { grunt: 1, hunter: 0.4, knight: 0.12 }, hpMul: 1.3, ambush: { type: 'hunter', count: 14, everySec: 30 } },
  { label: '＋司祭級', from: 600, to: 900, spawnPerSecStart: 5, spawnPerSecEnd: 6, weights: { grunt: 1, hunter: 0.45, knight: 0.14, bishop: 0.1 }, hpMul: 1.5, ambush: { type: 'hunter', count: 16, everySec: 30 } },
  { label: '満月', from: 900, to: 1020, spawnPerSecStart: 5, spawnPerSecEnd: 6, weights: { grunt: 1, hunter: 0.5, knight: 0.16, bishop: 0.12 }, hpMul: 1.7, fullMoon: true },
  { label: '大群', from: 1020, to: 1200, spawnPerSecStart: 6, spawnPerSecEnd: 8, weights: { grunt: 1, hunter: 0.5, knight: 0.18, bishop: 0.14 }, hpMul: 1.9, ambush: { type: 'hunter', count: 20, everySec: 25 } },
];

/** 2周目から（20分を繰り返す）。敵の硬さは、時間とともに上がる倍率（ramp）で増える */
const LOOP: WaveBand[] = [
  { label: '大群', from: 0, to: 300, spawnPerSecStart: 5, spawnPerSecEnd: 6, weights: { grunt: 1, hunter: 0.5, knight: 0.18, bishop: 0.14 }, hpMul: 2.0, ambush: { type: 'hunter', count: 18, everySec: 25 } },
  { label: '大群 II', from: 300, to: 600, spawnPerSecStart: 6, spawnPerSecEnd: 7, weights: { grunt: 1, hunter: 0.55, knight: 0.2, bishop: 0.16 }, hpMul: 2.1, ambush: { type: 'hunter', count: 20, everySec: 25 } },
  { label: '満月', from: 600, to: 720, spawnPerSecStart: 6, spawnPerSecEnd: 7, weights: { grunt: 1, hunter: 0.55, knight: 0.2, bishop: 0.16 }, hpMul: 2.2, fullMoon: true },
  { label: '大群 III', from: 720, to: 1200, spawnPerSecStart: 7, spawnPerSecEnd: 9, weights: { grunt: 1, hunter: 0.6, knight: 0.22, bishop: 0.18 }, hpMul: 2.3, ambush: { type: 'hunter', count: 24, everySec: 20 } },
];

export const ENDLESS = {
  /** 1周の長さ（秒） */
  loopSec: 1200,
  loopWaves: LOOP,
  /** ボスの間隔（秒）と、出る順番。hpMul はそのボスのHP倍率（1周目） */
  bossEverySec: 300,
  bosses: [
    { id: 'rook', hpMul: 1.5 },
    { id: 'queen', hpMul: 2.5 },
    { id: 'blackknight', hpMul: 3.0 },
    { id: 'redknight', hpMul: 4.0 },
  ] as const,
  /**
   * 1周ごとに足す倍率：ボスのHP／敵の攻撃力。
   * 0.6／0.25 → 0.8／0.35（2026-09-30 試遊：瑞穂で73:56・4周目。3周目までは、3倍速で放置しても負けなかった）
   */
  cycleBossHpAdd: 0.8,
  cycleDamageAdd: 0.35,
  /** ボスが居る間の、雑魚の湧きの倍率 */
  bossSpawnMul: 0.6,
  /** 端末の中の記録の件数（生存時間の長い順） */
  rankingSize: 10,
};

/** エンドレスのステージ定義。スコアアタックをクリアすると解放。永続強化は効かない */
export const ENDLESS_STAGE: StageDef = {
  id: 97, name: 'エンドレス', nameEn: 'ENDLESS',
  desc: '明けない夜。5分ごとにボスが現れる。永続強化は効かない。',
  enemyHpMul: 1.5, enemySpeedMul: 1.3, spawnMul: 1.5, bossHpMul: 1, xpMul: 1.3,
  extraWeights: {},
  tint: 0xffffff, color: 0x7cffb2, bgm: 'bgm_stage3',
  unlockAfter: 99, weather: 'snow',
  waves: FIRST,
  ramp: { hpPerMin: 0.05, spawnPerMin: 0.02, speedPerMin: 0.004, speedMax: 1.25 },
  scoreMode: true,
  endless: true,
  noPermanent: true,
};

/**
 * 称号：生存時間で決まる。リザルトと共有画像に出す。
 * 名前はユーザー確認済み（2026-09-30。120:00 はユーザー指定）。キャラを問わず使える言葉にする。
 * 隠しキャラでも出るので、追補パッチ⑤ §1 の言葉（生存・帰還を示す言葉、『沈黙』など）と、「終」「最後」は使わない。
 */
export const ENDLESS_TITLES: { fromSec: number; name: string }[] = [
  { fromSec: 0, name: '迷い星' },
  { fromSec: 300, name: '宵の明星' },
  { fromSec: 600, name: '夜を歩く者' },
  { fromSec: 900, name: '声を繋ぐ者' },
  { fromSec: 1200, name: '星を繋ぐ者' },
  { fromSec: 1800, name: '夜明けを待つ者' },
  { fromSec: 2400, name: '悪夢を越えし者' },
  { fromSec: 3000, name: '眠らない守り手' },
  { fromSec: 3600, name: '明けない夜の覇者' },
  { fromSec: 4500, name: '夜を統べる者' },
  { fromSec: 5400, name: '伝説の一等星' },
  // 120:00 は、少し遊び心を入れる（ユーザー指定）
  { fromSec: 7200, name: 'すべてを超えし者' },
];

/** その時間の称号と、次の称号（無ければ null） */
export function endlessTitle(sec: number): { name: string; next: { name: string; inSec: number } | null } {
  let i = 0;
  for (let k = 0; k < ENDLESS_TITLES.length; k++) if (sec >= ENDLESS_TITLES[k].fromSec) i = k;
  const n = ENDLESS_TITLES[i + 1];
  return { name: ENDLESS_TITLES[i].name, next: n ? { name: n.name, inSec: n.fromSec - sec } : null };
}

/** 何周目か（1から） */
export const endlessLoop = (sec: number) => Math.floor(sec / ENDLESS.loopSec) + 1;
