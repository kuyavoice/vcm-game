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
  // レベルアップ・宝箱の画面を閉じた直後の無敵（実時間の秒。ゲーム速度に関係なく同じ長さ）。操作を取り戻すまでの間を守る
  resumeInvulnSec: 0.5,

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

  // 城兵級（追補パッチ⑪ §2）。数値は初期値
  rook: {
    /** 行動の間隔。重み付きの乱数で選ぶ（岩壁と突進は、続けて出さない） */
    attackEverySec: 4.5,
    weights: { cannon: 3, wall: 2, charge: 1, barrage: 2 } as Readonly<Record<string, number>>,
    /** 岩壁のあとは、必ず突進（2026-10-01 ユーザー指定）。壁がせり上がってから、この秒数で突進の予兆を始める */
    wallChargeDelaySec: 1.6,
    /** HPがこの割合を切ると、砲撃の着弾点が増える */
    phase2At: 0.5,
    /** 砲撃：構え → 発射 → 着弾。予告の円は構えの最初から出る */
    cannonWindupSec: 1.2,
    cannonFireAtSec: 0.75,
    cannonPoints: [3, 5] as readonly [number, number],
    cannonPointsPhase2: [5, 7] as readonly [number, number],
    cannonRadius: 70,
    cannonDamage: 18,
    /** 着弾点を散らす範囲（プレイヤーからの距離） */
    cannonSpreadMin: 110,
    cannonSpreadMax: 260,
    /** 岩壁：予告 → せり上がる → 崩れる。壁は敵もプレイヤーも通れない（攻撃は通る） */
    wallCount: [2, 3] as readonly [number, number],
    wallLength: 200,
    wallHalfWidth: 22,
    wallWindupSec: 0.8,
    wallSec: 8,
    /** 壁を置く距離（プレイヤーから）。壁どうしの間は通れる幅を残す */
    wallDistance: 170,
    /** 踏み鳴らし：プレイヤーが近いときだけ */
    stompTriggerDist: 180,
    /** 0.6 → 0.9（2026-09-30。近接の雪人が、円の外へ出られなかったため） */
    stompWindupSec: 0.9,
    stompRadius: 200,
    stompDamage: 15,
    stompCooldownSec: 4,
    /** 踏み鳴らしで吹き飛ぶ速さ（すぐ弱まる。動く距離はおよそ 速さ÷8） */
    stompKnockback: 900,
    /**
     * 突進（2026-09-30 追加）：旧ボスの突進と同じ形。最初の track 秒は狙いを追い、残り lock 秒は向きを固定して帯で予告 → ダッシュ。
     * 速さ・長さ・予兆は CONFIG.boss の値（chargeSpeed・chargeDurationSec・kingChargeTrackSec・kingChargeLockSec）を使う
     */
    /**
     * 連続砲撃（2026-09-30 追加）：城兵級からプレイヤーへ向かう直線の上に、円を順に出す → 順に着弾 → 着弾した所が燃える。
     * 1発目は城兵級から barrageStart だけ離れた所。そこから barrageStep ずつ先へ
     */
    barrageCount: 5,
    barrageCountPhase2: 7,
    barrageStart: 210,
    barrageStep: 125,
    barrageRadius: 70,
    barrageDamage: 18,
    /** 円が出てから着弾するまでと、次の円が出るまでの間隔 */
    barrageWindupSec: 1.0,
    barrageGapSec: 0.22,
    /** 燃える時間と、燃えている所のダメージ */
    barrageFireSec: 3,
    barrageFireDamage: 8,
    /** 激昂のあとは、砲撃の着弾点にも炎が残る（時間とダメージは連続砲撃の炎と同じ） */
    /** 突進で自分の岩壁を砕くと、破片が弾になって四方へ飛ぶ */
    shardCount: 8,
    shardSpeed: 210,
    shardLifeSec: 2.2,
    shardDamage: 10,
  },

  // 女王級（追補パッチ⑪ §3）。数値は初期値
  queen: {
    /** 画面の中に出す：プレイヤーからの距離と、姿を現すまでの時間（この間は当たらない・攻撃しない） */
    spawnDistance: 300,
    emergeSec: 1.5,
    /** 蔓の鞭か鱗粉を選ぶ間隔 */
    attackEverySec: 4.0,
    weights: { whip: 3, pollen: 2, burrow: 2, cage: 1 } as Readonly<Record<string, number>>,
    /** 開花のあとの重み（触手の突きが加わる） */
    weightsBloom: { whip: 2, pollen: 2, burrow: 2, thrust: 3, cage: 2 } as Readonly<Record<string, number>>,
    /** 召喚の間隔（ほかの行動とは別に数える）。開花のあとは短くなる */
    summonEverySec: 9,
    summonEverySecBloom: 6,
    /** 開花（HPがこの割合を切った瞬間）：しばらく無敵。以降は蕾が増え、行動の間隔が短くなる */
    bloomAt: 0.5,
    bloomInvulnSec: 1.5,
    /** 召喚：蕾の数・孵るまでの時間・孵る中身・同時に置ける数 */
    buds: 4,
    budsBloom: 6,
    budHatchSec: 3,
    budGrunts: 3,
    budHunterChance: 0.35,
    budRingMin: 170,
    budRingMax: 250,
    maxBuds: 12,
    /** 蔓の鞭：予告線 → 一直線に薙ぐ。届かない距離なら使わない */
    whipWindupSec: 0.8,
    whipLength: 400,
    whipHalfWidth: 20,
    whipDamage: 20,
    whipSpreadRad: 0.38,
    whipMaxDist: 480,
    /**
     * 触手の突き（2026-09-30 追加。開花のあとだけ）：プレイヤーの居る場所まで、触手を一直線に伸ばす。予兆は短い。
     * 届く長さは「プレイヤーまでの距離＋thrustOver」で、thrustMaxLength まで
     */
    thrustWindupSec: 0.45,
    thrustOver: 80,
    thrustMaxLength: 760,
    thrustHalfWidth: 18,
    thrustDamage: 20,
    /**
     * 地中の触手（2026-09-30 追加）：触手を床に刺す → プレイヤーの周りの円から突き出る。
     * 1つ目はプレイヤーの位置。残りは周り burrowSpread までに散らす
     */
    burrowCount: [3, 4] as readonly [number, number],
    burrowCountBloom: [5, 6] as readonly [number, number],
    burrowRadius: 60,
    burrowSpread: 210,
    burrowWindupSec: 0.9,
    burrowDamage: 18,
    /** 蔓の鞭が届かない距離に、この秒数いると、開花の前でも触手の突きを使う */
    thrustFarSec: 6,
    /** 開花のあとは、蕾のうちこの数が金色になる（孵ると司祭級。敵データの goldbud） */
    goldBuds: 2,
    /**
     * 茨の檻：プレイヤーの周りに茨の輪。1か所だけ開いている。
     * 予告 cageWindupSec → 輪がせり上がって通れなくなる → cageCloseSec のあと、輪の中が一斉に突き上がる
     */
    cageRadius: 190,
    cageHalfWidth: 16,
    /** 開いている所の幅（角度の半分） */
    cageGapHalfRad: 0.62,
    cageWindupSec: 0.7,
    cageCloseSec: 2.6,
    cageDamage: 22,
    /** 鱗粉：プレイヤーの周りに毒の粉。中では足が遅くなり、少しずつ削られる */
    pollenCount: [2, 3] as readonly [number, number],
    pollenRadius: 90,
    pollenSec: 6,
    pollenWindupSec: 0.7,
    pollenSlowMul: 0.6,
    pollenDps: 3,
    pollenSpread: 150,
  },

  // 赤騎士（EXステージ「悪夢」）：黒騎士との違い。予兆の長さは変えない（見て避けられることは保つ）
  redKnight: {
    /** 行動の間隔を短くし、突進を速くする倍率（移動の速さは enemies.ts の speed） */
    tempoMul: 1.45, // 1.3 → 1.45（2026-09-27 試遊の指摘で少し速く）
    /** 突進の直後が「連撃」になる確率（黒騎士は comboChance） */
    comboChance: 0.35,
    /** 二連斬が三連になる（右 → 左 → 右） */
    cleaveSwings: 3,
    /** HPがこの割合を切ると激昂：専用の技（新月／半月／漆黒の牙／漆黒の檻／闇の炎）を使い始める */
    enrageAt: 0.5,
    enrageInvulnSec: 1.2,
    /** 専用の技を使う間隔（秒）と、選ぶ重み（直前と同じ技は選ばない） */
    exEverySec: 6, // 9 → 6（2026-09-30。配信での試遊で、4分の戦闘に技が7回ほどしか出ていなかった）
    exWeights: { shingetsu: 3, hangetsu: 3, kiba: 3, ori: 2, honoo: 2 } as Readonly<Record<string, number>>,
    /**
     * 『半月』（新月の亜種。2026-09-30 ユーザー指定）：技を始めた瞬間のプレイヤーの位置に、縦の軸を引く。
     * 軸から左の全面 → 続けて右の全面、の順に範囲攻撃。軸をまたいで避ける。halfMoonMargin＝軸からこれ以上離れていれば当たらない
     */
    halfMoonWindupSec: 1.4,
    halfMoonSecondWindupSec: 1.3, // 一段目のあいだ走り続けて軸から離れても、足の遅い雪人（135）で戻れる長さ
    halfMoonDamage: 25,
    halfMoonMargin: 10,
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
    /**
     * 『闇の炎』：赤騎士を中心に、3方向へ直線の攻撃。1本目はプレイヤーを狙い、残りは flameSpreadDeg ずつ開く。
     * 通り道には炎が flameSec 秒残る（触れると flameDamage）。
     * 2026-09-30 作り直し：前は「突進の通り道が燃える」だったが、突進を避けた時点で炎からも離れているので、意味が無かった
     */
    flameLines: 3,
    flameSpreadDeg: 120,
    flameLength: 900,
    flameHalfWidth: 45,
    flameWindupSec: 1.0,
    flameStrikeDamage: 25,
    flameSec: 4,
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
