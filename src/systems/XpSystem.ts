import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import type { PickupKind } from '../data/items';
import { Pickup } from '../entities/Pickup';

/** 声の欠片・エール・フィールドアイテムのドロップ／吸引／レベル管理 */
export class XpSystem {
  level = 1;
  xp = 0;
  yell = 0;
  /** レベルアップ待ち回数（連続レベルアップ対応） */
  pendingLevelUps = 0;
  /** 経験値倍率（満月イベント） */
  xpMul = 1;
  /** ギア一斉受信：この時刻まで全吸引 */
  magnetAllUntil = 0;
  /** アイテム取得時のコールバック（GameScene が設定） */
  onItem?: (kind: PickupKind, value: number, x: number, y: number) => void;
  private oldest = 0;

  constructor(private pickups: Phaser.GameObjects.Group) {}

  get xpToNext(): number {
    return CONFIG.xpToNext(this.level);
  }

  /** 敵撃破時のドロップ。luckMul：斥候（幸運） */
  drop(x: number, y: number, value: number, now: number, luckMul = 1): void {
    if (value > 0) this.spawn(x, y, 'xp', Math.round(value * this.xpMul), now);
    if (Math.random() < CONFIG.yellDropChance * luckMul) this.spawn(x, y, 'yell', 1, now);
  }

  spawn(x: number, y: number, kind: PickupKind, value: number, now: number): void {
    let g: Pickup | null = null;
    if (this.pickups.countActive(true) >= CONFIG.maxGems) {
      // 上限超過：最古の欠片を吸収して置き直す（経験値は失わない）
      const list = this.pickups.getChildren() as Pickup[];
      for (let i = 0; i < list.length; i++) {
        const cand = list[(this.oldest + i) % list.length];
        if (cand.active && cand.kind === 'xp') {
          this.oldest = (this.oldest + i + 1) % list.length;
          if (kind === 'xp') value += cand.value;
          else this.xp += cand.value;
          g = cand;
          break;
        }
      }
      if (!g) return;
    } else {
      g = this.pickups.get(x, y) as Pickup | null;
    }
    if (!g) return;
    g.drop(x, y, kind, value, now);
  }

  /** 吸引と取得。取得した経験値量を返す */
  update(dt: number, now: number, px: number, py: number, pickupRadius: number): number {
    let gained = 0;
    const list = this.pickups.getChildren() as Pickup[];
    const r2 = pickupRadius * pickupRadius;
    const magnetAll = now < this.magnetAllUntil;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (!g.active) continue;
      const dx = px - g.x;
      const dy = py - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.magnet && (d2 <= r2 || (magnetAll && !g.isItem))) g.magnet = true;
      if (g.magnet) {
        const d = Math.sqrt(d2) || 1;
        let spd = CONFIG.gemMagnetSpeed + (pickupRadius * 2 - Math.min(d, pickupRadius * 2)) * 4;
        if (magnetAll) spd *= 2.5;
        g.x += (dx / d) * spd * dt;
        g.y += (dy / d) * spd * dt;
        if (d < 16) {
          if (g.kind === 'yell') this.yell += g.value;
          else if (g.kind === 'xp') {
            this.xp += g.value;
            gained += g.value;
          } else {
            this.onItem?.(g.kind, g.value, g.x, g.y);
          }
          g.despawn();
        }
      }
    }
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.pendingLevelUps++;
    }
    return gained;
  }

  /** ゆらゆら演出（軽量：位相のみ） */
  static bob(g: Pickup, now: number): void {
    const s = CONFIG.spriteScale;
    const k = g.isItem ? 0.12 : 0.08;
    g.setScale(s, s * (1 + Math.sin((now - g.bornAt) / 180) * k));
  }
}
