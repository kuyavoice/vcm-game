// 闘技場（アリーナ）：狭い円形の場で、巨大化した「変異体」と1対1（2026-10-20 ユーザー案。まず①雑音級だけで手触りを確認する段階）。
// FF14 風の予兆攻撃：予兆（systems/Telegraph.ts）が満ちた瞬間に、その中にいれば大ダメージ。アーツは自由（ボスラッシュと同じ準備画面）。
// 数値はここだけ直せばよい。
import { ENEMIES, type EnemyDef, type EnemyId } from './enemies';
import type { StageDef } from './stages';
import type { WaveBand } from './waves';

export const ARENA = {
  /** 闘技場の半径（px）。縦 1280 の画面に収まる大きさ */
  radius: 560,
  /** 予兆を踏んだときのダメージ（ユーザー指定「ペナルティは大ダメージ」。ステージの倍率は掛からない） */
  telegraphDamage: 40,
  /** 最初から付くサポート（ユーザー指定：予兆を避けるには移動速度と自然回復がほぼ必須） */
  defaultSupports: ['route', 'patisserie'],
  /** 床のアーツ（チャーハンの帯・柵など）の濃さ。予兆と重なって見づらくならないように薄くする */
  zoneAlpha: 0.4,
  /** 最初の敵が出るまで・倒してから次が出るまでの秒数 */
  firstDelaySec: 2.5,
  gapSec: 4,
  /** 変異体の一覧（出る順）。base の絵を scale 倍にして使う。hp は固定（Lv40・アーツ Lv8 を想定） */
  bosses: [
    { base: 'grunt' as EnemyId, kind: 'grunt', name: '変異体・雑音級', hp: 9000, scale: 8, hitRadius: 100, contactDamage: 10 },
    { base: 'hunter' as EnemyId, kind: 'hunter', name: '変異体・狩人級', hp: 8000, scale: 8, hitRadius: 95, contactDamage: 10 },
  ],
  /** ①変異体・雑音級：突進／飛び跳ね3連／全体ばらまき */
  grunt: {
    walkSpeed: 90,
    keepDistance: 140,
    /** 出現してから最初の行動までと、行動のあとの間 */
    firstActDelaySec: 2.0,
    idleSec: 1.4,
    weights: { charge: 3, jump: 3, scatter: 2 } as Readonly<Record<string, number>>,
    /** 突進：帯の予兆 → ダッシュ */
    chargeWindupSec: 0.9,
    chargeLength: 760,
    chargeHalfWidth: 80,
    chargeDurationSec: 0.55,
    chargeSpeed: 1250,
    /** 飛び跳ね：進行方向に円の予兆を3つ（時間差）。着地の瞬間にそこへ現れる */
    jumpCount: 3,
    jumpWindupSec: 1.1,
    jumpGapSec: 0.32,
    jumpRadius: 125,
    jumpSpacing: 190,
    /** 全体ばらまき：足元の輪で予兆 → 全方位へランダム弾 */
    scatterWindupSec: 0.9,
    scatterSec: 1.8,
    scatterTickSec: 0.14,
    scatterPerTick: 3,
    scatterSpeedMin: 170,
    scatterSpeedMax: 330,
    scatterDamage: 12,
    /** ばらまきの弾：色は付けない（弾の絵は明るい緑。赤で染めると暗い床で見づらい。2026-10-20 ユーザー指摘）、大きさ 1.5 倍 */
    scatterTint: 0xffffff,
    scatterScale: 1.5,
  },
  /** ②変異体・狩人級（2026-10-20 ユーザー案）：姿を消して、プレイヤーの位置を通る直線をランダムな向きから駆け抜ける／正面に三日月の斬撃（→背面） */
  hunter: {
    walkSpeed: 150,
    keepDistance: 170,
    firstActDelaySec: 2.0,
    idleSec: 1.2,
    weights: { vanish: 3, crescent: 3, wave: 2 } as Readonly<Record<string, number>>,
    /** 姿消し：直線は1回の行動で lines 本（1本ずつ）。帯はプレイヤーの位置を通って闘技場を横断する。HP半分以下（激昂）で3本（2026-10-20 ユーザー指定） */
    vanishLines: 2,
    vanishLinesEnraged: 3,
    /** 衝撃波：立ち止まり、闘技場のランダムな位置に小さな三日月（扇）の予兆をばらまく（2026-10-20 ユーザー指定）。激昂で数が増える */
    waveCount: 8,
    waveCountEnraged: 12,
    waveIntervalSec: 0.15,
    waveWindupSec: 0.9,
    waveRadius: 130,
    waveHalfDeg: 60,
    lineWindupSec: 1.0,
    lineHalfWidth: 70,
    lineSpeed: 1700,
    /** 2本目までの間（姿を消している時間） */
    lineGapSec: 0.5,
    /** 三日月：正面の扇（半径・片側の角度）→ 続けて背面 */
    crescentWindupSec: 0.8,
    crescentSecondWindupSec: 0.6,
    crescentRadius: 300,
    crescentHalfDeg: 55,
  },
};

/** i 番目の変異体の定義（元の敵の定義を複製して、ボス扱い・巨大・固定HPにする） */
export function arenaBossDef(i: number): EnemyDef {
  const b = ARENA.bosses[Math.min(i, ARENA.bosses.length - 1)];
  const base = ENEMIES[b.base];
  return {
    ...base,
    name: b.name, hp: b.hp, hitRadius: b.hitRadius, scale: b.scale, contactDamage: b.contactDamage,
    speed: 0, knockbackResist: 1, boss: true, defeatYell: 200, xp: 0, vulnMul: 0.5,
  };
}

/** 雑魚は湧かない（Spawner は闘技場では回さない。念のため 0） */
const ARENA_WAVES: WaveBand[] = [
  { label: 'ARENA', from: 0, to: 9999, spawnPerSecStart: 0, spawnPerSecEnd: 0, weights: { grunt: 1 }, hpMul: 1 },
];

export const ARENA_STAGE: StageDef = {
  id: 95, name: '闘技場', nameEn: 'ARENA',
  desc: '狭い闘技場で、巨大化した変異体と一対一。予兆を見て避けろ。アーツ3つを選ぶ。永続強化は効かない。',
  enemyHpMul: 1, enemySpeedMul: 1, spawnMul: 0, bossHpMul: 1, xpMul: 1,
  extraWeights: {},
  tint: 0xffffff, color: 0xff4d6d, bgm: 'bgm_stage3',
  unlockAfter: 3,
  waves: ARENA_WAVES,
  arena: true,
  noPermanent: true,
};
