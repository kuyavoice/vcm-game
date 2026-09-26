import Phaser from 'phaser';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { CONFIG } from '../data/config';

/** 蹴り飛ばされて飛んでいる状態（『物理演算バグ』） */
export interface FlyState {
  vx: number;
  vy: number;
  until: number;
  damage: number;
  hit: Set<Enemy>;
  /** 画面端で跳ね返れる残り回数（『跳弾バグ』）。0 で跳ね返らない */
  bounces?: number;
}

export class Enemy extends Phaser.GameObjects.Sprite {
  def: EnemyDef = ENEMIES.grunt;
  hp = 1;
  maxHp = 1;
  radius = 12;
  /** ノックバック速度（減衰） */
  kbx = 0;
  kby = 0;
  flashUntil = 0;
  shootTimer = 0;
  /** 1回の範囲攻撃で二重ヒットしないためのスタンプ */
  lastHitId = -1;
  /** 状態異常 */
  slowUntil = 0;
  slowMul = 1;
  stunUntil = 0;
  fly: FlyState | null = null;
  /** 常駐物（御札など）の連続ヒット防止 */
  orbitHitUntil = 0;
  /** 炎上（継続ダメージ） */
  burnUntil = 0;
  burnDps = 0;
  burnTick = 0;
  /** ボス用の行動タイマー */
  bossState = { chargeTimer: 0, ringTimer: 0, windup: 0, dashing: 0, dirX: 0, dirY: 0 };
  /** 黒騎士の状態 */
  bk = { phase: 1, invulnUntil: 0, cavalryTimer: 0, barrageTimer: 0, slashWindup: 0, slashCd: 0, barrageLeft: 0, barrageTick: 0, animLock: 0 };
  /** 直線突撃（騎兵）の速度 */
  charge: { vx: number; vy: number } | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'e_grunt_0');
    this.setOrigin(0.5, 0.75);
  }

  spawn(def: EnemyDef, x: number, y: number, hpMul: number): void {
    this.def = def;
    this.maxHp = Math.round(def.hp * hpMul);
    this.hp = this.maxHp;
    this.radius = def.hitRadius;
    this.kbx = this.kby = 0;
    this.flashUntil = 0;
    this.shootTimer = def.ranged ? def.ranged.intervalSec * (0.5 + Math.random() * 0.5) : 0;
    this.lastHitId = -1;
    this.slowUntil = 0;
    this.slowMul = 1;
    this.stunUntil = 0;
    this.fly = null;
    this.orbitHitUntil = 0;
    this.burnUntil = 0;
    this.burnDps = 0;
    this.burnTick = 0;
    this.bossState = { chargeTimer: 2, ringTimer: 1.5, windup: 0, dashing: 0, dirX: 0, dirY: 0 };
    this.bk = { phase: 1, invulnUntil: 0, cavalryTimer: 3, barrageTimer: 2, slashWindup: 0, slashCd: 0, barrageLeft: 0, barrageTick: 0, animLock: 0 };
    this.charge = null;
    this.setOrigin(0.5, def.originY ?? 0.75);
    this.setPosition(x, y);
    this.setActive(true).setVisible(true);
    // 画像スプライトの敵は等倍（絵のサイズ＝画面サイズ）、コード生成の敵は spriteScale 倍
    this.setAlpha(1).setScale(def.sheet ? 1 : CONFIG.spriteScale).clearTint();
    this.setDepth(def.isObject ? 8 : 10 + def.tier);
    this.play(`anim_e_${def.id}`, true);
    // アニメの位相をずらして群れの見た目をばらす
    this.anims.setProgress(Math.random());
  }

  /** ダメージ。返り値: 倒したら true */
  hit(dmg: number, now: number, kx = 0, ky = 0): boolean {
    this.hp -= dmg;
    this.flashUntil = now + 60;
    this.setTintFill(0xffffff);
    const resist = 1 - this.def.knockbackResist;
    this.kbx += kx * resist;
    this.kby += ky * resist;
    return this.hp <= 0;
  }

  applySlow(mul: number, sec: number, now: number): void {
    if (this.def.boss) return;
    this.slowMul = Math.min(this.slowMul < 1 && now < this.slowUntil ? this.slowMul : 1, mul);
    this.slowUntil = Math.max(this.slowUntil, now + sec * 1000);
  }

  /** 炎上：sec 秒間、毎秒 dps（重ねがけは強い方・長い方を採用） */
  burn(dps: number, sec: number, now: number): void {
    this.burnDps = Math.max(now < this.burnUntil ? this.burnDps : 0, dps);
    this.burnUntil = Math.max(this.burnUntil, now + sec * 1000);
  }

  stun(sec: number, now: number): void {
    if (this.def.boss) return;
    this.stunUntil = Math.max(this.stunUntil, now + sec * 1000);
  }

  /** 現在の移動速度倍率（鈍化・スタン） */
  speedMul(now: number): number {
    if (now < this.stunUntil) return 0;
    return now < this.slowUntil ? this.slowMul : 1;
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
    this.fly = null;
    this.anims.stop();
  }
}
