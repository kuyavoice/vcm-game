import Phaser from 'phaser';
import type { Choice } from '../systems/Upgrades';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { SelectGuard } from '../ui/SelectGuard';
import { loadSave, writeSave } from '../utils/storage';
import { makeButton } from '../ui/Button';
import { PORTRAITS, portraitKey } from '../data/portraits';

export interface LevelUpData {
  level: number;
  choices: Choice[];
  onPick: (c: Choice) => void;
  /** 便利アイテム（エールで購入した回数）。使うと消費 */
  reroll?: () => Choice[];
  skip?: () => void;
  ban?: (c: Choice) => Choice[];
}

/** レベルアップの選択（通常3択・詩音は4択。Game をポーズして上に重ねる） */
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
    // 4択（詩音の固有パッシブ）のときは詰めて並べる
    const compact = data.choices.length >= 4;
    const cardH = compact ? 164 : 190;
    const gap = compact ? 14 : 22;
    const total = data.choices.length * cardH + (data.choices.length - 1) * gap;
    let y = H / 2 - total / 2 + cardH / 2 + 20;

    // 誤タップ対策：全指が離れる＋0.3秒待ち＋押し始めと離した位置が同じカード
    const guard = new SelectGuard(this);
    let picked = false;
    const cards: Phaser.GameObjects.Rectangle[] = [];
    const decide = (c: Choice, cont: Phaser.GameObjects.Container) => {
      if (picked) return;
      picked = true;
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
      // 由来キャラの顔（共鳴アーツもサポートも同じ扱い。顔画像が無いものは名前だけ）
      const faceId = PORTRAITS[c.owner.split('・')[0].trim()];
      const faceKey = faceId ? portraitKey(faceId) : '';
      const hasFace = !!faceKey && this.textures.exists(faceKey);
      const fr = compact ? 34 : 38;
      const fx = -cardW / 2 + 30 + fr;
      const tx = hasFace ? fx + fr + 16 : -cardW / 2 + 32;
      const title = this.add.text(tx, -cardH / 2 + 18, c.title, {
        fontFamily: FONT_JP, fontSize: '30px', color: COLOR_HEX.white, fontStyle: '700',
      }).setOrigin(0, 0);
      const owner = this.add.text(tx, -cardH / 2 + 62, hasFace ? `― ${c.owner}` : c.owner, {
        fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
      }).setOrigin(0, 0);
      const desc = this.add.text(tx, -cardH / 2 + (compact ? 92 : 100), c.desc, {
        fontFamily: FONT_JP, fontSize: compact ? '20px' : '22px', color: COLOR_HEX.white, wordWrap: { width: cardW / 2 - 24 - tx, useAdvancedWrap: true },
      }).setOrigin(0, 0);
      cont.add([shadow, bg, stripe, tag, title, owner, desc]);
      if (hasFace) {
        const face = this.add.image(fx, 0, faceKey).setDisplaySize(fr * 2.2, fr * 2.2);
        const maskG = this.make.graphics({ x: 0, y: 0 }, false);
        maskG.fillStyle(0xffffff, 1);
        maskG.fillCircle(fx, 0, fr);
        face.setMask(maskG.createGeometryMask());
        const ring = this.add.graphics();
        ring.lineStyle(3, c.color, 1);
        ring.strokeCircle(fx, 0, fr + 1);
        cont.add([face, ring]);
        // マスクはカードの外にあるので、カードの位置に合わせ続ける
        const sync = () => maskG.setPosition(cont.x, cont.y);
        this.events.on(Phaser.Scenes.Events.UPDATE, sync);
        sync();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.events.off(Phaser.Scenes.Events.UPDATE, sync); maskG.destroy(); });
      }
      cont.setAlpha(0).setX(W / 2 + 40);
      this.tweens.add({ targets: cont, alpha: 1, x: W / 2, duration: 220, delay: 60 * i, ease: 'Cubic.out' });

      cards.push(bg);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff, 1));
      bg.on('pointerout', () => bg.setStrokeStyle(2, 0x87ceeb, 0.5));
      bg.on('pointerdown', () => {
        guard.press(bg);
        if (guard.armed) cont.setScale(0.98);
      });
      bg.on('pointerup', () => {
        cont.setScale(1);
        if (banMode) return;
        if (guard.release(bg)) decide(c, cont);
      });
      y += cardH + gap;
    });

    // 便利アイテム（リロール／スキップ／除外）
    const sv = loadSave();
    const cnt = sv.consumables;
    let banMode = false;
    const banHint = this.add.text(W / 2, H * 0.14 + 84, '', { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.danger, fontStyle: '700' }).setOrigin(0.5);
    const useItem = (key: 'reroll' | 'skip' | 'ban') => {
      const s2 = loadSave();
      if (s2.consumables[key] <= 0) return false;
      s2.consumables[key]--;
      writeSave(s2);
      return true;
    };
    const by = Math.min(H - 110, y + 10);
    if (data.reroll) {
      makeButton(this, W / 2 - 220, by, `リロール ${cnt.reroll}`, () => {
        if (picked || !useItem('reroll')) return;
        this.scene.restart({ ...data, choices: data.reroll!() });
      }, { width: 200, height: 56, fontSize: 20, primary: cnt.reroll > 0 });
    }
    if (data.skip) {
      makeButton(this, W / 2, by, `スキップ ${cnt.skip}`, () => {
        if (picked || !useItem('skip')) return;
        picked = true;
        data.skip!();
        this.scene.stop();
        this.scene.resume('Game');
      }, { width: 200, height: 56, fontSize: 20, primary: cnt.skip > 0 });
    }
    if (data.ban) {
      makeButton(this, W / 2 + 220, by, `除外 ${cnt.ban}`, () => {
        if (picked || cnt.ban <= 0) return;
        banMode = !banMode;
        banHint.setText(banMode ? '除外する候補をタップ' : '');
      }, { width: 200, height: 56, fontSize: 20, primary: cnt.ban > 0 });
    }
    // 除外モード中はカードのタップで除外→その枠だけ引き直し
    this.input.on('gameobjectup', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (!banMode || picked) return;
      const idx = cards.indexOf(obj as Phaser.GameObjects.Rectangle);
      if (idx < 0) return;
      if (!useItem('ban')) return;
      picked = true;
      this.scene.restart({ ...data, choices: data.ban!(data.choices[idx]) });
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
