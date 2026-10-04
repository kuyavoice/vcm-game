import Phaser from 'phaser';
import { FONT_JP, COLOR_HEX } from '../utils/fonts';

/**
 * 初回プレイの案内（2026-10-04）。ルナ（チビ）の吹き出しを画面の上の方に出す。ゲームは止めない。
 * 何を・いつ言うかは GameScene が決める（updateTutorial）。ここは見た目だけ。
 * ルナの台詞の決まりごとは data/lunaLines.ts の先頭と同じ（一人称は妾、語尾は「〜じゃ」）。
 */
export class Tutorial {
  private box: Phaser.GameObjects.Container | null = null;
  private text: Phaser.GameObjects.Text | null = null;
  private panel: Phaser.GameObjects.Graphics | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private readonly panelW: number;

  constructor(private scene: Phaser.Scene, private y: number) {
    this.panelW = Math.min(560, scene.cameras.main.width - 40);
  }

  /** 吹き出しを出す（出ていれば文だけ差し替える）。ms を渡すと、その時間で消える */
  say(text: string, ms = 0): void {
    const s = this.scene;
    this.hideTimer?.remove();
    this.hideTimer = null;
    if (!this.box) {
      const W = s.cameras.main.width;
      const c = s.add.container(W / 2, this.y).setDepth(103).setScrollFactor(0).setAlpha(0);
      const hasLuna = s.textures.exists('luna_chibi');
      const lunaW = hasLuna ? 92 : 0;
      const pw = this.panelW;
      const left = -pw / 2;
      this.panel = s.add.graphics();
      c.add(this.panel);
      if (hasLuna) {
        const luna = s.add.image(left + 8, 0, 'luna_chibi').setOrigin(0, 0.5);
        luna.setScale(96 / luna.height);
        c.add(luna);
        // ちょこんと揺れる
        s.tweens.add({ targets: luna, y: -5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      this.text = s.add.text(left + lunaW + 20, 0, '', {
        fontFamily: FONT_JP, fontSize: '21px', color: COLOR_HEX.white, fontStyle: '700', lineSpacing: 6,
        wordWrap: { width: pw - lunaW - 40, useAdvancedWrap: true },
      }).setOrigin(0, 0.5);
      c.add(this.text);
      this.box = c;
      s.tweens.add({ targets: c, alpha: 1, y: this.y + 8, duration: 220, ease: 'Cubic.out' });
    }
    this.text!.setText(text);
    this.redraw();
    if (ms > 0) this.hideTimer = s.time.delayedCall(ms, () => this.hide());
  }

  hide(): void {
    this.hideTimer?.remove();
    this.hideTimer = null;
    const c = this.box;
    if (!c) return;
    this.box = null;
    this.text = null;
    this.panel = null;
    this.scene.tweens.add({ targets: c, alpha: 0, y: c.y - 10, duration: 200, onComplete: () => c.destroy() });
  }

  get visible(): boolean {
    return this.box !== null;
  }

  private redraw(): void {
    const g = this.panel;
    const t = this.text;
    if (!g || !t) return;
    const pw = this.panelW;
    const h = Math.max(96, t.height + 28);
    const left = -pw / 2;
    g.clear();
    g.fillStyle(0x060913, 0.88);
    g.fillRoundedRect(left, -h / 2, pw, h, 12);
    g.lineStyle(2, 0xffd700, 0.8);
    g.strokeRoundedRect(left, -h / 2, pw, h, 12);
  }

  destroy(): void {
    this.hideTimer?.remove();
    this.box?.destroy();
    this.box = null;
  }
}
