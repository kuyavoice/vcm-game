import Phaser from 'phaser';
import { visibleGallery } from './GalleryScene';
import { visibleMusic } from './MusicScene';
import { getSafeInsets } from '../utils/safeArea';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave } from '../utils/storage';
import { AudioBus } from '../utils/audio';
import { makeButton } from '../ui/Button';
import { go } from '../ui/theme';
import { visibleCharacters } from '../utils/unlock';

/** タイトルコールは起動ごとに1回 */
let titleCalled = false;

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
    // 磨き B（2026-10-05 ユーザー承認）：TAP TO START の下を細い斜めの光が走る。帯の奥には薄いスピード線がゆっくり流れる。絵そのものは動かさない
    {
      const ly = tapY + 30;
      const glow = this.add.graphics().setDepth(1);
      glow.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x87ceeb, 0x87ceeb, 0, 0.9, 0, 0.9);
      glow.fillPoints([new Phaser.Math.Vector2(14, ly - 1), new Phaser.Math.Vector2(190, ly - 1), new Phaser.Math.Vector2(176, ly + 2), new Phaser.Math.Vector2(0, ly + 2)], true);
      glow.setX(-220);
      this.tweens.add({ targets: glow, x: W + 40, duration: 1400, ease: 'Sine.inOut', repeat: -1, repeatDelay: 1300 });
      const lines = this.add.graphics().setDepth(0).setAlpha(0.5);
      const y0 = bandTop + 10;
      const y1 = H - fb - 30;
      const seg = W + 240;
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < 18; i++) {
          const y = y0 + Math.random() * Math.max(10, y1 - y0);
          const len = 80 + Math.random() * 240;
          const x = k * seg + Math.random() * seg;
          lines.lineStyle(1, 0x87ceeb, 0.06 + Math.random() * 0.1);
          lines.lineBetween(x, y, x + len, y - len * 0.12);
        }
      }
      lines.setX(-120);
      this.tweens.add({ targets: lines, x: -120 - seg, duration: 9000, repeat: -1 });
    }

    this.add.text(W / 2, tapY + 46, '画面をなぞって移動　／　PC: WASD・矢印キーで移動、スペースで必殺', {
      fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const sv = loadSave();
    // タイトルコール：解放済みの操作キャラからランダムで1人（隠しキャラは解放後だけ候補）
    if (!titleCalled) {
      const cands = visibleCharacters(sv).filter((id) => AudioBus.hasVoice(id, 'title'));
      if (cands.length > 0) {
        titleCalled = true;
        AudioBus.voice(cands[Math.floor(Math.random() * cands.length)], 'title');
      }
    }
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
      { label: '遊び方', run: () => go(this, 'HowTo') },
    ];
    if (visibleMusic(sv).length > 0) menu.push({ label: 'MUSIC', run: () => go(this, 'Music') });
    if (visibleGallery(sv).length > 0) menu.push({ label: 'GALLERY', run: () => go(this, 'Gallery') });
    menu.push({ label: '図鑑', run: () => go(this, 'Codex') });
    const mGap = 10;
    const mW = Math.min(160, Math.floor((W - 32 - mGap * (menu.length - 1)) / menu.length));
    const mLeft = (W - (mW * menu.length + mGap * (menu.length - 1))) / 2;
    // キービジュアルのときは、ロゴに重ならないよう下の帯に置く
    const menuY = kv ? tapY + 140 : Math.max(H * 0.06, 50);
    menu.forEach((m, i) => {
      const bx = mLeft + mW / 2 + i * (mW + mGap);
      const under = this.add.rectangle(bx - mW / 2, menuY + 26 + 6, mW, 4, 0x87ceeb, 1).setOrigin(0, 0.5).setScale(0, 1).setDepth(2);
      const btn = makeButton(this, bx, menuY, m.label, () => {
        // 下の帯が伸びきってから移動（ワイプと重なって、帯が画面を引っ張るように見える）
        this.tweens.add({ targets: under, scaleX: 1, duration: 140, ease: 'Cubic.out', onComplete: m.run });
      }, { width: mW, height: 52, fontSize: menu.length >= 5 ? 19 : 21 });
      // 押している間だけ帯が少し伸びる（離して確定しなければ戻る）
      const hit = btn.list[3] as Phaser.GameObjects.Rectangle;
      hit.on('pointerdown', () => this.tweens.add({ targets: under, scaleX: 0.35, duration: 120, ease: 'Cubic.out' }));
      hit.on('pointerout', () => this.tweens.add({ targets: under, scaleX: 0, duration: 120 }));
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
      go(this, 'CharaSelect');
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
