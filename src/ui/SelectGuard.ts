import Phaser from 'phaser';
import { CONFIG } from '../data/config';

/**
 * 選択画面の誤タップ対策（仕様 §2「入力の注意」）。
 * - 表示後、いったん全ての指（マウスボタン）が離れるまで入力を受け付けない
 * - さらに表示から selectArmDelayMs は無効
 * - 「押し始め」と「離した位置」が同じ対象の上にある時だけ決定
 */
export class SelectGuard {
  /** 表示してからの経過時間（ms）。シーンの時計は、開いた瞬間には前回の値のままなので使わない */
  private elapsed = 0;
  private released = false;
  private downOn: object | null = null;
  private done = false;

  constructor(private scene: Phaser.Scene) {
    const tick = (_time: number, delta: number) => { this.elapsed += delta; };
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    // 表示時点で押されている指が全て離れるのを待つ
    this.released = !this.anyPointerDown();
    scene.input.on('pointerup', this.onAnyUp, this);
    scene.input.on('pointerupoutside', this.onAnyUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerup', this.onAnyUp, this);
      scene.input.off('pointerupoutside', this.onAnyUp, this);
      scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
    });
  }

  private anyPointerDown(): boolean {
    return this.scene.input.manager.pointers.some((p) => p.isDown);
  }

  private onAnyUp(): void {
    if (!this.anyPointerDown()) this.released = true;
    // 対象外で離した → 押し始めを無効化（pointerup のGameObjectハンドラは先に呼ばれる）
    this.downOn = null;
  }

  /** 入力を受け付けられる状態か */
  get armed(): boolean {
    return !this.done && this.released && this.elapsed >= CONFIG.selectArmDelayMs;
  }

  /** 対象の上で押し始めた */
  press(target: object): void {
    if (this.armed) this.downOn = target;
  }

  /** 対象の上で離した。決定なら true（一度きり） */
  release(target: object): boolean {
    const ok = this.armed && this.downOn === target;
    this.downOn = null;
    if (ok) this.done = true;
    return ok;
  }

  /** キー入力など、押下/離脱の対応が不要な決定 */
  confirm(): boolean {
    if (!this.armed) return false;
    this.done = true;
    return true;
  }
}
