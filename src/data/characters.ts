// 操作キャラ定義。複数キャラ前提のデータ駆動。

export interface CharacterSpriteDef {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  frames: {
    idle: number[];
    walk: number[];
    hit: number[];
    sleep: number[];
  };
}

export interface CharacterDef {
  id: string;
  name: string;
  nameEn: string;
  role: string;
  /** 個人色（エフェクト・カットインの差し色） */
  color: number;
  sprite: CharacterSpriteDef;
  /** 立ち絵（キャラ選択・リザルト用）。未配置でも動く */
  standing?: string;
  hp: number;
  speed: number;
  pickup: number;
  /** 当たり判定の半径（ワールドpx。スプライトサイズとは独立） */
  hitRadius: number;
  /** キャラ特性 */
  traits: {
    /** 共鳴アーツの威力ボーナス（0.15 = +15%） */
    resonanceArtsPower: number;
  };
  startWeapon: string;
  /** 固有・常時パッシブ */
  uniquePassive?: 'info_control';
}

export const CHARACTERS: Record<string, CharacterDef> = {
  kuya: {
    id: 'kuya',
    name: '宵月 空夜',
    nameEn: 'KUYA YOIZUKI',
    role: '指揮官',
    color: 0x87ceeb,
    sprite: {
      key: 'chara_kuya',
      file: 'assets/sprites/chara/kuya.png',
      // 48×48 × 9コマ（待機2／歩き4／被弾1／居眠り2）。画面上は spriteScale 倍
      frameWidth: 48,
      frameHeight: 48,
      frames: {
        idle: [0, 1],
        walk: [2, 3, 4, 5],
        hit: [6],
        sleep: [7, 8],
      },
    },
    standing: 'assets/images/standing/kuya.webp',
    hp: 100,
    speed: 150,
    pickup: 60,
    hitRadius: 18,
    traits: { resonanceArtsPower: 0.15 },
    startWeapon: 'yoisei',
    uniquePassive: 'info_control',
  },
};

export const DEFAULT_CHARACTER = 'kuya';
