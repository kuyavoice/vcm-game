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
 * ルナの台詞は「ふむ」「よいぞ」程度の相槌のみ。
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

    this.add.text(W / 2, H * 0.16, '美麗の宝石箱', {
      fontFamily: FONT_JP, fontSize: '44px', color: '#FF69B4', fontStyle: '700',
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.16 + 50, 'JEWEL BOX', {
      fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5);

    // 宝箱
    const chest = this.add.image(W / 2, H * 0.42, 'item_chest').setScale(10);
    this.tweens.add({ targets: chest, y: chest.y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // ルナ（チビ）：画像があれば表示、無ければ小さなプレースホルダー
    const lunaX = W / 2 + 190;
    const lunaY = H * 0.42 + 40;
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

    const hint = this.add.text(W / 2, H * 0.62, 'TAP TO OPEN', {
      fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const guard = new SelectGuard(this);
    let result: ChestResult | null = null;
    let opened = false;

    const reveal = () => {
      opened = true;
      hint.setVisible(false);
      AudioBus.play('se_chest');
      result = data.open();
      this.tweens.add({ targets: chest, scaleX: 12, scaleY: 8, duration: 90, yoyo: true });
      this.cameras.main.flash(250, 255, 200, 230);

      let title = '';
      let sub = '';
      let color: string = COLOR_HEX.white;
      if (result.kind === 'evolve' && result.weapon) {
        title = result.weapon.name;
        sub = `『${result.fromName}』が進化した！`;
        color = '#FFD700';
        AudioBus.play('se_evolve');
        bubble.setText('よいぞ');
      } else if (result.kind === 'levelup' && result.weapon) {
        title = result.weapon.name;
        sub = `Lv ${result.weapon.level - 1} → ${result.weapon.level}`;
        bubble.setText('ふむ');
      } else {
        title = `エール +${result.yell ?? 0}`;
        sub = 'アーツを持っていないので、代わりに';
        bubble.setText('ふむ…');
      }
      const t1 = this.add.text(W / 2, H * 0.62, title, {
        fontFamily: FONT_JP, fontSize: '40px', color, fontStyle: '700', stroke: '#060913', strokeThickness: 6,
      }).setOrigin(0.5).setAlpha(0);
      const t2 = this.add.text(W / 2, H * 0.62 + 52, sub, {
        fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
      }).setOrigin(0.5).setAlpha(0);
      if (result.weapon?.evolved && result.weapon.def.evolution) {
        this.add.text(W / 2, H * 0.62 + 92, result.weapon.def.evolution.desc, {
          fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.white, wordWrap: { width: W - 80 }, align: 'center',
        }).setOrigin(0.5, 0);
      }
      this.tweens.add({ targets: [t1, t2], alpha: 1, y: '-=10', duration: 250 });
      const close = this.add.text(W / 2, H * 0.80, 'TAP TO CONTINUE', {
        fontFamily: FONT_EN, fontSize: '26px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: close, alpha: 1, duration: 300, delay: 500 });
    };

    // 画面全体がボタン：押し始めと離した位置の一致は不要だが、指が離れる＋0.3秒待ちは守る
    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    let armedAt = 0;
    zone.on('pointerdown', () => guard.press(zone));
    zone.on('pointerup', () => {
      if (!opened) {
        if (guard.release(zone)) {
          reveal();
          armedAt = this.time.now + 600;
        }
        return;
      }
      if (result && this.time.now > armedAt) {
        this.scene.stop();
        this.scene.resume('Game');
        data.onClose(result);
      }
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!opened) {
        if (guard.confirm()) { reveal(); armedAt = this.time.now + 600; }
      } else if (result && this.time.now > armedAt) {
        this.scene.stop();
        this.scene.resume('Game');
        data.onClose(result);
      }
    });
  }
}
