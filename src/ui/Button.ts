import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { FONT_EN, COLOR_HEX } from '../utils/fonts';

export interface ButtonOpts {
  width?: number;
  height?: number;
  primary?: boolean;
  fontSize?: number;
  /** 生成直後の誤タップを防ぐ無効時間（ms）。既定は selectArmDelayMs */
  armDelayMs?: number;
}

/**
 * P3R風の矩形ボタン（斜め表現は簡略化：右下に影のオフセット）。
 * 押し始めと離した位置が同じボタンの上にある時だけ発火。生成直後は少しの間無効。
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 320;
  const h = opts.height ?? 72;
  const primary = opts.primary ?? false;
  const armAt = scene.time.now + (opts.armDelayMs ?? CONFIG.selectArmDelayMs);

  const shadow = scene.add.rectangle(6, 6, w, h, 0x000000, 0.5);
  const bg = scene.add
    .rectangle(0, 0, w, h, primary ? 0x87ceeb : 0x111a3a, 1)
    .setStrokeStyle(2, primary ? 0xffffff : 0x87ceeb, 0.9);
  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_EN,
      fontSize: `${opts.fontSize ?? 30}px`,
      color: primary ? '#060913' : COLOR_HEX.white,
      fontStyle: '700',
    })
    .setOrigin(0.5);
  const c = scene.add.container(x, y, [shadow, bg, txt]);

  let pressed = false;
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (scene.time.now < armAt) return;
    pressed = true;
    c.setScale(0.96);
  });
  bg.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    c.setScale(1);
    if (!pressed) return;
    pressed = false;
    onClick();
  });
  bg.on('pointerout', () => {
    pressed = false;
    c.setScale(1);
  });
  return c;
}
