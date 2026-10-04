import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { FONT_EN, COLOR_HEX, COLORS } from '../utils/fonts';
import { UI } from './theme';

export interface ButtonOpts {
  width?: number;
  height?: number;
  /** 主ボタン（水色の塗り・濃い文字）。1画面に1つ */
  primary?: boolean;
  fontSize?: number;
  /** 生成直後の誤タップを防ぐ無効時間（ms）。既定は selectArmDelayMs */
  armDelayMs?: number;
}

/**
 * ボタン（2026-10-04 統一）。パネルと同じ「右上の角を落とした四角」。
 * 3種類：主（primary・水色の塗り）／副（既定・濃紺に水色の枠と左の細い帯）／切替（小さい副。オプションの ON/OFF など。見た目は副と同じ）。
 * 押すと右下へ 3px 沈んで暗くなり、離すと戻る。押し始めと離した位置が同じボタンの上にある時だけ発火。生成直後は少しの間無効。
 * コンテナの子の並びは [影, 本体, 文字, 当たり判定]。**文字は list[2]**（呼ぶ側がラベルを差し替えるときに使っている。変えない）
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
  const cut = Math.min(UI.cut, h / 2 - 2, 14);

  const pts = (ox: number, oy: number) => [
    new Phaser.Math.Vector2(-w / 2 + ox, -h / 2 + oy),
    new Phaser.Math.Vector2(w / 2 - cut + ox, -h / 2 + oy),
    new Phaser.Math.Vector2(w / 2 + ox, -h / 2 + cut + oy),
    new Phaser.Math.Vector2(w / 2 + ox, h / 2 + oy),
    new Phaser.Math.Vector2(-w / 2 + ox, h / 2 + oy),
  ];
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.5);
  shadow.fillPoints(pts(5, 5), true);
  const body = scene.add.graphics();
  const paint = (down: boolean) => {
    body.clear();
    body.fillStyle(primary ? (down ? 0x6fb3d0 : COLORS.accent) : down ? 0x0b1026 : COLORS.deepblue, 1);
    body.fillPoints(pts(0, 0), true);
    // 左の細い帯（副ボタンだけ。主ボタンは塗りそのものが色）
    if (!primary) {
      body.fillStyle(COLORS.accent, down ? 0.6 : 1);
      body.fillRect(-w / 2, -h / 2 + 6, 4, h - 12);
    }
    body.lineStyle(1, 0xffffff, primary ? 0.35 : 0.16);
    body.lineBetween(-w / 2 + 8, -h / 2 + 1, w / 2 - cut - 2, -h / 2 + 1);
    body.lineStyle(2, primary ? 0xffffff : COLORS.accent, down ? 0.5 : 0.9);
    body.strokePoints(pts(0, 0), true);
  };
  paint(false);
  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_EN,
      fontSize: `${opts.fontSize ?? 30}px`,
      color: primary ? '#060913' : COLOR_HEX.white,
      fontStyle: '700',
      letterSpacing: 1,
    })
    .setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001);
  const c = scene.add.container(x, y, [shadow, body, txt, hit]);

  let pressed = false;
  const sink = (down: boolean) => {
    body.setPosition(down ? 3 : 0, down ? 3 : 0);
    txt.setPosition(down ? 3 : 0, down ? 3 : 0);
    paint(down);
  };
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (scene.time.now < armAt) return;
    pressed = true;
    sink(true);
  });
  hit.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    sink(false);
    if (!pressed) return;
    pressed = false;
    onClick();
  });
  hit.on('pointerout', () => {
    pressed = false;
    sink(false);
  });
  return c;
}
