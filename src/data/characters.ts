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

export type UniquePassiveId = 'info_control' | 'cure_drop' | 'kanpa' | 'precision';
export type SpecialId = 'soul_connect' | 'aqua_lament' | 'setsugekka_ult' | 'angelic_rumble';

export interface CharacterDef {
  id: string;
  name: string;
  nameEn: string;
  role: string;
  /** 選択画面の一言 */
  desc: string;
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
    /** melee タグの武器の威力倍率 */
    meleePower: number;
    /** 攻撃力倍率（全体） */
    damageMul: number;
    /** 最大HP倍率 */
    maxHpMul: number;
    /** 回復アイテムの回復量倍率 */
    healItemMul: number;
    /** 表示用の特性名と説明 */
    name: string;
    desc: string;
  };
  startWeapon: string;
  /** 固有・常時パッシブ */
  uniquePassive: { id: UniquePassiveId; name: string; desc: string };
  /** 必殺 */
  special: { id: SpecialId; name: string; shortName: string; desc: string };
  /** 自分の共鳴アーツは借りられない（レベルアップ・宝箱・『物語の具現化』の抽選から除外） */
  excludedArts: string[];
  /** ノックバック無効（現状プレイヤーにノックバックは無いので表示のみ） */
  knockbackImmune?: boolean;
  /** 解放に必要なエール（0 = 最初から使える）。価格順：瑞穂 → 雪人 → 律花 */
  unlockYell: number;
  /** ボイスのキー接頭辞（vo_{id}_start 等） */
  voicePrefix: string;
}

const SPRITE = (id: string): CharacterSpriteDef => ({
  key: `chara_${id}`,
  file: `assets/sprites/chara/${id}.png`,
  // 48×48 × 9コマ（待機2／歩き4／被弾1／居眠り2）。画面上は spriteScale 倍
  frameWidth: 48,
  frameHeight: 48,
  frames: { idle: [0, 1], walk: [2, 3, 4, 5], hit: [6], sleep: [7, 8] },
});

export const CHARACTERS: Record<string, CharacterDef> = {
  kuya: {
    id: 'kuya',
    name: '宵月 空夜',
    nameEn: 'KUYA YOIZUKI',
    role: '指揮官',
    desc: '本人の火力は控えめ。仲間のアーツを強くする。',
    color: 0x87ceeb,
    sprite: SPRITE('kuya'),
    standing: 'assets/images/standing/kuya.webp',
    hp: 100,
    speed: 150,
    pickup: 60,
    hitRadius: 18,
    traits: { resonanceArtsPower: 0.15, meleePower: 1, damageMul: 1, maxHpMul: 1, healItemMul: 1, name: '指揮官', desc: '共鳴アーツの威力 +15%' },
    startWeapon: 'yoisei',
    uniquePassive: { id: 'info_control', name: '情報統制システム', desc: '画面外の強敵（騎士級以上）の方向を矢印で表示' },
    special: { id: 'soul_connect', name: '魂の共鳴', shortName: '共鳴', desc: '10秒間、共鳴アーツの威力×1.5・発動間隔−30%' },
    excludedArts: [],
    unlockYell: 0,
    voicePrefix: 'kuya',
  },
  mizuho: {
    id: 'mizuho',
    name: '月怜 瑞穂',
    nameEn: 'MIZUHO TSUKISATO',
    role: '防御・回復型',
    desc: '初心者向け。回復が得意で、水流が身を守る。',
    color: 0x87cefa,
    sprite: SPRITE('mizuho'),
    standing: 'assets/images/standing/mizuho.webp',
    hp: 110,
    speed: 150,
    pickup: 60,
    hitRadius: 18,
    traits: { resonanceArtsPower: 0, meleePower: 1, damageMul: 1, maxHpMul: 1, healItemMul: 1.5, name: '前衛衛生兵', desc: '回復アイテムの回復量 +50%' },
    startWeapon: 'reisuisen',
    uniquePassive: { id: 'cure_drop', name: '慈愛の雫', desc: '20秒ごとにHP+10' },
    special: { id: 'aqua_lament', name: '流麗なる水衣', shortName: '水衣', desc: '10秒間、2本の水流が周囲の敵を迎撃。被ダメージ−70%' },
    excludedArts: ['aqua'],
    unlockYell: 300,
    voicePrefix: 'mizuho',
  },
  yukihito: {
    id: 'yukihito',
    name: '狐森 雪人',
    nameEn: 'YUKIHITO KOMORI',
    role: '近接重量型',
    desc: '大剣の薙ぎ払いで群れを押し返す。硬いが少し遅い。',
    color: 0xe8f4ff,
    sprite: SPRITE('yukihito'),
    standing: 'assets/images/standing/yukihito.webp',
    hp: 130,
    speed: 135,
    pickup: 60,
    hitRadius: 18,
    traits: { resonanceArtsPower: 0, meleePower: 1.2, damageMul: 1, maxHpMul: 1, healItemMul: 1, name: 'トライスターの剣', desc: '近接武器の威力 +20%' },
    startWeapon: 'greatsword',
    uniquePassive: { id: 'kanpa', name: '完全看破', desc: '20%の確率で攻撃を回避。回避後1秒間、攻撃力+30%' },
    special: { id: 'setsugekka_ult', name: '乱れ雪月花', shortName: '雪月花', desc: '3秒間、画面内の敵に斬撃が計30回閃く' },
    excludedArts: ['setsugekka'],
    knockbackImmune: true,
    unlockYell: 600,
    voicePrefix: 'yukihito',
  },
  ritsuka: {
    id: 'ritsuka',
    name: '寿 律花',
    nameEn: 'RITSUKA KOTOBUKI',
    role: '高火力型',
    desc: '上級者向け。攻撃に全振り。HPは低い。',
    color: 0xff4500,
    sprite: SPRITE('ritsuka'),
    standing: 'assets/images/standing/ritsuka.webp',
    hp: 100,
    speed: 150,
    pickup: 60,
    hitRadius: 18,
    traits: { resonanceArtsPower: 0, meleePower: 1, damageMul: 1.3, maxHpMul: 0.7, healItemMul: 1, name: '極振りステッキ', desc: '攻撃力 +30%、最大HP −30%' },
    startWeapon: 'flamehound',
    uniquePassive: { id: 'precision', name: '精密制御', desc: '投射物すべてにゆるい追尾がつく' },
    special: { id: 'angelic_rumble', name: 'エンジェリック・ランブル', shortName: 'ランブル', desc: '画面内の全ての敵にダメージ80＋炎上（5秒）' },
    excludedArts: ['guren'],
    unlockYell: 1000,
    voicePrefix: 'ritsuka',
  },
};

export const CHARACTER_ORDER = ['kuya', 'mizuho', 'yukihito', 'ritsuka'];
export const DEFAULT_CHARACTER = 'kuya';
