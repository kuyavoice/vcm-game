import Phaser from 'phaser';
import { visibleGallery } from './GalleryScene';
import { visibleMusic } from './MusicScene';
import { getSafeInsets } from '../utils/safeArea';
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

    // タイトル
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

    const tap = this.add.text(W / 2, H * 0.66, 'TAP TO START', {
      fontFamily: FONT_EN, fontSize: '40px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(W / 2, H * 0.72, '画面をなぞって移動　／　PC: WASD・矢印キーで移動、スペースで必殺', {
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

    // フッター：位置づけ／AI利用の表記（ポータルと同じ文言）／コピーライト。ホームバーなどのセーフエリア分だけ上げる
    const fb = getSafeInsets(this.scale).bottom;
    this.add.text(W / 2, H - 92 - fb, 'ファンゲーム（IF・お祭り枠）', {
      fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 64 - fb, '画像・楽曲等の一部制作にAI技術を活用しています。', {
      fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim,
    }).setOrigin(0.5).setAlpha(0.8);
    this.add.text(W / 2, H - 38 - fb, '© 2025-2026 言峰空也 / VOICE CONNECT MEMORIAL PROJECT', {
      fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.dim, letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0.8);

    // 上部のメニュー（横一列・中央寄せ）。ボタンは pointerdown を止めるので TAP TO START と干渉しない。
    // ギャラリーとミュージックは、中身が1つも無ければ入口ごと出さない
    const sv0 = loadSave();
    const menu: { label: string; run: () => void }[] = [
      { label: 'OPTION', run: () => this.scene.launch('Option', { from: 'Title' }) },
    ];
    if (visibleMusic(sv0).length > 0) menu.push({ label: 'MUSIC', run: () => this.scene.start('Music') });
    if (visibleGallery(sv0).length > 0) menu.push({ label: 'GALLERY', run: () => this.scene.start('Gallery') });
    menu.push({ label: '図鑑', run: () => this.scene.start('Codex') });
    const mGap = 10;
    const mW = Math.min(160, Math.floor((W - 32 - mGap * (menu.length - 1)) / menu.length));
    const mLeft = (W - (mW * menu.length + mGap * (menu.length - 1))) / 2;
    menu.forEach((m, i) => {
      makeButton(this, mLeft + mW / 2 + i * (mW + mGap), Math.max(H * 0.06, 50), m.label, m.run, { width: mW, height: 52, fontSize: 21 });
    });

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
