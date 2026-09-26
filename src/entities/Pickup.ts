import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { PICKUPS, type PickupKind } from '../data/items';

/** 拾えるもの：声の欠片・エール・フィールドアイテム・宝箱 */
export class Pickup extends Phaser.GameObjects.Image {
  kind: PickupKind = 'xp';
  value = 1;
  magnet = false;
  bornAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'gem');
    this.setDepth(5);
  }

  drop(x: number, y: number, kind: PickupKind, value: number, now: number): void {
    this.kind = kind;
    this.value = value;
    this.magnet = false;
    this.bornAt = now;
    this.setTexture(PICKUPS[kind].texture);
    // 少し散らす
    const a = Math.random() * Math.PI * 2;
    const d = 6 + Math.random() * 14;
    this.setPosition(x + Math.cos(a) * d, y + Math.sin(a) * d);
    this.setAlpha(1).setScale(CONFIG.spriteScale);
    this.setDepth(kind === 'xp' || kind === 'yell' ? 5 : 6);
    this.setActive(true).setVisible(true);
  }

  get isItem(): boolean {
    return this.kind !== 'xp' && this.kind !== 'yell';
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }
}
