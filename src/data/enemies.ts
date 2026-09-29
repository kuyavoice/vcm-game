// 敵：ネミノクス。雑音級〜司祭級・城兵級・女王級はドット絵（追補パッチ⑪）。蕾とスピーカーはコード生成。
// size はスプライトのpx（画面上は spriteScale 倍）。当たり判定は hitRadius（ワールドpx）で別管理。

export type EnemyId = 'grunt' | 'hunter' | 'knight' | 'bishop' | 'king' | 'rook' | 'queen' | 'bud' | 'goldbud' | 'speaker' | 'blackknight' | 'redknight' | 'cavalry';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  /** 階級（矢印表示などの判定に使う。0=雑音級, 1=狩人級, 2=騎士級, 3=司祭級, 4=王級） */
  tier: number;
  /** スプライトサイズ（px） */
  size: number;
  /** 当たり判定の半径（ワールドpx） */
  hitRadius: number;
  hp: number;
  speed: number;
  contactDamage: number;
  xp: number;
  /** 目の色 */
  eyeColor: number;
  /** ノックバック耐性（0〜1） */
  knockbackResist: number;
  /** 遠距離型（司祭級） */
  ranged?: {
    keepDistance: number;
    intervalSec: number;
    bulletSpeed: number;
    bulletDamage: number;
    bulletLifeSec: number;
  };
  /** 王級ボス */
  boss?: boolean;
  /** 撃破時にもらえるエール（ボスのみ） */
  defeatYell?: number;
  /** 動かない破壊可能オブジェクト（壊れたスピーカー）。接触ダメージ・経験値なし、狙われない */
  isObject?: boolean;
  /**
   * スプライトシート（コード生成でなく画像を使う）。frames は横一列のコマ数。絵は右向き（左向きは反転）。
   * loop：歩きのコマ（0始まり。未指定なら全部）／fps：アニメの速さ（既定10）／poses：1コマの姿勢（名前 → コマ）。
   * outline：STAGE 2 用の淡い縁取り版を作る
   */
  sheet?: { file: string; frameWidth: number; frameHeight: number; frames: number; loop?: number[]; fps?: number; poses?: Record<string, number>; outline?: boolean };
  /** 原点Y（既定 0.75。足元基準の絵は 0.9 前後） */
  originY?: number;
  /** 画像スプライトの描画倍率（既定 spriteScale） */
  scale?: number;
  /** 直線に突っ切る（騎兵）。画面外で消える */
  charger?: boolean;
  /** 黒騎士の行動をとるボス（黒騎士・悪夢の黒騎士） */
  knight?: boolean;
  /** 専用の行動をとるボス（城兵級・女王級） */
  bossKind?: 'rook' | 'queen';
  /** 出現した場所から動かない（女王級）。画面の中に出す */
  fixed?: boolean;
  /** 女王級の蕾：時間が経つと孵る。攻撃で壊せる */
  bud?: boolean;
  /** 蕾から孵る敵（未指定なら、雑音級の群れか狩人級） */
  hatch?: EnemyId;
  /** コード生成の絵の、体の色（蕾） */
  bodyColor?: number;
  /** スパイスの帯（『貫通チャーハン』）の「受けるダメージ増加」が効く割合。未指定なら、ボスは CONFIG.vulnBossMul、雑魚は1 */
  vulnMul?: number;
  /** この敵の絵を色替えして使う（画像は読み込まず、起動時に作る） */
  recolorOf?: EnemyId;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  grunt: {
    id: 'grunt', name: '雑音級', tier: 0,
    size: 36, hitRadius: 26, hp: 10, speed: 60, contactDamage: 5, xp: 1,
    eyeColor: 0xff4d6d, knockbackResist: 0,
    sheet: { file: 'assets/sprites/enemy/grunt.png', frameWidth: 36, frameHeight: 36, frames: 4, fps: 4, outline: true },
  },
  hunter: {
    id: 'hunter', name: '狩人級', tier: 1,
    size: 36, hitRadius: 24, hp: 8, speed: 130, contactDamage: 6, xp: 1,
    eyeColor: 0xffb347, knockbackResist: 0.2,
    sheet: { file: 'assets/sprites/enemy/hunter.png', frameWidth: 36, frameHeight: 36, frames: 4, fps: 10, outline: true },
  },
  knight: {
    id: 'knight', name: '騎士級', tier: 2,
    size: 60, hitRadius: 46, hp: 80, speed: 45, contactDamage: 12, xp: 5,
    eyeColor: 0x9d4dff, knockbackResist: 1,
    // ファイル名は設定側のID（kishi）。別案 kishi_alt.png は _src_assets に保管
    sheet: { file: 'assets/sprites/enemy/kishi.png', frameWidth: 60, frameHeight: 60, frames: 4, fps: 4, outline: true },
  },
  bishop: {
    id: 'bishop', name: '司祭級', tier: 3,
    size: 48, hitRadius: 36, hp: 40, speed: 50, contactDamage: 8, xp: 4,
    eyeColor: 0x4dffb0, knockbackResist: 0.5,
    ranged: { keepDistance: 300, intervalSec: 3, bulletSpeed: 90, bulletDamage: 8, bulletLifeSec: 5 },
    // 1〜4 浮遊／5 術を放つ
    sheet: { file: 'assets/sprites/enemy/bishop.png', frameWidth: 48, frameHeight: 48, frames: 5, loop: [0, 1, 2, 3], fps: 5, poses: { cast: 4 }, outline: true },
  },
  // 旧ボス。いまはどのステージにも出ない（追補パッチ⑩ §4：「王級」の名前は黒騎士以外に使わない）
  king: {
    id: 'king', name: '王級', tier: 4,
    size: 144, hitRadius: 110, hp: 3000, speed: 55, contactDamage: 20, xp: 0,
    eyeColor: 0xffffff, knockbackResist: 1, boss: true, defeatYell: 200,
  },
  // 城兵級（STAGE 1 のボス）：「歩く要塞」。とても遅い。砲撃・岩壁・踏み鳴らし（数値は CONFIG.rook）
  rook: {
    id: 'rook', name: '城兵級', tier: 4,
    size: 144, hitRadius: 110, hp: 3000, speed: 35, contactDamage: 20, xp: 0,
    eyeColor: 0x40e0ff, knockbackResist: 1, boss: true, defeatYell: 200, bossKind: 'rook',
    // 1〜4 歩き／5 砲撃の構え／6 砲撃／7 岩壁／8 踏み鳴らし／9 被弾
    sheet: { file: 'assets/sprites/enemy/rook.png', frameWidth: 144, frameHeight: 144, frames: 9, loop: [0, 1, 2, 3], fps: 6, poses: { aim: 4, fire: 5, wall: 6, stomp: 7, hit: 8 }, outline: true },
    originY: 0.86, scale: 2,
  },
  // 女王級（STAGE 2 のボス）：「歪んだ女神」。出た場所から動かず、蕾を産み続ける（数値は CONFIG.queen）
  queen: {
    id: 'queen', name: '女王級', tier: 4,
    size: 144, hitRadius: 110, hp: 3000, speed: 0, contactDamage: 20, xp: 0,
    eyeColor: 0xffc83d, knockbackResist: 1, boss: true, defeatYell: 200, bossKind: 'queen', fixed: true,
    // 1〜4 待機／5 召喚／6 蔓の鞭／7 鱗粉／8 開花／9 被弾
    sheet: { file: 'assets/sprites/enemy/queen.png', frameWidth: 144, frameHeight: 144, frames: 9, loop: [0, 1, 2, 3], fps: 6, poses: { summon: 4, whip: 5, pollen: 6, bloom: 7, hit: 8 }, outline: true },
    originY: 0.86, scale: 2,
  },
  // 女王級の蕾：動かない。孵るまでに壊せば、配下は出ない
  bud: {
    id: 'bud', name: '蕾', tier: 0,
    size: 28, hitRadius: 24, hp: 40, speed: 0, contactDamage: 0, xp: 0,
    eyeColor: 0xffc83d, knockbackResist: 1, bud: true,
  },
  // 金の蕾（開花のあと）：孵ると司祭級。先に壊したい
  goldbud: {
    id: 'goldbud', name: '金の蕾', tier: 0,
    size: 28, hitRadius: 24, hp: 60, speed: 0, contactDamage: 0, xp: 0,
    eyeColor: 0xffffff, knockbackResist: 1, bud: true, hatch: 'bishop', bodyColor: 0x8a6a14,
  },
  blackknight: {
    id: 'blackknight', name: '黒騎士', tier: 4,
    size: 144, hitRadius: 130, hp: 3000, speed: 55, contactDamage: 20, xp: 0,
    eyeColor: 0x9d4dff, knockbackResist: 1, boss: true, defeatYell: 200, knight: true,
    sheet: { file: 'assets/sprites/enemy/knight.png', frameWidth: 144, frameHeight: 144, frames: 9 },
    originY: 0.86, scale: 2, // 画面上 288px
  },
  // 悪夢の黒騎士（EXステージ「悪夢」の最後。IDは redknight）：黒騎士の色違い。速さ1.45倍で、最初から後半の行動をとる
  redknight: {
    id: 'redknight', name: '悪夢の黒騎士', tier: 4,
    size: 144, hitRadius: 130, hp: 3000, speed: 80, contactDamage: 20, xp: 0,
    eyeColor: 0xff2244, knockbackResist: 1, boss: true, defeatYell: 300, knight: true, recolorOf: 'blackknight',
    vulnMul: 0.25, // 悪夢の最後のボスには、さらに効きにくい（ほかのボスは半分。2026-09-29 ユーザー指定）
    sheet: { file: 'assets/sprites/enemy/knight.png', frameWidth: 144, frameHeight: 144, frames: 9 },
    originY: 0.86, scale: 2,
  },
  cavalry: {
    id: 'cavalry', name: '重装騎兵', tier: 2,
    size: 96, hitRadius: 56, hp: 150, speed: 380, contactDamage: 15, xp: 2,
    eyeColor: 0x9d4dff, knockbackResist: 1, charger: true,
    sheet: { file: 'assets/sprites/enemy/cavalry.png', frameWidth: 96, frameHeight: 96, frames: 4 },
    originY: 0.8, scale: 1.5,
  },
  speaker: {
    id: 'speaker', name: '壊れたスピーカー', tier: -1,
    size: 32, hitRadius: 28, hp: 1, speed: 0, contactDamage: 0, xp: 0,
    eyeColor: 0x87ceeb, knockbackResist: 1, isObject: true,
  },
};
