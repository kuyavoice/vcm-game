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
  // 設置物（鉄柵・重力場など）の同時数の上限。超えたら同じ出所の古いものから消す
  zoneCaps: { shuraba: 12, honjin: 1, chahan: 12, default: 8 } as Readonly<Record<string, number>>,
  /** 『貫通チャーハン』の「受けるダメージ増加」が、ボスに効く割合（半分） */
  vulnBossMul: 0.5,
  maxZones: 40,
  // 『満天の裁定』が1回に狙う敵の上限（弾の上限 maxBullets を他の武器と分け合うため）
  hoshikuzuMaxTargets: 24,

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

  // 『アクアシールド』：この値以上の攻撃（軽減前の値）を防ぐと盾が割れる。雑魚の接触・弾では割れない
  shieldHeavyDamage: 20,

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

  // 赤騎士（EXステージ「悪夢」）：黒騎士との違い。予兆の長さは変えない（見て避けられることは保つ）
  redKnight: {
    /** 行動の間隔を短くし、突進を速くする倍率（移動の速さは enemies.ts の speed） */
    tempoMul: 1.45, // 1.3 → 1.45（2026-09-27 試遊の指摘で少し速く）
    /** 突進の直後が「連撃」になる確率（黒騎士は comboChance） */
    comboChance: 0.35,
    /** 二連斬が三連になる（右 → 左 → 右） */
    cleaveSwings: 3,
    /** HPがこの割合を切ると激昂：専用の技（新月／漆黒の牙／漆黒の檻／闇の炎）を使い始める */
    enrageAt: 0.5,
    enrageInvulnSec: 1.2,
    /** 専用の技を使う間隔（秒）と、選ぶ重み（直前と同じ技は選ばない） */
    exEverySec: 9,
    exWeights: { shingetsu: 3, kiba: 3, ori: 2, honoo: 2 } as Readonly<Record<string, number>>,
    /** 『新月』：赤騎士の周りの円の中だけ安全な広範囲 → 直後に足元の円。足の遅いキャラでも間に合う長さ */
    moonSafeRadius: 360,
    moonOuterRadius: 1100,
    moonWindupSec: 2.0,
    moonInnerRadius: 380,
    moonInnerWindupSec: 1.6,
    moonDamage: 25,
    /** 『漆黒の牙』：プレイヤーの位置へ飛び込む。着地で範囲ダメージ＋周囲に弾 */
    fangRadius: 140,
    fangWindupSec: 1.6,
    fangDamage: 25,
    fangBullets: 12,
    fangBulletSpeed: 200,
    fangBulletDamage: 10,
    /** 『漆黒の檻』：騎兵が横と縦に同時に走る。[横の列数, 縦の列数] を波ごとに */
    cageWaves: [[3, 2], [2, 1]] as readonly (readonly number[])[],
    cageLeadSec: 1.2,
    cageWaveGapSec: 1.8,
    /** 『闇の炎』：突進の通り道が燃える */
    flameHalfWidth: 60,
    flameSec: 3,
    flameDamage: 10,
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
    /**
     * 二連斬：黒騎士を頂点、プレイヤーの少し先（cleaveBeyond）を底辺の中心にした三角形を、中心軸で右半分・左半分に割って順に斬る。
     * 軸は突進直後のプレイヤー位置で固定。軸の反対側へ少しずれれば避けられる（cleaveAxisMargin）
     */
    cleaveBeyond: 120,
    cleaveMinLen: 300,
    cleaveMaxLen: 560,
    /** 底辺の半分の幅（三角形の広がり） */
    cleaveHalfWidth: 210,
    /** 軸からこの距離だけ反対側へ出れば当たらない */
    cleaveAxisMargin: 10,
    cleaveWindupSec: 0.9,
    cleaveSecondWindupSec: 0.7,
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
    /** 斬撃音は当たる瞬間よりこの秒数だけ早く鳴らし始める（素材の音の山が約0.45秒後にあるため） */
    slashSeLeadSec: 0.35,
    /** 連撃（後半・低確率）：突進 → すぐ斬撃（短い予兆）→ 連射かばらまきのどちらか */
    comboChance: 0.2,
    comboSlashWindupSec: 0.45,
    comboSlashRadius: 200,
    comboSlashArcDeg: 150,
    comboSlashDamage: 25,
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
