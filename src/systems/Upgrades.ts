import { CONFIG } from '../data/config';
import { PASSIVES, baseStats, type RunStats } from '../data/passives';
import { ART_IDS, WEAPONS } from '../data/weapons';
import { CHEST, PERMANENT } from '../data/shop';
import { FUSIONS, type FusionDef } from '../data/fusions';
import type { Weapon } from './WeaponSystem';
import { createWeapon } from './arts';
import { recordCodex } from '../utils/storage';

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

/** 宝箱の報酬1件 */
export interface ChestReward {
  kind: 'fusion' | 'evolve' | 'weapon' | 'passive' | 'yell';
  title: string;
  sub: string;
  color: number;
  /** 使い手（カットイン用） */
  owner?: string;
  weapon?: Weapon;
  /** 進化前の名前（表示用） */
  fromName?: string;
  /** 合体：素材2つの使い手（カットイン2枚） */
  owners?: [string, string];
  /** 合体：素材の名前 */
  fromNames?: [string, string];
  yell?: number;
  desc?: string;
}

export interface ChestResult {
  rewards: ChestReward[];
  jackpot: boolean;
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
  /** 永続強化のLv（セーブから） */
  permanent: Record<string, number> = {};
  /** 操作キャラID（合体レシピの requiredChara） */
  characterId = 'kuya';
  /** 『除外』でそのプレイ中は出さないID（weapon:xxx / passive:xxx） */
  banned = new Set<string>();
  /** 合体の素材になったアーツ（そのプレイ中はレベルアップの候補に戻さない） */
  fusedSources = new Set<string>();

  get weapons(): Weapon[] {
    return [this.main, ...this.arts];
  }

  setMain(id: string): void {
    this.main = createWeapon(id);
  }

  recompute(): RunStats {
    const s = baseStats();
    for (const [id, lv] of this.passives) PASSIVES[id].apply(s, lv);
    for (const p of PERMANENT) {
      const lv = this.permanent[p.id] ?? 0;
      if (lv > 0) p.apply(s, lv);
    }
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
        if (this.excluded.has(id) || this.banned.has(`weapon:${id}`) || this.fusedSources.has(id)) continue;
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
      if (lv === 0 && this.banned.has(`passive:${p.id}`)) continue;
      pool.push({
        kind: 'passive', id: p.id, title: p.name, owner: p.owner,
        tag: lv === 0 ? 'NEW' : `Lv ${lv} → ${lv + 1}`, desc: p.desc, color: p.color,
      });
    }

    // シャッフルして先頭 count 件
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
        recordCodex(c.id);
      }
    } else if (c.kind === 'passive') {
      this.passives.set(c.id, (this.passives.get(c.id) ?? 0) + 1);
    } else if (c.kind === 'heal') {
      return { maxHpDelta: 0, heal: 0.3 };
    }
    this.recompute();
    return { maxHpDelta: this.stats.maxHpBonus - before, heal: 0, newWeapon };
  }

  /** いま成立する合体レシピ（priority 順） */
  fusionCandidates(): FusionDef[] {
    const lv8 = (id: string) => this.arts.find((w) => w.def.id === id && w.isMaxLevel);
    return FUSIONS
      .filter((f) => (!f.requiredChara || f.requiredChara === this.characterId) && lv8(f.a) && lv8(f.b))
      .sort((x, y) => x.priority - y.priority);
  }

  /** 宝箱で何か強化できるか（合体・進化・アーツLv・パッシブLv） */
  hasChestReward(): boolean {
    if (this.fusionCandidates().length > 0) return true;
    if (this.arts.some((w) => w.canEvolve(this.passives) || !w.isMaxLevel)) return true;
    for (const [id, lv] of this.passives) if (lv < PASSIVES[id].maxLevel) return true;
    return false;
  }

  /**
   * 宝箱を開ける：進化できるアーツがあれば最優先で進化。それ以外は
   * 「所持アーツ（Lv未満）」と「所持パッシブ（Lv未満）」からランダムにLvアップ。
   * 幸運に応じて稀に大当たり（報酬3つ）。何も無ければエール。
   */
  openChest(luckMul = 1): ChestResult {
    const jackpot = Math.random() < CHEST.jackpotChance * luckMul;
    const n = jackpot ? CHEST.jackpotRewards : 1;
    const rewards: ChestReward[] = [];
    for (let i = 0; i < n; i++) {
      const r = this.drawReward();
      rewards.push(r);
    }
    this.recompute();
    return { rewards, jackpot };
  }

  private drawReward(): ChestReward {
    // ① 合体
    const fusions = this.fusionCandidates();
    if (fusions.length > 0) {
      const f = fusions[0];
      const wa = this.arts.find((w) => w.def.id === f.a)!;
      const wb = this.arts.find((w) => w.def.id === f.b)!;
      this.arts = this.arts.filter((w) => w !== wa && w !== wb);
      this.fusedSources.add(f.a);
      this.fusedSources.add(f.b);
      const fused = createWeapon(f.id);
      this.arts.push(fused);
      recordCodex(f.id);
      return {
        kind: 'fusion', title: fused.name, sub: `『${wa.name}』×『${wb.name}』`, color: fused.def.color,
        owner: fused.def.owner, weapon: fused, owners: [wa.def.owner, wb.def.owner], fromNames: [wa.name, wb.name], desc: fused.def.desc,
      };
    }
    // ② 進化
    const evolvable = this.arts.filter((w) => w.canEvolve(this.passives));
    if (evolvable.length > 0) {
      const w = evolvable[Math.floor(Math.random() * evolvable.length)];
      const fromName = w.name;
      w.evolve();
      recordCodex(`${w.def.id}:evo`);
      return { kind: 'evolve', title: w.name, sub: `『${fromName}』が進化した！`, color: 0xffd700, owner: w.def.owner, weapon: w, fromName, desc: w.def.evolution?.desc };
    }
    type Cand = { kind: 'weapon'; weapon: Weapon } | { kind: 'passive'; id: string };
    const cands: Cand[] = [];
    for (const w of this.arts) if (!w.isMaxLevel) cands.push({ kind: 'weapon', weapon: w });
    for (const [id, lv] of this.passives) if (lv < PASSIVES[id].maxLevel) cands.push({ kind: 'passive', id });
    if (cands.length === 0) {
      return { kind: 'yell', title: 'エール +20', sub: '強化できるものが無いので、代わりに', color: 0xffd700, yell: 20 };
    }
    const c = cands[Math.floor(Math.random() * cands.length)];
    if (c.kind === 'weapon') {
      c.weapon.levelUp();
      return { kind: 'weapon', title: c.weapon.name, sub: `Lv ${c.weapon.level - 1} → ${c.weapon.level}`, color: c.weapon.def.color, owner: c.weapon.def.owner, weapon: c.weapon };
    }
    const p = PASSIVES[c.id];
    const lv = (this.passives.get(c.id) ?? 0) + 1;
    this.passives.set(c.id, lv);
    return { kind: 'passive', title: p.name, sub: `Lv ${lv - 1} → ${lv}`, color: p.color, owner: p.owner };
  }
}
