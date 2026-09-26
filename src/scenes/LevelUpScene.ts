import Phaser from 'phaser';
import type { Choice } from '../systems/Upgrades';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { SelectGuard } from '../ui/SelectGuard';

export interface LevelUpData {
  level: number;
  choices: Choice[];
  onPick: (c: Choice) => void;
}

/** レベルアップ3択（Game をポーズして上に重ねる） */
export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUp');
  }

  create(data: LevelUpData): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;

    this.add.rectangle(0, 0, W, H, 0x060913, 0.82).setOrigin(0);

    this.add.text(W / 2, H * 0.14, 'LEVEL UP', {
      fontFamily: FONT_EN, fontSize: '64px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.14 + 52, `Lv ${data.level}　仲間の力を借りる`, {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const cardW = Math.min(640, W - 40);
    const cardH = 190;
    const gap = 22;
    const total = data.choices.length * cardH + (data.choices.length - 1) * gap;
    let y = H / 2 - total / 2 + cardH / 2 + 20;

    // 誤タップ対策：全指が離れる＋0.3秒待ち＋押し始めと離した位置が同じカード
    const guard = new SelectGuard(this);
    const decide = (c: Choice, cont: Phaser.GameObjects.Container) => {
      this.tweens.add({
        targets: cont, scaleX: 1.04, scaleY: 1.04, duration: 90, yoyo: true,
        onComplete: () => {
          data.onPick(c);
          this.scene.stop();
          this.scene.resume('Game');
        },
      });
    };

    data.choices.forEach((c, i) => {
      const cont = this.add.container(W / 2, y);
      const shadow = this.add.rectangle(6, 6, cardW, cardH, 0x000000, 0.5);
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x111a3a, 1).setStrokeStyle(2, 0x87ceeb, 0.5);
      const stripe = this.add.rectangle(-cardW / 2 + 8, 0, 10, cardH - 24, c.color, 1);
      const tag = this.add.text(cardW / 2 - 20, -cardH / 2 + 16, c.tag, {
        fontFamily: FONT_EN, fontSize: '22px', color: c.tag === 'NEW' ? '#060913' : COLOR_HEX.accent, fontStyle: '700',
        backgroundColor: c.tag === 'NEW' ? '#87CEEB' : undefined, padding: { x: 8, y: 2 },
      }).setOrigin(1, 0);
      const title = this.add.text(-cardW / 2 + 32, -cardH / 2 + 18, c.title, {
        fontFamily: FONT_JP, fontSize: '30px', color: COLOR_HEX.white, fontStyle: '700',
      }).setOrigin(0, 0);
      const owner = this.add.text(-cardW / 2 + 32, -cardH / 2 + 62, c.owner, {
        fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
      }).setOrigin(0, 0);
      const desc = this.add.text(-cardW / 2 + 32, -cardH / 2 + 100, c.desc, {
        fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, wordWrap: { width: cardW - 64 },
      }).setOrigin(0, 0);
      cont.add([shadow, bg, stripe, tag, title, owner, desc]);
      cont.setAlpha(0).setX(W / 2 + 40);
      this.tweens.add({ targets: cont, alpha: 1, x: W / 2, duration: 220, delay: 60 * i, ease: 'Cubic.out' });

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff, 1));
      bg.on('pointerout', () => bg.setStrokeStyle(2, 0x87ceeb, 0.5));
      bg.on('pointerdown', () => {
        guard.press(bg);
        if (guard.armed) cont.setScale(0.98);
      });
      bg.on('pointerup', () => {
        cont.setScale(1);
        if (guard.release(bg)) decide(c, cont);
      });
      y += cardH + gap;
    });

    // PC：1〜3キーでも選べる（同じく0.3秒は無効）
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = parseInt(ev.key, 10);
      if (!(n >= 1 && n <= data.choices.length)) return;
      if (guard.confirm()) {
        data.onPick(data.choices[n - 1]);
        this.scene.stop();
        this.scene.resume('Game');
      }
    });
  }
}
