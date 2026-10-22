// 報酬の絵を全画面で見せる（タップで閉じる）。悪夢の初回クリア（EX STAGE CLEAR）と、極光の冠の解除で使う（2026-10-22 共通化）。
// 絵がまだ読み込まれていなければ、その場で読んでから出す。
import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';

export interface RewardOverlayOpts {
  /** 絵の上の見出し（英字） */
  head: string;
  /** 見出しの下の一文（任意） */
  sub?: string;
  /** まだ読んでいないときの画像のパス */
  path?: string;
  /** 閉じたあと */
  onClose?: () => void;
  /** 見出しの色（既定は金） */
  headColor?: string;
}

export function showRewardOverlay(scene: Phaser.Scene, key: string, opts: RewardOverlayOpts): void {
  const run = () => {
    if (!scene.textures.exists(key)) { opts.onClose?.(); return; }
    const cam = scene.cameras.main;
    const W = cam.width;
    const H = cam.height;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const shade = scene.add.rectangle(0, 0, W, H, 0x020308, 0.94).setOrigin(0).setDepth(100).setInteractive().setScrollFactor(0);
    const cy = H * 0.44;
    const img = scene.add.image(W / 2, cy, key).setDepth(101).setScrollFactor(0);
    const fit = Math.min((W - 24) / img.width, (H * 0.6) / img.height);
    img.setScale(fit * 0.9).setAlpha(0);
    const frame = scene.add.rectangle(W / 2, cy, img.width * fit + 8, img.height * fit + 8).setStrokeStyle(3, 0xffd700, 0.9).setDepth(101).setAlpha(0).setScrollFactor(0);
    const headY = cy - (img.height * fit) / 2 - (opts.sub ? 76 : 56);
    const head = scene.add.text(W / 2, headY, opts.head, {
      fontFamily: FONT_EN, fontSize: '44px', color: opts.headColor ?? COLOR_HEX.gold, fontStyle: '700', letterSpacing: 5, stroke: '#060913', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(101).setAlpha(0).setScrollFactor(0);
    const items: Phaser.GameObjects.GameObject[] = [shade, img, frame, head];
    if (opts.sub) {
      const sub = scene.add.text(W / 2, headY + 40, opts.sub, {
        fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(101).setAlpha(0).setScrollFactor(0);
      items.push(sub);
      scene.tweens.add({ targets: sub, alpha: 1, duration: 500, delay: 400 });
    }
    const hint = scene.add.text(W / 2, cy + (img.height * fit) / 2 + 60, 'TAP TO CONTINUE', {
      fontFamily: FONT_EN, fontSize: '24px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(101).setAlpha(0).setScrollFactor(0);
    items.push(hint);
    scene.tweens.add({ targets: img, alpha: 1, scale: fit, duration: 500, ease: 'Cubic.out' });
    scene.tweens.add({ targets: [frame, head], alpha: 1, duration: 500, delay: 200 });
    scene.tweens.add({ targets: hint, alpha: 1, duration: 300, delay: 900 });
    let ready = false;
    scene.time.delayedCall(900, () => { ready = true; });
    shade.on('pointerup', () => {
      if (!ready) return;
      ready = false;
      scene.tweens.add({ targets: items, alpha: 0, duration: 260, onComplete: () => { for (const o of items) o.destroy(); opts.onClose?.(); } });
    });
  };
  if (scene.textures.exists(key)) run();
  else if (opts.path) {
    scene.load.image(key, opts.path);
    scene.load.once(Phaser.Loader.Events.COMPLETE, run);
    scene.load.start();
  } else opts.onClose?.();
}
