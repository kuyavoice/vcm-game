// 敵：ネミノクス。M1はコード生成テクスチャ（黒い影＋光る目＋グリッチ）。
// size はスプライトのpx（画面上は spriteScale 倍）。当たり判定は hitRadius（ワールドpx）で別管理。

export type EnemyId = 'grunt' | 'hunter' | 'knight' | 'bishop' | 'king' | 'speaker' | 'blackknight' | 'cavalry';

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
  /** 動かない破壊可能オブジェクト（壊れたスピーカー）。接触ダメージ・経験値なし、狙われない */
  isObject?: boolean;
  /** スプライトシート（コード生成でなく画像を使う）。frames は横一列のコマ数 */
  sheet?: { file: string; frameWidth: number; frameHeight: number; frames: number };
  /** 原点Y（既定 0.75。足元基準の絵は 0.9 前後） */
  originY?: number;
  /** 画像スプライトの描画倍率（既定 spriteScale） */
  scale?: number;
  /** 直線に突っ切る（騎兵）。画面外で消える */
  charger?: boolean;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  grunt: {
    id: 'grunt', name: '雑音級', tier: 0,
    size: 36, hitRadius: 26, hp: 10, speed: 60, contactDamage: 5, xp: 1,
    eyeColor: 0xff4d6d, knockbackResist: 0,
  },
  hunter: {
    id: 'hunter', name: '狩人級', tier: 1,
    size: 36, hitRadius: 24, hp: 8, speed: 130, contactDamage: 6, xp: 1,
    eyeColor: 0xffb347, knockbackResist: 0.2,
  },
  knight: {
    id: 'knight', name: '騎士級', tier: 2,
    size: 60, hitRadius: 46, hp: 80, speed: 45, contactDamage: 12, xp: 5,
    eyeColor: 0x9d4dff, knockbackResist: 1,
  },
  bishop: {
    id: 'bishop', name: '司祭級', tier: 3,
    size: 48, hitRadius: 36, hp: 40, speed: 50, contactDamage: 8, xp: 4,
    eyeColor: 0x4dffb0, knockbackResist: 0.5,
    ranged: { keepDistance: 300, intervalSec: 3, bulletSpeed: 90, bulletDamage: 8, bulletLifeSec: 5 },
  },
  king: {
    id: 'king', name: '王級', tier: 4,
    size: 144, hitRadius: 110, hp: 3000, speed: 55, contactDamage: 20, xp: 0,
    eyeColor: 0xffffff, knockbackResist: 1, boss: true,
  },
  blackknight: {
    id: 'blackknight', name: '黒騎士', tier: 4,
    size: 144, hitRadius: 130, hp: 3000, speed: 55, contactDamage: 20, xp: 0,
    eyeColor: 0x9d4dff, knockbackResist: 1, boss: true,
    sheet: { file: 'assets/sprites/enemy/knight.png', frameWidth: 144, frameHeight: 144, frames: 9 },
    originY: 0.86, scale: 2, // 画面上 288px（王級と同じ）
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
