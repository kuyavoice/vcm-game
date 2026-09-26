import { CONFIG } from '../data/config';
import { PASSIVES, baseStats, type RunStats } from '../data/passives';
import { ART_IDS, WEAPONS } from '../data/weapons';
import type { Weapon } from './WeaponSystem';
import { createWeapon } from './arts';

export type ChoiceKind = 'weapon' | 'passive' | 'heal';

export interface Choice {
  kind: ChoiceKind;
  id: string;
  title: string;
  /** 由来（使い手・仲間） */
  owner: string;
  /** NEW / Lv n → n+1 */
  tag: string;
  desc: string;
  color: number;
}

/** 宝箱の結果 */
export interface ChestResult {
  kind: 'levelup' | 'evolve' | 'yell';
  weapon?: Weapon;
  /** 進化前の名前（表示用） */
  fromName?: string;
  yell?: number;
}

/** ラン中の強化状態（初期武器・共鳴アーツ・パッシブ）と選択肢生成 */
export class UpgradeState {
  main!: Weapon;
  arts: Weapon[] = [];
  passives = new Map<string, number>();
  stats: RunStats = baseStats();
  /** 操作キャラ自身のアーツ（抽選から除外） */
  excluded = new Set<string>();
  /** キャラ特性の攻撃力倍率（recompute で damageMul に乗る） */
  traitDamageMul = 1;

  get weapons(): Weapon[] {
    return [this.main, ...this.arts];
  }

  setMain(id: string): void {
    this.main = createWeapon(id);
  }

  recompute(): RunStats {
    const s = baseStats();
    for (const [id, lv] of this.passives) PASSIVES[id].apply(s, lv);
    s.damageMul *= this.traitDamageMul;
    this.stats = s;
    return s;
  }

  buildChoices(count = 3): Choice[] {
    const pool: Choice[] = [];

    for (const w of this.weapons) {
      const d = w.nextDesc();
      if (d) {
        pool.push({
          kind: 'weapon', id: w.def.id, title: w.name, owner: w.def.owner,
          tag: `Lv ${w.level} → ${w.level + 1}`, desc: d, color: w.def.color,
        });
      }
    }
    if (this.arts.length < CONFIG.weaponSlots) {
      for (const id of ART_IDS) {
        if (this.excluded.has(id)) continue;
        if (this.arts.some((w) => w.def.id === id)) continue;
        const d = WEAPONS[id];
        pool.push({ kind: 'weapon', id, title: d.name, owner: d.owner, tag: 'NEW', desc: d.desc, color: d.color });
      }
    }

    const slotsFree = this.passives.size < CONFIG.passiveSlots;
    for (const p of Object.values(PASSIVES)) {
      const lv = this.passives.get(p.id) ?? 0;
      if (lv === 0 && !slotsFree) continue;
      if (lv >= p.maxLevel) continue;
      pool.push({
        kind: 'passive', id: p.id, title: p.name, owner: p.owner,
        tag: lv === 0 ? 'NEW' : `Lv ${lv} → ${lv + 1}`, desc: p.desc, color: p.color,
      });
    }

    // シャッフルして先頭 count 件（同じ id が重複しないようにする）
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const out = pool.slice(0, count);
    if (out.length === 0) {
      out.push({
        kind: 'heal', id: 'heal', title: '声の欠片を束ねる', owner: '—',
        tag: 'HEAL', desc: 'HPを30%回復する', color: 0xffffff,
      });
    }
    return out;
  }

  /** 選択を適用。返り値: 最大HPの増分（回復に使う）と回復割合 */
  apply(c: Choice): { maxHpDelta: number; heal: number; newWeapon?: Weapon } {
    const before = this.stats.maxHpBonus;
    let newWeapon: Weapon | undefined;
    if (c.kind === 'weapon') {
      const owned = this.weapons.find((w) => w.def.id === c.id);
      if (owned) owned.levelUp();
      else {
        newWeapon = createWeapon(c.id);
        this.arts.push(newWeapon);
      }
    } else if (c.kind === 'passive') {
      this.passives.set(c.id, (this.passives.get(c.id) ?? 0) + 1);
    } else if (c.kind === 'heal') {
      return { maxHpDelta: 0, heal: 0.3 };
    }
    this.recompute();
    return { maxHpDelta: this.stats.maxHpBonus - before, heal: 0, newWeapon };
  }

  /** 宝箱を開ける：進化できるアーツがあれば進化、なければ所持アーツ1つをLvアップ */
  openChest(): ChestResult {
    const evolvable = this.arts.filter((w) => w.canEvolve(this.passives));
    if (evolvable.length > 0) {
      const w = evolvable[Math.floor(Math.random() * evolvable.length)];
      const fromName = w.name;
      w.evolve();
      return { kind: 'evolve', weapon: w, fromName };
    }
    const upgradable = this.arts.filter((w) => !w.isMaxLevel);
    if (upgradable.length > 0) {
      const w = upgradable[Math.floor(Math.random() * upgradable.length)];
      w.levelUp();
      return { kind: 'levelup', weapon: w };
    }
    return { kind: 'yell', yell: 20 };
  }
}
