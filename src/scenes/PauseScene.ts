import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';

/** ポーズ（Esc／ボタン／タブ非表示・フォーカス喪失で自動） */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    this.add.rectangle(0, 0, W, H, 0x060913, 0.8).setOrigin(0);
    this.add.text(W / 2, H * 0.38, 'PAUSED', {
      fontFamily: FONT_EN, fontSize: '72px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5);

    const resume = () => {
      this.scene.stop();
      this.scene.resume('Game');
    };
    makeButton(this, W / 2, H * 0.50, 'RESUME', resume, { primary: true });
    makeButton(this, W / 2, H * 0.50 + 96, 'STAGE SELECT', () => {
      this.scene.stop('Game');
      this.scene.stop();
      this.scene.start('StageSelect');
    });
    this.add.text(W / 2, H * 0.50 + 170, 'Esc でも再開', {
      fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', resume);
  }
}
