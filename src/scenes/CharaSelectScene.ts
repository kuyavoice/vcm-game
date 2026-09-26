import Phaser from 'phaser';
import { CHARACTERS, CHARACTER_ORDER, type CharacterDef } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { SelectGuard } from '../ui/SelectGuard';
import { makeButton } from '../ui/Button';
import { portraitKey, PORTRAITS } from '../data/portraits';

/** キャラ選択（タイトル → ここ → ステージ選択）。解放はエール（未実装の間はロック表示のみ） */
export class CharaSelectScene extends Phaser.Scene {
  constructor() {
    super('CharaSelect');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(250, 6, 9, 19);

    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);
    const onResize = () => bg.setSize(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.events.on('update', () => { bg.tilePositionY -= 0.15; });

    this.add.text(W / 2, H * 0.09, 'SELECT CHARACTER', {
      fontFamily: FONT_EN, fontSize: '50px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.09 + 46, '誰の声で、夜を渡る？', {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const save = loadSave();
    const guard = new SelectGuard(this);
    const cardW = Math.min(640, W - 40);
    const cardH = 176;
    const gap = 18;
    const total = CHARACTER_ORDER.length * cardH + (CHARACTER_ORDER.length - 1) * gap;
    let y = H / 2 - total / 2 + cardH / 2 + 10;

    CHARACTER_ORDER.forEach((id, i) => {
      const def = CHARACTERS[id];
      const unlocked = def.unlockYell === 0 || save.unlockedCharacters.includes(id);
      const cont = this.buildCard(def, unlocked, cardW, cardH);
      cont.setPosition(W / 2 + 40, y).setAlpha(0);
      this.tweens.add({ targets: cont, alpha: 1, x: W / 2, duration: 220, delay: 60 * i, ease: 'Cubic.out' });
      const hit = cont.getByName('hit') as Phaser.GameObjects.Rectangle;
      hit.on('pointerdown', () => { guard.press(hit); if (guard.armed) cont.setScale(0.98); });
      hit.on('pointerup', () => {
        cont.setScale(1);
        if (!guard.release(hit)) return;
        if (unlocked) this.choose(id);
        else this.scene.start('Shop');
      });
      y += cardH + gap;
    });

    const by = H - Math.max(90, H * 0.08);
    makeButton(this, W / 2 - 140, by, 'TITLE', () => this.scene.start('Title'), { width: 240, height: 60, fontSize: 24 });
    makeButton(this, W / 2 + 140, by, `★ SHOP  ${save.totalYell}`, () => this.scene.start('Shop'), { width: 240, height: 60, fontSize: 22, primary: true });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = parseInt(ev.key, 10);
      const id = CHARACTER_ORDER[n - 1];
      if (!id) return;
      const def = CHARACTERS[id];
      const unlocked = def.unlockYell === 0 || save.unlockedCharacters.includes(id);
      if (!unlocked || !guard.confirm()) return;
      this.choose(id);
    });
  }

  private choose(id: string): void {
    const save = loadSave();
    save.settings.character = id;
    writeSave(save);
    this.cameras.main.fadeOut(200, 6, 9, 19);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('StageSelect'));
  }

  private buildCard(def: CharacterDef, unlocked: boolean, cardW: number, cardH: number): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);
    const color = unlocked ? def.color : 0x3a4a8a;
    const shadow = this.add.rectangle(6, 6, cardW, cardH, 0x000000, 0.5);
    const bg = this.add.rectangle(0, 0, cardW, cardH, 0x111a3a, 1).setStrokeStyle(2, color, unlocked ? 0.9 : 0.5);
    const stripe = this.add.rectangle(-cardW / 2 + 8, 0, 10, cardH - 24, color, 1);
    cont.add([shadow, bg, stripe]);

    // 顔（円マスク）
    const faceId = PORTRAITS[def.name];
    const key = faceId ? portraitKey(faceId) : '';
    const fx = -cardW / 2 + 28 + 56;
    if (key && this.textures.exists(key)) {
      const r = 52;
      const face = this.add.image(fx, 0, key).setDisplaySize(r * 2.2, r * 2.2);
      if (!unlocked) face.setTint(0x334466).setAlpha(0.6);
      const maskG = this.make.graphics({ x: 0, y: 0 }, false);
      maskG.fillStyle(0xffffff, 1);
      maskG.fillCircle(fx, 0, r);
      face.setMask(maskG.createGeometryMask());
      const ring = this.add.graphics();
      ring.lineStyle(3, color, 1);
      ring.strokeCircle(fx, 0, r + 1);
      cont.add([face, ring]);
      const sync = () => maskG.setPosition(cont.x, cont.y);
      this.events.on(Phaser.Scenes.Events.UPDATE, sync);
      cont.once(Phaser.GameObjects.Events.DESTROY, () => { this.events.off(Phaser.Scenes.Events.UPDATE, sync); maskG.destroy(); });
    }

    const tx = -cardW / 2 + 28 + 56 * 2 + 24;
    const role = this.add.text(tx, -cardH / 2 + 16, `${def.role}`, {
      fontFamily: FONT_JP, fontSize: '16px', color: unlocked ? Phaser.Display.Color.IntegerToColor(def.color).rgba : COLOR_HEX.dim, fontStyle: '700',
    });
    const name = this.add.text(tx, -cardH / 2 + 38, def.name, {
      fontFamily: FONT_JP, fontSize: '30px', color: unlocked ? COLOR_HEX.white : '#5A6488', fontStyle: '700',
    });
    cont.add([role, name]);

    if (unlocked) {
      const weapon = WEAPONS[def.startWeapon];
      const lines = [
        `武器『${weapon.name}』　特性：${def.traits.desc}`,
        `必殺『${def.special.name}』`,
      ];
      const desc = this.add.text(tx, -cardH / 2 + 82, lines, {
        fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.white, wordWrap: { width: cardW - (tx + cardW / 2) - 20, useAdvancedWrap: true }, lineSpacing: 4,
      });
      const hpText = this.add.text(cardW / 2 - 18, -cardH / 2 + 14, `HP ${Math.round(def.hp * def.traits.maxHpMul)}  SPD ${def.speed}`, {
        fontFamily: FONT_EN, fontSize: '15px', color: COLOR_HEX.dim, fontStyle: '700',
      }).setOrigin(1, 0);
      cont.add([desc, hpText]);
    } else {
      const lock = this.add.text(tx, -cardH / 2 + 86, `★ ${def.unlockYell} エールで解放（タップでショップへ）`, {
        fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
      });
      const icon = this.add.text(cardW / 2 - 18, -cardH / 2 + 14, 'LOCKED', {
        fontFamily: FONT_EN, fontSize: '16px', color: '#5A6488', fontStyle: '700', letterSpacing: 3,
      }).setOrigin(1, 0);
      cont.add([lock, icon]);
      cont.setAlpha(0.75);
    }

    const hit = this.add.rectangle(0, 0, cardW, cardH, 0xffffff, 0.001).setName('hit');
    hit.setInteractive({ useHandCursor: true });
    cont.add(hit);
    return cont;
  }
}
