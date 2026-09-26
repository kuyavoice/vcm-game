import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave } from '../utils/storage';
import { AudioBus } from '../utils/audio';
import { makeButton } from '../ui/Button';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;

    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setScrollFactor(0);
    const onResize = () => bg.setSize(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.events.on('update', () => { bg.tilePositionY -= 0.15; });

    // タイトル（仮題）
    const tag = this.add.rectangle(W / 2, H * 0.30, 220, 40, 0x87ceeb).setAngle(-6);
    this.add.text(tag.x, tag.y, 'VOICE CONNECT MEMORIAL', {
      fontFamily: FONT_EN, fontSize: '20px', color: '#060913', fontStyle: '700',
    }).setOrigin(0.5).setAngle(-6);

    this.add.text(W / 2, H * 0.36, 'D-STAGE', {
      fontFamily: FONT_EN, fontSize: '112px', color: COLOR_HEX.white, fontStyle: '700',
    }).setOrigin(0.5, 0);
    this.add.text(W / 2, H * 0.36 + 118, 'SURVIVORS', {
      fontFamily: FONT_EN, fontSize: '72px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5, 0);
    this.add.text(W / 2, H * 0.36 + 208, '— 仮題 —', {
      fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.dim,
    }).setOrigin(0.5, 0);

    const tap = this.add.text(W / 2, H * 0.66, 'TAP TO START', {
      fontFamily: FONT_EN, fontSize: '40px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(W / 2, H * 0.72, '画面をなぞって移動　／　PC: WASD・矢印キー', {
      fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const sv = loadSave();
    this.add.text(W / 2, H * 0.76, `★ ${sv.totalYell} YELL`, {
      fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.gold, fontStyle: '700', letterSpacing: 2,
    }).setOrigin(0.5);
    const best = sv.bests['1'];
    if (best) {
      const mm = Math.floor(best.timeSec / 60).toString().padStart(2, '0');
      const ss = Math.floor(best.timeSec % 60).toString().padStart(2, '0');
      this.add.text(W / 2, H * 0.80, `BEST   ✕ ${best.kills}   ${mm}:${ss}   Lv ${best.level}`, {
        fontFamily: FONT_EN, fontSize: '24px', color: COLOR_HEX.accent, fontStyle: '700',
      }).setOrigin(0.5);
    }

    this.add.text(W / 2, H - 40, 'ファンゲーム（IF・お祭り枠）　M1 build', {
      fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    // 図鑑（ボタンは pointerdown を止めるので TAP TO START と干渉しない）
    makeButton(this, W - 24 - 90, Math.max(H * 0.06, 50), '図鑑', () => this.scene.start('Codex'), { width: 160, height: 52, fontSize: 22 });

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      AudioBus.playBgm('bgm_title');
      this.cameras.main.fadeOut(250, 6, 9, 19);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CharaSelect');
      });
    };
    this.input.once('pointerdown', start);
    this.input.keyboard?.once('keydown', start);
  }
}
