import Phaser from 'phaser';
import { computeStats, type ArtStats, type WeaponDef } from '../data/weapons';
import type { RunStats } from '../data/passives';
import type { Bullet, BulletOpts } from '../entities/Bullet';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { SpatialHash } from './SpatialHash';

/** 地面に置く効果範囲（鉄柵・重力場） */
export interface ZoneOpts {
  x: number;
  y: number;
  radius: number;
  duration: number;
  /** 毎秒ダメージ */
  dps: number;
  /** 鈍化倍率（1でなし） */
  slow: number;
  /** 足止め */
  stun: boolean;
  color: number;
  shape: 'circle' | 'fence';
}

/** 武器から見た戦場の情報・操作 */
export interface BattleContext {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.GameObjects.Group;
  hash: SpatialHash<Enemy>;
  stats: RunStats;
  now: number;
  /** アーツ用ダメージ倍率（キャラ特性＋必殺） */
  artDamageMul: number;
  /** アーツ用発動間隔倍率（必殺） */
  artIntervalMul: number;
  /** 操作キャラ自身のアーツ（『物語の具現化』の抽選から除外） */
  excludedArts: Set<string>;
  /** 操作キャラID（合体レシピの requiredChara 判定など） */
  characterId: string;
  /** melee タグの武器の威力倍率（雪人の特性） */
  meleeMul: number;
  /** 一時的な攻撃力倍率（完全看破の回避後など） */
  bonusDamageMul: number;
  damage: (e: Enemy, dmg: number, kx: number, ky: number) => void;
  /** 最寄りの敵（オブジェクトは含まない） */
  nearestEnemy: (x: number, y: number, maxDist: number) => Enemy | null;
  /** 円内の敵（当たり半径込み）。out に追加して返す */
  enemiesInCircle: (x: number, y: number, r: number, out: Enemy[]) => Enemy[];
  /** 画面内の敵（オブジェクト除く） */
  onScreenEnemies: () => Enemy[];
  fireBullet: (o: BulletOpts) => Bullet | null;
  addZone: (z: ZoneOpts) => void;
  /** 敵を蹴り飛ばす */
  kick: (e: Enemy, angle: number, speed: number, durationSec: number, damage: number) => void;
  /** 演出 */
  fx: {
    slash: (x: number, y: number, radius: number, color: number, angle: number, arcDeg: number) => void;
    ring: (x: number, y: number, radius: number, color: number, width?: number) => void;
    cross: (x: number, y: number, size: number, color: number) => void;
    line: (x1: number, y1: number, x2: number, y2: number, width: number, color: number) => void;
    text: (x: number, y: number, text: string, color: string) => void;
  };
}

/** 各アーツの挙動 */
export interface ArtBehavior {
  /** 1回の発動 */
  fire: (ctx: BattleContext, s: ArtStats, w: Weapon) => void;
  /** 常駐物の更新（御札・盾など） */
  update?: (dt: number, ctx: BattleContext, s: ArtStats, w: Weapon) => void;
  /** プレイヤー被弾時（『雪月風花』の反撃など） */
  onPlayerHit?: (ctx: BattleContext, s: ArtStats, w: Weapon) => void;
  /** 『物語の具現化』で再現可能か（常駐型は不可） */
  mimicable: boolean;
}

/** 所持している武器1つ */
export class Weapon {
  level = 1;
  evolved = false;
  stats: ArtStats;
  timer: number;
  /** 挙動側が自由に使う状態 */
  state: Record<string, unknown> = {};

  constructor(public def: WeaponDef, public behavior: ArtBehavior) {
    this.stats = computeStats(def, 1, false);
    this.timer = Math.min(0.6, this.stats.intervalSec * 0.5);
  }

  get name(): string {
    return this.evolved && this.def.evolution ? this.def.evolution.name : this.def.name;
  }

  get isMaxLevel(): boolean {
    return this.level >= this.def.maxLevel;
  }

  nextDesc(): string | null {
    if (this.isMaxLevel) return null;
    return this.def.levels[this.level - 1].desc;
  }

  levelUp(): void {
    if (this.isMaxLevel) return;
    this.level++;
    this.stats = computeStats(this.def, this.level, this.evolved);
  }

  /** 進化条件：Lv最大＋対応パッシブ所持 */
  canEvolve(passives: Map<string, number>): boolean {
    return !!this.def.evolution && !this.evolved && this.isMaxLevel && passives.has(this.def.evolution.passiveId);
  }

  evolve(): void {
    if (!this.def.evolution) return;
    this.evolved = true;
    this.stats = computeStats(this.def, this.level, true);
  }

  update(dt: number, ctx: BattleContext): void {
    this.behavior.update?.(dt, ctx, this.stats, this);
    this.timer -= dt;
    if (this.timer > 0) return;
    const mul = this.def.kind === 'art' ? ctx.stats.intervalMul * ctx.artIntervalMul : ctx.stats.intervalMul;
    this.timer = this.stats.intervalSec * mul;
    this.behavior.fire(ctx, this.stats, this);
  }
}
