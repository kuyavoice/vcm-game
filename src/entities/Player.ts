import Phaser from 'phaser';
import type { CharacterDef } from '../data/characters';
import { CONFIG } from '../data/config';

export class Player extends Phaser.GameObjects.Sprite {
  def: CharacterDef;
  hp: number;
  maxHp: number;
  /** 向き（最後に移動した方向。攻撃の基準） */
  facing = new Phaser.Math.Vector2(1, 0);
  invulnUntil = 0;
  idleFor = 0;
  sleeping = false;
  /** 居眠りを始めたとき（ボイス用） */
  onSleep?: () => void;
  moving = false;
  private hitAnimUntil = 0;
  private zz?: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Image;
  /** 『アクアシールド』：この時刻まで被弾を防ぐ */
  shieldUntil = 0;
  /** 盾が重い攻撃をあと何回耐えるか（0 になると割れる） */
  shieldHeavyLeft = 0;
  /** 盾が割れた時刻（演出・判定用） */
  shieldBrokenAt = -1;
  /** 『夢見る猫箱』：あと何回の被弾を防ぐか */
  hitShield = 0;
  private shieldFx: Phaser.GameObjects.Image;

  /** 実際に使うスプライトキー（カラーバリエーション適用後） */
  spriteKey: string;

  constructor(scene: Phaser.Scene, x: number, y: number, def: CharacterDef, spriteKey = def.sprite.key) {
    super(scene, x, y, spriteKey, def.sprite.frames.idle[0]);
    this.def = def;
    this.spriteKey = spriteKey;
    this.hp = def.hp;
    this.maxHp = def.hp;
    // 基準点：足元中央。画面上は spriteScale 倍で描画
    this.setOrigin(0.5, 1);
    this.setScale(CONFIG.spriteScale);
    this.setDepth(20);
    this.shadow = scene.add.image(x, y, 'shadow').setOrigin(0.5, 0.5).setDepth(19).setAlpha(0.6).setScale(CONFIG.spriteScale);
    this.shieldFx = scene.add.image(x, y, 'shield').setDepth(21).setScale(CONFIG.spriteScale * 1.6).setVisible(false).setAlpha(0.85);
    scene.add.existing(this);
    this.play(`${spriteKey}_idle`);
  }

  /** 移動入力（-1〜1）を受けて位置を更新 */
  move(dx: number, dy: number, dt: number, speedMul: number, now: number): void {
    const len = Math.hypot(dx, dy);
    this.moving = len > 0.05;
    if (this.moving) {
      const nx = dx / len;
      const ny = dy / len;
      const spd = this.def.speed * speedMul * Math.min(1, len);
      this.x += nx * spd * dt;
      this.y += ny * spd * dt;
      this.facing.set(nx, ny);
      this.setFlipX(nx < 0);
      this.idleFor = 0;
      if (this.sleeping) this.wake();
    } else {
      this.idleFor += dt;
      if (!this.sleeping && this.idleFor >= CONFIG.sleepAfterSeconds) this.sleep();
    }

    this.shadow.setPosition(this.x, this.y - 2);
    const shielded = now < this.shieldUntil || this.hitShield > 0;
    this.shieldFx.setVisible(shielded);
    if (shielded) {
      this.shieldFx.setPosition(this.x, this.y - this.displayHeight * 0.45).setRotation(now / 900);
      this.shieldFx.setAlpha(0.6 + Math.sin(now / 120) * 0.2);
    }

    // アニメ選択
    const k = this.spriteKey;
    if (now < this.hitAnimUntil) {
      this.play(`${k}_hit`, true);
    } else if (this.sleeping) {
      this.play(`${k}_sleep`, true);
    } else if (this.moving) {
      this.play(`${k}_walk`, true);
    } else {
      this.play(`${k}_idle`, true);
    }

    // 無敵中は点滅
    if (now < this.invulnUntil) {
      this.setAlpha(Math.floor(now / 60) % 2 === 0 ? 0.35 : 1);
    } else if (this.alpha !== 1) {
      this.setAlpha(1);
    }

    if (this.zz) this.zz.setPosition(this.x + 28, this.y - this.displayHeight - 6);
  }

  /** 被弾。返り値: 実際に受けたら true */
  /** raw：軽減前のダメージ（盾が割れるかの判定に使う） */
  takeDamage(amount: number, now: number, raw = amount): boolean {
    if (now < this.invulnUntil) return false;
    if (this.hitShield > 0) {
      this.hitShield--;
      this.invulnUntil = now + 200;
      this.shieldFx.setAlpha(1).setScale(CONFIG.spriteScale * 2.2);
      this.scene.tweens.add({ targets: this.shieldFx, scale: CONFIG.spriteScale * 1.6, alpha: 0, duration: 250 });
      return false;
    }
    if (now < this.shieldUntil) {
      // 重い攻撃を防ぐと盾が割れる（この一撃は防ぐ。直後の追い打ちを避けるため通常の被弾と同じ無敵を付ける）
      if (raw >= CONFIG.shieldHeavyDamage) {
        this.shieldHeavyLeft--;
        if (this.shieldHeavyLeft <= 0) {
          this.shieldUntil = now;
          this.shieldBrokenAt = now;
          this.invulnUntil = now + CONFIG.invulnSeconds * 1000;
          this.shieldFx.setAlpha(1).setScale(CONFIG.spriteScale * 2.4);
          this.scene.tweens.add({ targets: this.shieldFx, scale: CONFIG.spriteScale * 1.6, alpha: 0, duration: 260 });
          return false;
        }
      }
      // 盾が受け止める（短い無敵で連続ヒットのちらつきを防ぐ）
      this.invulnUntil = now + 120;
      this.shieldFx.setAlpha(1).setScale(CONFIG.spriteScale * 1.9);
      this.scene.tweens.add({ targets: this.shieldFx, scale: CONFIG.spriteScale * 1.6, duration: 150 });
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = now + CONFIG.invulnSeconds * 1000;
    this.hitAnimUntil = now + 220;
    if (this.sleeping) this.wake();
    this.idleFor = 0;
    return true;
  }

  /** 回復。キャラ特性の回復量倍率（traits.healMul）が掛かる */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount * (this.def.traits.healMul ?? 1));
  }

  private sleep(): void {
    this.sleeping = true;
    this.onSleep?.();
    this.zz = this.scene.add
      .text(this.x + 28, this.y - this.displayHeight - 6, 'zZ', {
        fontFamily: '"Oswald", sans-serif',
        fontSize: '22px',
        color: '#87CEEB',
        fontStyle: 'bold',
      })
      .setDepth(21)
      .setOrigin(0, 1);
    this.scene.tweens.add({
      targets: this.zz,
      y: '-=10',
      alpha: { from: 1, to: 0.4 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private wake(): void {
    this.sleeping = false;
    if (this.zz) {
      this.scene.tweens.killTweensOf(this.zz);
      this.zz.destroy();
      this.zz = undefined;
    }
  }
}
