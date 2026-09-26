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

  fire(x: number, y: number, angle: number, speed: number, lifeSec: number, damage: number): void {
    this.setPosition(x, y);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = lifeSec;
    this.damage = damage;
    this.setActive(true).setVisible(true);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }
}
