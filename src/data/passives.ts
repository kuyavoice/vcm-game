// パッシブ（13種）。効果はすべて RunStats への加算で表現する。数値は初期値。

export interface RunStats {
  damageMul: number;
  intervalMul: number;
  speedMul: number;
  maxHpBonus: number;
  regenPerSec: number;
  damageTakenMul: number;
  /** 声の欠片・アイテムの回収範囲 */
  pickupMul: number;
  /** 全アーツの効果範囲（射程・斬撃範囲など） */
  areaMul: number;
  /** 幸運：レアドロップ・宝箱の出現率 */
  luckMul: number;
  /** 投射物の数の加算（`projectile` タグの武器） */
  projectileBonus: number;
  /** 効果時間の倍率（盾・鉄柵・重力場・水衣など） */
  durationMul: number;
  /** 後の先：反撃ダメージ（0 で無効） */
  counterDamage: number;
  /** 必殺ゲージの上昇倍率 */
  soulGainMul: number;
  /** 最大HP倍率（永続強化） */
  maxHpMul: number;
}

export function baseStats(): RunStats {
  return {
    damageMul: 1,
    intervalMul: 1,
    speedMul: 1,
    maxHpBonus: 0,
    regenPerSec: 0,
    damageTakenMul: 1,
    pickupMul: 1,
    areaMul: 1,
    luckMul: 1,
    projectileBonus: 0,
    durationMul: 1,
    counterDamage: 0,
    soulGainMul: 1,
    maxHpMul: 1,
  };
}

export interface PassiveDef {
  id: string;
  name: string;
  /** 由来（仲間の名前） */
  owner: string;
  desc: string;
  maxLevel: number;
  color: number;
  /** 所持Lvに応じて RunStats に加算 */
  apply: (s: RunStats, level: number) => void;
}

export const PASSIVES: Record<string, PassiveDef> = {
  patisserie: {
    id: 'patisserie', name: 'Midnight Patisserie', owner: '月惺 あめ',
    desc: 'HPが少しずつ自然回復する（Lvごとに +0.5/秒）',
    maxLevel: 5, color: 0xf0e68c,
    apply: (s, lv) => { s.regenPerSec += 0.5 * lv; },
  },
  makanai: {
    id: 'makanai', name: '衛宮亭仕込みのまかない', owner: '鈴鳴 拳士郎',
    desc: '最大HP +20（Lvごと）',
    maxLevel: 5, color: 0xff8c00,
    apply: (s, lv) => { s.maxHpBonus += 20 * lv; },
  },
  jewel: {
    id: 'jewel', name: '宝石の見立て', owner: '蜂城 美麗',
    desc: '攻撃力 +10%（Lvごと）',
    maxLevel: 5, color: 0xff69b4,
    apply: (s, lv) => { s.damageMul *= 1 + 0.1 * lv; },
  },
  gear: {
    id: 'gear', name: 'ギアの個別改修', owner: '月景 遼',
    desc: '攻撃間隔 −6%（Lvごと）',
    maxLevel: 5, color: 0x00ced1,
    apply: (s, lv) => { s.intervalMul *= Math.pow(0.94, lv); },
  },
  route: {
    id: 'route', name: '経路最適化', owner: '瀬田 奏真',
    desc: '移動速度 +8%（Lvごと）',
    maxLevel: 5, color: 0x228b22,
    apply: (s, lv) => { s.speedMul *= 1 + 0.08 * lv; },
  },
  tuning: {
    id: 'tuning', name: '声療班の調律', owner: '一色 紗理',
    desc: '受けるダメージ −8%（Lvごと）',
    maxLevel: 5, color: 0x191970,
    apply: (s, lv) => { s.damageTakenMul *= Math.pow(0.92, lv); },
  },
  poem: {
    id: 'poem', name: '詩の加護', owner: '音染 悠理',
    desc: '全アーツの効果範囲 +10%（Lvごと）',
    maxLevel: 5, color: 0xffb6c1,
    apply: (s, lv) => { s.areaMul *= 1 + 0.1 * lv; },
  },
  scout: {
    id: 'scout', name: '斥候', owner: '孤ヶ爪 ミヤコ',
    desc: 'レアアイテム・宝箱の出現率 +20%（Lvごと）',
    maxLevel: 5, color: 0x556b2f,
    apply: (s, lv) => { s.luckMul *= 1 + 0.2 * lv; },
  },
  finder: {
    id: 'finder', name: '失せ物探しの神通力', owner: '呱々崎 璦萌',
    desc: '声の欠片・アイテムの回収範囲 +25%（Lvごと）',
    maxLevel: 5, color: 0xd2b48c,
    apply: (s, lv) => { s.pickupMul *= 1 + 0.25 * lv; },
  },
  script: {
    id: 'script', name: '魔術師の台本', owner: '片桐 玄人',
    desc: '投射物（矢・弾・傘など）の数 +1（Lvごと）',
    maxLevel: 2, color: 0x008080,
    apply: (s, lv) => { s.projectileBonus += lv; },
  },
  encore: {
    id: 'encore', name: '天宮座のアンコール', owner: '天宮 澪',
    desc: '効果時間 +10%（Lvごと）。盾・鉄柵・重力場など',
    maxLevel: 5, color: 0x2f4f4f,
    apply: (s, lv) => { s.durationMul *= 1 + 0.1 * lv; },
  },
  gonosen: {
    id: 'gonosen', name: '後の先', owner: '嘉地 杏子',
    desc: '被弾すると周囲の敵に反撃する（ダメージ 20×Lv、1秒に1回）',
    maxLevel: 5, color: 0xdc143c,
    apply: (s, lv) => { s.counterDamage = 20 * lv; },
  },
  mana: {
    id: 'mana', name: '魔力の貸与', owner: '黒崎 詩音',
    desc: '必殺ゲージの上昇速度 +15%（Lvごと）',
    maxLevel: 5, color: 0xc0c0ff,
    apply: (s, lv) => { s.soulGainMul *= 1 + 0.15 * lv; },
  },
};
