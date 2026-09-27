// ゲーム全体の初期値。数値調整はここと data/ 配下で行う。

export const CONFIG = {
  // 論理解像度（縦）
  width: 720,
  height: 1280,

  // 1プレイの長さ（秒）
  runSeconds: 600,

  // 同時生存の上限
  maxEnemies: 300,
  maxGems: 400,
  maxBullets: 200,
  maxEnemyBullets: 160,

  // 枠数
  weaponSlots: 6,
  passiveSlots: 6,

  // 必要経験値：Lv n → n+1
  xpToNext: (lv: number) => 5 + (lv - 1) * 10,

  // 被弾後の無敵時間（秒）
  invulnSeconds: 0.5,

  // 居眠り（ねむみがすっげぇ）
  sleepAfterSeconds: 5,
  sleepRegenPerSec: 1,

  // ドロップ
  yellDropChance: 0.05,

  // 湧き位置：画面端からこの距離だけ外側
  spawnMargin: 60,

  // 空間ハッシュのセルサイズ
  hashCell: 96,

  // スプライトの描画倍率（整数）。48pxのキャラ → 画面上96px。当たり判定は各定義の hitRadius で別管理
  spriteScale: 2,

  // 選択画面（レベルアップ等）：表示からこの時間は入力無効（ms）
  selectArmDelayMs: 300,

  // ゲーム速度（HUDのボタンで巡回切替。倍率分だけ内部更新を分割して当たり判定の精度を保つ）
  speedModes: [1, 1.5, 2, 3] as readonly number[],

  // 強化できるものが無いときのレベルアップ：選択画面を出さずにこの割合だけ回復
  levelUpFallbackHeal: 0.3,

  // 必殺『魂の共鳴』
  soul: {
    /** ゲージ満タンに必要な撃破数 */
    killsToFull: 70,
    durationSec: 10,
    artDamageMul: 1.5,
    artIntervalMul: 0.7,
  },

  // 満月イベント
  fullMoon: {
    spawnMul: 2,
    enemySpeedMul: 1.2,
    xpMul: 1.5,
  },

  // 王級ボス
  boss: {
    /** 出現時刻（秒） */
    spawnAt: 600,
    /** HP補正：基礎HP + プレイヤーLv × この値（10:00時点の火力に追いつかせる） */
    hpPerPlayerLevel: 400,
    /** 突進：予備動作→突進の秒数と速度 */
    chargeEverySec: 5,
    chargeWindupSec: 0.8,
    chargeDurationSec: 0.7,
    chargeSpeed: 620,
    /** 周囲弾 */
    ringEverySec: 3.2,
    ringCount: 14,
    ringBulletSpeed: 140,
    ringBulletDamage: 10,
    /** 行動は重み付きの乱数で選ぶ（直前と同じ行動は選ばない）。HPが phase2At を切ると激昂：別の重み＋間隔短縮＋弾数増 */
    attackEverySec: 4.5,
    phase2At: 0.5,
    weights: { charge: 3, burst: 2, stomp: 2, spiral: 2, cross: 2 } as Readonly<Record<string, number>>,
    weightsPhase2: { charge: 2, charge2: 1, burst: 2, stomp: 2, spiral: 2, cross: 2, summon: 1 } as Readonly<Record<string, number>>,
    /** 王級の突進の予兆：最初の track 秒は狙いを追い、残り lock 秒は向きを固定して帯で予告（基礎速度でも横に抜けられる長さ） */
    kingChargeTrackSec: 0.35,
    kingChargeLockSec: 0.65,
    /** 十字斬り（予告の帯 → 帯の上にダメージ。激昂後は45°回して二段目） */
    crossWindupSec: 1.0,
    crossSecondWindupSec: 0.8,
    crossHalfWidth: 48,
    crossLength: 640,
    crossDamage: 20,
    /** 狙い撃ち（扇状の連射） */
    burstBulletSpeed: 280,
    burstBulletDamage: 10,
    /** 踏み鳴らし（予告円→範囲ダメージ＋衝撃波弾） */
    stompRadius: 230,
    stompWindupSec: 1.2,
    stompDamage: 25,
    /** 回転弾 */
    spiralBulletSpeed: 170,
  },

  // 黒騎士・後半：突進の直後に出す追撃
  blackKnight: {
    /** ばらまき：足元の輪で予兆 → 自身を中心にランダムな向き・速さの弾 */
    scatterWindupSec: 0.5,
    scatterSec: 1.6,
    scatterTickSec: 0.07,
    scatterPerTick: 2,
    scatterSpeedMin: 140,
    scatterSpeedMax: 250,
    scatterDamage: 8,
    /** 二連斬：右半分（予兆）→ 左半分（予兆）。画面の左右基準 */
    cleaveRadius: 260,
    cleaveWindupSec: 1.1,
    cleaveSecondWindupSec: 0.8,
    cleaveDamage: 25,
    /** 連射（従来のマシンガン）：予告線 → 狙いを追いながら扇状3連を連射 */
    barrageWindupSec: 0.4,
    barrageBursts: 12,
    barrageTickSec: 0.12,
    barrageSpeed: 220,
    barrageDamage: 8,
    /** 必殺（スコアアタックのみ・低確率）：騎兵を横↔縦と交互に連続で呼び、直後に突進 */
    rushChance: 0.2,
    rushCooldownSec: 25,
    rushVolleys: 4,
    rushIntervalSec: 0.9,
    rushCavalry: 4,
    rushChargeDelaySec: 1.1,
    /** 追撃が終わってから次の突進まで */
    followChargeDelaySec: 4.5,
    /** 後半の接近速度倍率 */
    phase2SpeedMul: 1.15,
  },

  // 声の欠片の吸引速度（px/s）
  gemMagnetSpeed: 520,

  // 敵同士の押し合い
  separationForce: 40,

  // 情報統制システム：矢印を出す対象（騎士級以上）
  infoControlMinTier: 2,

  storageKey: 'dstage-survivors',
} as const;

export type Config = typeof CONFIG;
