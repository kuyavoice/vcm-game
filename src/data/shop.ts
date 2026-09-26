import type { RunStats } from './passives';

// エールの使い道：永続強化（控えめ・5段階）。キャラ解放の価格は characters.ts の unlockYell。

export interface PermUpgradeDef {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  /** Lv1→2… の各費用（エール） */
  costs: number[];
  apply: (s: RunStats, level: number) => void;
}

export const PERMANENT: PermUpgradeDef[] = [
  {
    id: 'hp', name: '声の器', desc: '最大HP +5%（Lvごと）', maxLevel: 5,
    costs: [30, 60, 100, 150, 220],
    apply: (s, lv) => { s.maxHpMul *= 1 + 0.05 * lv; },
  },
  {
    id: 'atk', name: '声の芯', desc: '攻撃力 +4%（Lvごと）', maxLevel: 5,
    costs: [40, 80, 130, 190, 260],
    apply: (s, lv) => { s.damageMul *= 1 + 0.04 * lv; },
  },
  {
    id: 'luck', name: '星の巡り', desc: '幸運 +10%（Lvごと）', maxLevel: 5,
    costs: [30, 60, 100, 150, 220],
    apply: (s, lv) => { s.luckMul *= 1 + 0.1 * lv; },
  },
  {
    id: 'pickup', name: '耳のよさ', desc: '声の欠片・アイテムの回収範囲 +10%（Lvごと）', maxLevel: 5,
    costs: [30, 60, 100, 150, 220],
    apply: (s, lv) => { s.pickupMul *= 1 + 0.1 * lv; },
  },
  {
    id: 'speed', name: '軽い足', desc: '移動速度 +3%（Lvごと）', maxLevel: 5,
    costs: [40, 80, 130, 190, 260],
    apply: (s, lv) => { s.speedMul *= 1 + 0.03 * lv; },
  },
];

/** 宝箱 */
export const CHEST = {
  /** 大当たり（報酬3つ）の基本確率。幸運で倍率 */
  jackpotChance: 0.08,
  jackpotRewards: 3,
};
