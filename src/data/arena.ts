// 闘技場（アリーナ）：狭い円形の場で、巨大化した「変異体」と1対1（2026-10-20 ユーザー案。まず①雑音級だけで手触りを確認する段階）。
// FF14 風の予兆攻撃：予兆（systems/Telegraph.ts）が満ちた瞬間に、その中にいれば大ダメージ。アーツは自由（ボスラッシュと同じ準備画面）。
// 数値はここだけ直せばよい。
import { ENEMIES, type EnemyDef, type EnemyId } from './enemies';
import type { StageDef } from './stages';
import type { WaveBand } from './waves';

/** 変異体の1体ぶん。native＝既存のボスの行動をそのまま使う（城兵級・女王級・黒騎士。闘技場向けの追加は GameScene 側で stage.arena を見て足す）。hpMul は (3000 + 400×Lv40) に掛ける */
export interface ArenaBossEntry { base: EnemyId; kind: string; name: string; hp: number; scale: number; hitRadius: number; contactDamage: number; native?: boolean; hpMul?: number }

export const ARENA = {
  /** 闘技場の半径（px）。縦 1280 の画面に収まる大きさ */
  radius: 560,
  /** 予兆を踏んだときのダメージ（ユーザー指定「ペナルティは大ダメージ」。ステージの倍率は掛からない） */
  telegraphDamage: 40,
  /** 最初から付くサポート（ユーザー指定：予兆を避けるには移動速度と自然回復がほぼ必須） */
  defaultSupports: ['route', 'patisserie'],
  /** 床のアーツ（チャーハンの帯・柵など）の濃さ。予兆と重なって見づらくならないように薄くする */
  zoneAlpha: 0.4,
  /** 闘技場だけ：必殺ゲージが時間でも溜まる（この秒数で満タン。撃破分は従来どおり足す。2026-10-20 ユーザー案） */
  specialChargeSec: 45,
  /** 最初の敵が出るまで・倒してから次が出るまでの秒数 */
  firstDelaySec: 2.5,
  gapSec: 4,
  /** 変異体の一覧（出る順）。base の絵を scale 倍にして使う。hp は固定（Lv40・アーツ Lv8 を想定） */
  bosses: [
    // HP は 2026-10-20 の試遊（雪人・大剣構成で8体を 3:14、①〜④はほぼ被弾なし）を受けて引き上げ
    { base: 'grunt' as EnemyId, kind: 'grunt', name: '変異体・雑音級', hp: 16000, scale: 8, hitRadius: 100, contactDamage: 10 },
    { base: 'hunter' as EnemyId, kind: 'hunter', name: '変異体・狩人級', hp: 15000, scale: 8, hitRadius: 95, contactDamage: 10 },
    { base: 'knight' as EnemyId, kind: 'knight', name: '変異体・騎士級', hp: 20000, scale: 5, hitRadius: 110, contactDamage: 14 },
    { base: 'bishop' as EnemyId, kind: 'bishop', name: '変異体・司祭級', hp: 16000, scale: 6, hitRadius: 100, contactDamage: 10 },
    // ⑤⑥⑦は既存のボスをそのまま（最初から後半の行動）。闘技場向けの追加：城兵級＝岩の破片が倍・壁が崩れるときも破片／女王級＝横断するツタの壁／黒騎士＝速く、悪夢の黒騎士の専用技も使う
    { base: 'rook' as EnemyId, kind: 'rook', name: '城兵級', hp: 0, scale: 2, hitRadius: 110, contactDamage: 20, native: true, hpMul: 0.6 },
    { base: 'queen' as EnemyId, kind: 'queen', name: '女王級', hp: 0, scale: 2, hitRadius: 110, contactDamage: 20, native: true, hpMul: 0.9 },
    { base: 'blackknight' as EnemyId, kind: 'blackknight', name: '黒騎士', hp: 0, scale: 2, hitRadius: 130, contactDamage: 20, native: true, hpMul: 0.9 },
    { base: 'redknight' as EnemyId, kind: 'redknight', name: '悪夢の黒騎士・変異体', hp: 18000, scale: 2, hitRadius: 130, contactDamage: 20 },
  ] as ArenaBossEntry[],
  /** ①変異体・雑音級：突進／飛び跳ね3連／全体ばらまき */
  grunt: {
    walkSpeed: 90,
    keepDistance: 140,
    /** 出現してから最初の行動までと、行動のあとの間 */
    firstActDelaySec: 1.5,
    idleSec: 0.9,
    weights: { charge: 3, jump: 3, scatter: 2, stomp: 2 } as Readonly<Record<string, number>>,
    /** 踏み鳴らし：自分の周りの円（近づきすぎを罰する） */
    stompWindupSec: 0.75,
    stompRadius: 270,
    /** 激昂：飛び跳ねが5連、突進は狙い直して2本目 */
    jumpCountEnraged: 5,
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
    firstActDelaySec: 1.5,
    idleSec: 0.8,
    weights: { vanish: 3, crescent: 3, wave: 2 } as Readonly<Record<string, number>>,
    weightsEnraged: { vanish: 3, crescent: 2, wave: 4 } as Readonly<Record<string, number>>,
    /** 激昂：姿を消している時間が短い */
    lineGapEnragedSec: 0.25,
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
  /** ③変異体・騎士級（2026-10-20 ユーザー案）：足元の輪がバームクーヘンのように段階的に広がる／近〜中距離へランスの突き */
  knight: {
    walkSpeed: 70,
    keepDistance: 150,
    firstActDelaySec: 1.5,
    idleSec: 1.0,
    weights: { baum: 3, lance: 3, sweep: 2 } as Readonly<Record<string, number>>,
    /** 薙ぎ払い：正面の半円 → 背面の半円 */
    sweepWindupSec: 0.9,
    sweepSecondWindupSec: 0.6,
    sweepRadius: 340,
    sweepHalfDeg: 90,
    /** 激昂：ランスは3本（狙い直し） */
    lanceCountEnraged: 3,
    /** バームクーヘン：内側の円 → 外側の輪の順に、段階的に発動（外へ逃げるか、発動済みの内側へ入るかの読み合い）。激昂で1段増える */
    baumWindupSec: 0.9,
    baumGapSec: 0.45,
    baumRadii: [150, 290, 430],
    baumRadiiEnraged: [150, 290, 430, 570],
    /** ランス：騎士級からプレイヤーへ向けた細長い帯 → 突き。激昂では狙い直して2本目 */
    lanceWindupSec: 0.7,
    lanceLength: 390,
    lanceHalfWidth: 55,
    lanceSecondWindupSec: 0.5,
  },
  /** ④変異体・司祭級（2026-10-20 ユーザー案）：本体の左右に影（砲台）を作って弾を連射／闘技場のランダムな位置に小円の範囲攻撃を散らす */
  bishop: {
    walkSpeed: 80,
    keepDistance: 260,
    firstActDelaySec: 1.5,
    idleSec: 0.9,
    weights: { shadows: 3, rain: 3, beam: 2 } as Readonly<Record<string, number>>,
    /** 光線：自分からプレイヤーを通って闘技場の端まで。激昂では90°回して2本目 */
    beamWindupSec: 1.0,
    beamLength: 1300,
    beamHalfWidth: 60,
    beamSecondWindupSec: 0.5,
    /** 影：左右 shadowOffset の位置に出る。倒せる（HP）。寿命が来ると消える。プレイヤーへ3連の扇で連射 */
    shadowOffset: 190,
    shadowHp: 600,
    shadowLifeSec: 6,
    shadowIntervalSec: 0.5,
    shadowIntervalEnragedSec: 0.32,
    shadowBulletSpeed: 260,
    shadowBulletDamage: 10,
    shadowFanSpread: 0.2,
    /** 本体が影を出している間（立ち止まる時間） */
    shadowsCastSec: 1.2,
    /** 小円の散布：ランダムな位置に小さな円の予兆を次々と */
    rainCount: 10,
    rainCountEnraged: 16,
    rainIntervalSec: 0.12,
    rainWindupSec: 0.8,
    rainRadius: 90,
  },
  /** ⑧悪夢の黒騎士・変異体（2026-10-20 ユーザー案）：自分を始点に扇状にどこまでも広がる斬撃／突進／放射状の3本の線 */
  redknight: {
    walkSpeed: 110,
    keepDistance: 170,
    firstActDelaySec: 2.5,
    idleSec: 1.3,
    weights: { fan: 3, charge: 2, triple: 2 } as Readonly<Record<string, number>>,
    /** 扇：闘技場の端まで届く（長さは半径より長い）。激昂では向きを変えて2回目 */
    fanWindupSec: 1.1,
    fanHalfDeg: 38,
    fanLength: 1400,
    fanSecondWindupSec: 0.7,
    fanSecondTurnDeg: 100,
    /** 突進（雑音級より速く長い） */
    chargeWindupSec: 0.8,
    chargeLength: 820,
    chargeHalfWidth: 90,
    chargeDurationSec: 0.55,
    chargeSpeed: 1500,
    /** 放射：自分を中心に等間隔の線。激昂で4本 */
    tripleWindupSec: 1.0,
    tripleLength: 1300,
    tripleHalfWidth: 60,
    tripleLines: 3,
    tripleLinesEnraged: 4,
  },
  /** ⑤城兵級（既存の行動）：岩の破片の倍率・壁が時間で崩れるときにも破片・砲撃の着弾点が倍・行動の間隔（tempoMul）・踏み鳴らしの衝撃輪（自分の周り。stompEverySec ごと）。2026-10-21 試遊で唯一被弾なしだったため */
  rook: { shardMul: 2, expireShards: true, cannonPointsMul: 2, tempoMul: 0.8, stompEverySec: 6, stompWindupSec: 0.8, stompRadius: 320 },
  /** ⑥女王級（既存の行動）：一定間隔で、プレイヤーの位置を通って闘技場を横断するツタの壁（通れない）。縦横交互で、2回に1回は十字。行動と召喚の間隔は tempoMul。2026-10-21「弱すぎる」で強化 */
  queen: { vineEverySec: 5, vineWindupSec: 1.2, vineHalf: 30, vineSec: 7, tempoMul: 0.65 },
  /** ⑦黒騎士（既存の行動）：速く、行動の間隔も短く。悪夢の黒騎士の専用技（新月／半月／漆黒の牙／漆黒の檻／闇の炎）も最初から使う */
  blackknight: { speedMul: 1.4, tempoMul: 1.3 },
};

/** 司祭級の影（砲台）の定義。小さく・倒せる・触れない */
export function arenaShadowDef(): EnemyDef {
  const base = ENEMIES.bishop;
  return { ...base, name: '影', hp: ARENA.bishop.shadowHp, hitRadius: 50, scale: 3, contactDamage: 0, speed: 0, knockbackResist: 1, xp: 0, boss: false, ranged: undefined };
}

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
