import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import type { Enemy } from './Enemy';

export interface BulletOpts {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  texture?: string;
  /** 描画倍率（spriteScale に対する倍率） */
  scale?: number;
  /** 飛距離（px）。life と併用可 */
  range?: number;
  /** 寿命（秒） */
  life?: number;
  /** 貫通数（Infinity で無限） */
  pierce?: number;
  /** 追尾 */
  homing?: boolean;
  /** 追尾で最初に狙う敵（倒れたら最寄りの敵へ）。『星屑の裁定』で、星ごとに別の敵を狙わせる */
  target?: Enemy;
  /** 画面端で跳ね返る */
  bounce?: boolean;
  /** 命中した敵の鈍化（倍率と秒数） */
  slow?: number;
  slowSec?: number;
  knockback?: number;
  /** 回転（rad/s） */
  spin?: number;
  /** 進行方向を向く */
  rotateToVel?: boolean;
  tint?: number;
  /** ブーメラン：この距離まで飛んだら折り返してプレイヤーへ戻る（帰りも当たる） */
  boomerangDist?: number;
  /** ブーメランが戻ったあと、周囲を舞う秒数（『花傘乱舞』） */
  orbitSec?: number;
  /** 追尾の旋回速度（rad/s）。既定 6 */
  turnRate?: number;
  /** 命中時の爆発（半径・ダメージ） */
  explodeRadius?: number;
  explodeDamage?: number;
  /** 敵を倒したとき、その位置に同じ弾を生む（『焔の大狩猟』）。上限は GameScene 側 */
  spawnOnKill?: boolean;
  maxSpawned?: number;
  /** 命中した敵を炎上させる（毎秒ダメージと秒数）。当て直すと時間が戻る */
  burnDps?: number;
  burnSec?: number;
  /** 命中した雑魚を氷漬けにする秒数。凍らない敵（騎士級・ボス・騎兵）は chillMul 倍に減速 */
  freezeSec?: number;
  chillMul?: number;
}

/** 自弾（『宵星』の射撃・各アーツの弾） */
export class Bullet extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  traveled = 0;
  maxRange = Infinity;
  life = Infinity;
  damage = 8;
  pierce = 0;
  homing = false;
  target: Enemy | null = null;
  bounce = false;
  slow = 1;
  slowSec = 0;
  knockback = 60;
  spin = 0;
  rotateToVel = true;
  boomerangDist = 0;
  orbitSec = 0;
  /** ブーメランの段階：0=行き, 1=帰り, 2=周囲を舞う */
  phase = 0;
  orbitLeft = 0;
  orbitAngle = 0;
  turnRate = 6;
  explodeRadius = 0;
  explodeDamage = 0;
  spawnOnKill = false;
  maxSpawned = 0;
  burnDps = 0;
  burnSec = 0;
  freezeSec = 0;
  chillMul = 1;
  /** 生成時のオプション（spawnOnKill の複製用） */
  opts: BulletOpts | null = null;
  hit = new Set<Enemy>();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
    this.setDepth(25);
  }

  fire(o: BulletOpts): void {
    this.setTexture(o.texture ?? 'bullet');
    this.setPosition(o.x, o.y);
    this.vx = Math.cos(o.angle) * o.speed;
    this.vy = Math.sin(o.angle) * o.speed;
    this.traveled = 0;
    this.maxRange = o.range ?? Infinity;
    this.life = o.life ?? Infinity;
    this.damage = o.damage;
    this.pierce = o.pierce ?? 0;
    this.homing = o.homing ?? false;
    this.target = o.target ?? null;
    this.bounce = o.bounce ?? false;
    this.slow = o.slow ?? 1;
    this.slowSec = o.slowSec ?? 0;
    this.knockback = o.knockback ?? 60;
    this.spin = o.spin ?? 0;
    this.rotateToVel = o.rotateToVel ?? true;
    this.boomerangDist = o.boomerangDist ?? 0;
    this.orbitSec = o.orbitSec ?? 0;
    this.orbitLeft = 0;
    this.orbitAngle = 0;
    this.phase = 0;
    this.turnRate = o.turnRate ?? 6;
    this.explodeRadius = o.explodeRadius ?? 0;
    this.explodeDamage = o.explodeDamage ?? 0;
    this.spawnOnKill = o.spawnOnKill ?? false;
    this.maxSpawned = o.maxSpawned ?? 0;
    this.burnDps = o.burnDps ?? 0;
    this.burnSec = o.burnSec ?? 0;
    this.freezeSec = o.freezeSec ?? 0;
    this.chillMul = o.chillMul ?? 1;
    this.opts = o;
    this.hit.clear();
    this.setScale(CONFIG.spriteScale * (o.scale ?? 1));
    this.setRotation(this.rotateToVel ? o.angle : 0);
    if (o.tint !== undefined) this.setTint(o.tint);
    else this.clearTint();
    this.setActive(true).setVisible(true);
  }

  get hitRadius(): number {
    return this.displayWidth * 0.4;
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
    this.hit.clear();
  }
}

/** 敵弾（司祭級・王級） */
export class EnemyBullet extends Phaser.GameObjects.Image {
  vx = 0;
  vy = 0;
  life = 0;
  damage = 8;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'ebullet');
    this.setDepth(24).setScale(CONFIG.spriteScale);
  }

  fire(x: number, y: number, angle: number, speed: number, lifeSec: number, damage: number, tint?: number): void {
    this.setPosition(x, y);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = lifeSec;
    this.damage = damage;
    if (tint !== undefined) this.setTint(tint);
    else this.clearTint();
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }
}
