import Phaser from 'phaser';
import { visibleGallery } from './GalleryScene';
import { visibleMusic } from './MusicScene';
import { getSafeInsets } from '../utils/safeArea';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave } from '../utils/storage';
import { AudioBus } from '../utils/audio';
import { makeButton } from '../ui/Button';

/**
 * タイトル。キービジュアル（`title_kv`。1024×1536、ロゴ入り）があれば、それを画面いっぱいに出して、下の帯にメニューを置く。
 * 無ければ、文字だけのタイトル（従来の見た目）。
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const kv = this.textures.exists('title_kv');

    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setScrollFactor(0);
    const onResize = () => bg.setSize(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.events.on('update', () => { bg.tilePositionY -= 0.15; });

    if (kv) this.drawKeyVisual(W, H);
    else {
      // 文字だけのタイトル
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
    }

    // 下の帯（キービジュアルのときは、絵の上に文字を置くので下地を敷く）
    const fb = getSafeInsets(this.scale).bottom;
    const bandTop = kv ? H * 0.74 : H * 0.62;
    if (kv) {
      const g = this.add.graphics();
      g.fillGradientStyle(0x060913, 0x060913, 0x060913, 0x060913, 0, 0, 0.92, 0.92);
      g.fillRect(0, bandTop, W, H * 0.12);
      g.fillStyle(0x060913, 0.92);
      g.fillRect(0, bandTop + H * 0.12, W, H - bandTop - H * 0.12);
    }
    const stroke = kv ? { stroke: '#060913', strokeThickness: 6 } : {};
    const tapY = kv ? H * 0.785 : H * 0.66;
    const tap = this.add.text(W / 2, tapY, 'TAP TO START', {
      fontFamily: FONT_EN, fontSize: '40px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 4, ...stroke,
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(W / 2, tapY + 46, '画面をなぞって移動　／　PC: WASD・矢印キーで移動、スペースで必殺', {
      fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const sv = loadSave();
    const best = sv.bests['1'];
    let line = `★ ${sv.totalYell} YELL`;
    if (best) {
      const mm = Math.floor(best.timeSec / 60).toString().padStart(2, '0');
      const ss = Math.floor(best.timeSec % 60).toString().padStart(2, '0');
      line += `　　BEST  ✕ ${best.kills}  ${mm}:${ss}  Lv ${best.level}`;
    }
    this.add.text(W / 2, tapY + 80, line, {
      fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.gold, fontStyle: '700', letterSpacing: 1,
    }).setOrigin(0.5);

    // メニュー（横一列・中央寄せ）。ボタンは pointerdown を止めるので TAP TO START と干渉しない。
    // ギャラリーとミュージックは、中身が1つも無ければ入口ごと出さない
    const menu: { label: string; run: () => void }[] = [
      { label: 'OPTION', run: () => this.scene.launch('Option', { from: 'Title' }) },
      { label: '遊び方', run: () => this.scene.start('HowTo') },
    ];
    if (visibleMusic(sv).length > 0) menu.push({ label: 'MUSIC', run: () => this.scene.start('Music') });
    if (visibleGallery(sv).length > 0) menu.push({ label: 'GALLERY', run: () => this.scene.start('Gallery') });
    menu.push({ label: '図鑑', run: () => this.scene.start('Codex') });
    const mGap = 10;
    const mW = Math.min(160, Math.floor((W - 32 - mGap * (menu.length - 1)) / menu.length));
    const mLeft = (W - (mW * menu.length + mGap * (menu.length - 1))) / 2;
    // キービジュアルのときは、ロゴに重ならないよう下の帯に置く
    const menuY = kv ? tapY + 140 : Math.max(H * 0.06, 50);
    menu.forEach((m, i) => {
      makeButton(this, mLeft + mW / 2 + i * (mW + mGap), menuY, m.label, m.run, { width: mW, height: 52, fontSize: menu.length >= 5 ? 19 : 21 });
    });

    // フッター：位置づけ／AI利用の表記（ポータルと同じ文言）／コピーライト。ホームバーなどのセーフエリア分だけ上げる
    if (kv) {
      this.add.text(W / 2, H - 46 - fb, 'ファンゲーム（IF・お祭り枠）　画像・楽曲等の一部制作にAI技術を活用しています。', {
        fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim,
      }).setOrigin(0.5).setAlpha(0.9);
    } else {
      this.add.text(W / 2, H - 92 - fb, 'ファンゲーム（IF・お祭り枠）', {
        fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim,
      }).setOrigin(0.5);
      this.add.text(W / 2, H - 64 - fb, '画像・楽曲等の一部制作にAI技術を活用しています。', {
        fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim,
      }).setOrigin(0.5).setAlpha(0.8);
    }
    this.add.text(W / 2, H - (kv ? 22 : 38) - fb, '© 2025-2026 言峰空也 / VOICE CONNECT MEMORIAL PROJECT', {
      fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.dim, letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0.8);

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

  /**
   * キービジュアル。縦長の画面では画面を覆う（左右が少し切れる）。
   * 横長の画面（PC）では高さに合わせて中央に置き、両脇は同じ絵を大きく引き伸ばして暗くしたもので埋める
   */
  private drawKeyVisual(W: number, H: number): void {
    this.textures.get('title_kv').setFilter(Phaser.Textures.FilterMode.LINEAR);
    const tex = this.textures.get('title_kv').getSourceImage() as HTMLImageElement;
    const cover = Math.max(W / tex.width, H / tex.height);
    const fit = H / tex.height;
    const wide = W / H > 0.8;
    // 横長：両脇の埋め草（拡大・暗く）を先に置く
    if (wide) this.add.image(W / 2, H / 2, 'title_kv').setScale(cover * 1.1).setTint(0x1a2035).setAlpha(0.9);
    const img = this.add.image(W / 2, 0, 'title_kv').setOrigin(0.5, 0);
    if (wide) {
      // 本体は高さに合わせて中央に
      img.setScale(fit);
      // 本体の両端をぼかす代わりに、細い縁を置く
      const w = img.width * fit;
      this.add.rectangle(W / 2 - w / 2, 0, 2, H, 0x87ceeb, 0.25).setOrigin(0.5, 0);
      this.add.rectangle(W / 2 + w / 2, 0, 2, H, 0x87ceeb, 0.25).setOrigin(0.5, 0);
    } else {
      img.setScale(cover);
    }
    // 絵は動かさない（静止画。2026-09-30 ユーザー指定）
  }
}
