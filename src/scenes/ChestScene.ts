import Phaser from 'phaser';
import type { ChestResult } from '../systems/Upgrades';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { SelectGuard } from '../ui/SelectGuard';
import { AudioBus } from '../utils/audio';

export interface ChestData {
  /** 開封時に結果を確定する（進化・Lvアップの適用込み） */
  open: () => ChestResult;
  onClose: (r: ChestResult) => void;
}

/**
 * 美麗の宝石箱の開封画面。ルナ（チビ）がマスコットとして横にいる。
 * ルナの台詞は「ふむ」「よいぞ」程度の相槌のみ。稀に大当たり（報酬3つ）。
 */
export class ChestScene extends Phaser.Scene {
  constructor() {
    super('Chest');
  }

  create(data: ChestData): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    this.add.rectangle(0, 0, W, H, 0x060913, 0.85).setOrigin(0);

    const header = this.add.text(W / 2, H * 0.14, '美麗の宝石箱', {
      fontFamily: FONT_JP, fontSize: '44px', color: '#FF69B4', fontStyle: '700',
    }).setOrigin(0.5);
    const headerEn = this.add.text(W / 2, H * 0.14 + 50, 'JEWEL BOX', {
      fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5);

    // 宝箱
    const chest = this.add.image(W / 2, H * 0.36, 'item_chest').setScale(10);
    this.tweens.add({ targets: chest, y: chest.y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // ルナ（チビ）：画像があれば表示、無ければ小さなプレースホルダー
    const lunaX = W / 2 + 190;
    const lunaY = H * 0.36 + 40;
    if (this.textures.exists('luna_chibi')) {
      const luna = this.add.image(lunaX, lunaY, 'luna_chibi').setOrigin(0.5, 1);
      const sc = 220 / luna.height;
      luna.setScale(sc);
      this.tweens.add({ targets: luna, y: lunaY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } else {
      const ph = this.add.rectangle(lunaX, lunaY, 120, 160, 0x111a3a, 0.6).setOrigin(0.5, 1).setStrokeStyle(2, 0x87ceeb, 0.5);
      this.add.text(ph.x, ph.y - 80, 'LUNA', { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.dim }).setOrigin(0.5);
    }
    const bubble = this.add.text(lunaX, lunaY - 240, '…', {
      fontFamily: FONT_JP, fontSize: '24px', color: COLOR_HEX.white, backgroundColor: '#111A3A', padding: { x: 12, y: 6 },
    }).setOrigin(0.5);

    const hint = this.add.text(W / 2, H * 0.56, 'TAP TO OPEN', {
      fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const guard = new SelectGuard(this);
    let result: ChestResult | null = null;
    let opened = false;
    let armedAt = 0;

    const reveal = () => {
      opened = true;
      hint.setVisible(false);
      AudioBus.play('se_chest');
      result = data.open();
      this.tweens.add({ targets: chest, scaleX: 12, scaleY: 8, duration: 90, yoyo: true });
      this.cameras.main.flash(250, 255, 200, 230);

      if (result.jackpot) {
        header.setText('大当たり！').setColor('#FFD700');
        headerEn.setText('JACKPOT');
        bubble.setText('よいぞ、よいぞ');
        this.cameras.main.shake(200, 0.006);
        AudioBus.play('se_evolve');
      } else if (result.rewards.some((r) => r.kind === 'evolve')) {
        bubble.setText('よいぞ');
        AudioBus.play('se_evolve');
      } else {
        bubble.setText('ふむ');
      }

      // 報酬カード（縦に並べる）
      const cardW = Math.min(600, W - 60);
      const rowH = result.rewards.length > 1 ? 96 : 130;
      let y = H * 0.54;
      result.rewards.forEach((r, i) => {
        const cont = this.add.container(W / 2, y + rowH / 2).setAlpha(0);
        const bg = this.add.rectangle(0, 0, cardW, rowH - 10, 0x111a3a, 0.95).setStrokeStyle(2, r.color, 0.9);
        const stripe = this.add.rectangle(-cardW / 2 + 8, 0, 8, rowH - 30, r.color, 1);
        const tag = this.add.text(-cardW / 2 + 28, -rowH / 2 + 14, r.kind === 'evolve' ? 'EVOLVE' : r.kind === 'weapon' ? 'ARTS' : r.kind === 'passive' ? 'SUPPORT' : 'YELL', {
          fontFamily: FONT_EN, fontSize: '14px', color: '#060913', backgroundColor: Phaser.Display.Color.IntegerToColor(r.color).rgba, fontStyle: '700', padding: { x: 6, y: 1 },
        });
        const title = this.add.text(-cardW / 2 + 28, -rowH / 2 + 38, r.title, {
          fontFamily: FONT_JP, fontSize: r.kind === 'evolve' ? '30px' : '26px', color: r.kind === 'evolve' ? '#FFD700' : COLOR_HEX.white, fontStyle: '700',
        });
        const sub = this.add.text(cardW / 2 - 20, -rowH / 2 + 40, r.sub, {
          fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
        }).setOrigin(1, 0);
        cont.add([bg, stripe, tag, title, sub]);
        if (r.desc && result!.rewards.length === 1) {
          cont.add(this.add.text(-cardW / 2 + 28, -rowH / 2 + 78, r.desc, {
            fontFamily: FONT_JP, fontSize: '17px', color: COLOR_HEX.white, wordWrap: { width: cardW - 56 },
          }));
        }
        this.tweens.add({ targets: cont, alpha: 1, y: cont.y - 6, duration: 220, delay: 120 * i });
        y += rowH;
      });

      const close = this.add.text(W / 2, Math.min(H * 0.86, y + 50), 'TAP TO CONTINUE', {
        fontFamily: FONT_EN, fontSize: '26px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: close, alpha: 1, duration: 300, delay: 500 });
      armedAt = this.time.now + 600;
    };

    const finish = () => {
      if (!result || this.time.now <= armedAt) return;
      this.scene.stop();
      this.scene.resume('Game');
      data.onClose(result);
    };

    // 画面全体がボタン：指が離れる＋0.3秒待ちは守る
    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    zone.on('pointerdown', () => guard.press(zone));
    zone.on('pointerup', () => {
      if (!opened) {
        if (guard.release(zone)) reveal();
        return;
      }
      finish();
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!opened) {
        if (guard.confirm()) reveal();
      } else finish();
    });
  }
}
