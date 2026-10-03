import Phaser from 'phaser';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { SelectGuard } from '../ui/SelectGuard';
import { makeButton } from '../ui/Button';
import { portraitKey, PORTRAITS } from '../data/portraits';
import { AudioBus } from '../utils/audio';
import { clearNewBadge, hasNewBadge, isCharacterUnlocked, isSecretPending, markSecretShown, resolveCharacter, visibleCharacters } from '../utils/unlock';

/**
 * キャラ選択（タイトル → ここ → ステージ選択）。
 * 隠しキャラは解放するまで一切出さない。解放後に初めてこの画面へ来たとき、星の粒が集まる演出とともに枠が現れる（表示は NEW のみ）
 */
export class CharaSelectScene extends Phaser.Scene {
  constructor() {
    super('CharaSelect');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(250, 6, 9, 19);
    AudioBus.leaveGameOver();

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
    const order = visibleCharacters(save);
    // 5人以上を並べるときは、カードを少し詰める
    const compact = order.length >= 5;
    const cardW = Math.min(640, W - 40);
    const cardH = compact ? 126 : 150;
    const gap = compact ? 10 : 14;
    const total = order.length * cardH + (order.length - 1) * gap;
    const buttonsY = H - Math.max(90, H * 0.08);
    const headerBottom = H * 0.09 + 80;
    const selected = resolveCharacter(save);
    // ドット立ち絵が1枚も無いときはカードを中央寄せ（立ち絵が来たら上部に表示スペースを確保）
    const anyPortrait = order.some((id) => this.textures.exists(`portrait_${id}`));
    const cardsTop = anyPortrait ? buttonsY - 70 - total : Math.max(headerBottom + 20, (headerBottom + buttonsY - 60) / 2 - total / 2);
    let y = cardsTop + cardH / 2;

    // 選択中キャラのドット立ち絵（`assets/images/portrait/{id}_portrait.png`、置けば表示）
    const avail = cardsTop - headerBottom - 24;
    const portrait = this.add.image(W / 2, headerBottom + avail / 2, '__DEFAULT').setVisible(false);
    const showPortrait = (id: string) => {
      const key = `portrait_${id}`;
      if (!this.textures.exists(key)) { portrait.setVisible(false); return; }
      portrait.setTexture(key);
      const sc = portrait.height * 3 <= avail ? 3 : 2; // 3倍の整数倍。狭ければ2倍。最近傍は pixelArt 設定で全体に効く
      portrait.setScale(sc).setVisible(true);
    };
    // 出現演出がまだの隠しキャラが選択中でも、演出が終わるまでは立ち絵を出さない
    showPortrait(isSecretPending(selected, save) ? order[0] : selected);

    order.forEach((id, i) => {
      const def = CHARACTERS[id];
      const unlocked = isCharacterUnlocked(id, save);
      const pending = !!def.secret && isSecretPending(id, save);
      const cont = this.buildCard(def, unlocked, cardW, cardH, compact, hasNewBadge(id, save));
      const hit = cont.getByName('hit') as Phaser.GameObjects.Rectangle;
      let ready = !pending;
      if (pending) {
        cont.setPosition(W / 2, y).setAlpha(0);
        this.revealSecret(cont, W / 2, y, cardW, cardH, def.color, 60 * order.length + 450, () => {
          ready = true;
          markSecretShown(id);
        });
      } else {
        cont.setPosition(W / 2 + 40, y).setAlpha(0);
        this.tweens.add({ targets: cont, alpha: 1, x: W / 2, duration: 220, delay: 60 * i, ease: 'Cubic.out' });
      }
      hit.on('pointerdown', () => {
        if (!ready) return;
        guard.press(hit);
        if (guard.armed) { cont.setScale(0.98); if (unlocked) showPortrait(id); }
      });
      hit.on('pointerup', () => {
        cont.setScale(1);
        if (!ready || !guard.release(hit)) return;
        if (unlocked) this.choose(id);
        else this.scene.start('Shop');
      });
      y += cardH + gap;
    });

    const by = buttonsY;
    makeButton(this, W / 2 - 140, by, 'TITLE', () => this.scene.start('Title'), { width: 240, height: 60, fontSize: 24 });
    makeButton(this, W / 2 + 140, by, `★ SHOP  ${save.totalYell}`, () => this.scene.start('Shop'), { width: 240, height: 60, fontSize: 22, primary: true });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = parseInt(ev.key, 10);
      const id = order[n - 1];
      if (!id) return;
      if (!isCharacterUnlocked(id, save) || isSecretPending(id, loadSave()) || !guard.confirm()) return;
      this.choose(id);
    });
  }

  private choose(id: string): void {
    AudioBus.voice(id, 'select');
    const save = loadSave();
    save.settings.character = id;
    writeSave(save);
    clearNewBadge(id);
    this.cameras.main.fadeOut(200, 6, 9, 19);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('StageSelect'));
  }

  /** 隠しキャラの出現：画面のあちこちから星の粒が枠の位置へ集まり、光とともに枠が現れる */
  private revealSecret(cont: Phaser.GameObjects.Container, cx: number, cy: number, cardW: number, cardH: number, color: number, delay: number, onDone: () => void): void {
    const cam = this.cameras.main;
    const n = 46;
    const gather = 900;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 260 + Math.random() * Math.max(cam.width, cam.height) * 0.5;
      const sx = cx + Math.cos(a) * d;
      const sy = cy + Math.sin(a) * d;
      const tx = cx + (Math.random() - 0.5) * cardW * 0.9;
      const ty = cy + (Math.random() - 0.5) * cardH * 0.8;
      const star = this.add.image(sx, sy, 'art_star').setDepth(50).setScale(0.6 + Math.random() * 1.0).setAlpha(0).setTint(i % 3 === 0 ? 0xfff3a0 : color);
      this.tweens.add({
        targets: star, x: tx, y: ty, alpha: { from: 0, to: 1 }, angle: 180 + Math.random() * 180,
        duration: gather, delay: delay + Math.random() * 500, ease: 'Cubic.in',
        onComplete: () => {
          this.tweens.add({ targets: star, alpha: 0, scale: 0.2, duration: 260, onComplete: () => star.destroy() });
        },
      });
    }
    // 光って現れる
    this.time.delayedCall(delay + gather + 380, () => {
      const glow = this.add.rectangle(cx, cy, cardW, cardH, 0xffffff, 0.85).setDepth(49);
      this.tweens.add({ targets: glow, alpha: 0, scaleX: 1.06, scaleY: 1.25, duration: 520, ease: 'Cubic.out', onComplete: () => glow.destroy() });
      cont.setScale(0.96);
      this.tweens.add({ targets: cont, alpha: 1, scale: 1, duration: 420, ease: 'Back.out' });
      AudioBus.play('se_evolve');
      this.time.delayedCall(300, onDone);
    });
  }

  private buildCard(def: CharacterDef, unlocked: boolean, cardW: number, cardH: number, compact = false, isNew = false): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);
    const color = unlocked ? def.color : 0x3a4a8a;
    const shadow = this.add.rectangle(6, 6, cardW, cardH, 0x000000, 0.5);
    const bg = this.add.rectangle(0, 0, cardW, cardH, 0x111a3a, 1).setStrokeStyle(2, color, unlocked ? 0.9 : 0.5);
    const stripe = this.add.rectangle(-cardW / 2 + 8, 0, 10, cardH - 24, color, 1);
    cont.add([shadow, bg, stripe]);

    // 顔（円マスク）
    const faceId = PORTRAITS[def.name];
    const key = faceId ? portraitKey(faceId) : '';
    const r = compact ? 46 : 52;
    const fx = -cardW / 2 + 28 + 56;
    if (key && this.textures.exists(key)) {
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
      // マスクはコンテナの外にあるので、位置をコンテナに合わせる
      const sync = () => maskG.setPosition(cont.x, cont.y);
      this.events.on(Phaser.Scenes.Events.UPDATE, sync);
      sync();
      cont.once(Phaser.GameObjects.Events.DESTROY, () => { this.events.off(Phaser.Scenes.Events.UPDATE, sync); maskG.destroy(); });
    }

    const top = -cardH / 2;
    const tx = -cardW / 2 + 28 + 56 * 2 + 24;
    const role = this.add.text(tx, top + (compact ? 10 : 16), `${def.role}`, {
      fontFamily: FONT_JP, fontSize: '16px', color: unlocked ? Phaser.Display.Color.IntegerToColor(def.color).rgba : COLOR_HEX.dim, fontStyle: '700',
    });
    const name = this.add.text(tx, top + (compact ? 30 : 38), def.name, {
      fontFamily: FONT_JP, fontSize: compact ? '28px' : '30px', color: unlocked ? COLOR_HEX.white : '#5A6488', fontStyle: '700',
    });
    cont.add([role, name]);

    if (unlocked) {
      const weapon = WEAPONS[def.startWeapon];
      const lines = [`武器『${weapon.name}』／必殺『${def.special.name}』`, `特性：${def.traits.desc}`];
      const desc = this.add.text(tx, top + (compact ? 68 : 78), lines, {
        fontFamily: FONT_JP, fontSize: compact ? '15px' : '16px', color: COLOR_HEX.white, wordWrap: { width: cardW - (tx + cardW / 2) - 20, useAdvancedWrap: true }, lineSpacing: compact ? 3 : 4,
      });
      const hpText = this.add.text(cardW / 2 - 18, top + (compact ? 10 : 14), `HP ${Math.round(def.hp * def.traits.maxHpMul)}  SPD ${def.speed}`, {
        fontFamily: FONT_EN, fontSize: '15px', color: COLOR_HEX.dim, fontStyle: '700',
      }).setOrigin(1, 0);
      cont.add([desc, hpText]);
      if (isNew) {
        // 隠しキャラの印は NEW だけ（説明や案内は出さない）
        const badge = this.add.text(cardW / 2 - 18, top + (compact ? 32 : 38), 'NEW', {
          fontFamily: FONT_EN, fontSize: '18px', color: '#060913', fontStyle: '700', backgroundColor: '#FFD700', padding: { x: 8, y: 2 }, letterSpacing: 2,
        }).setOrigin(1, 0);
        cont.add(badge);
        this.tweens.add({ targets: badge, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    } else {
      const lock = this.add.text(tx, top + (compact ? 72 : 82), `★ ${def.unlockYell} エールで解放（タップでショップへ）`, {
        fontFamily: FONT_JP, fontSize: compact ? '17px' : '18px', color: COLOR_HEX.dim,
      });
      const icon = this.add.text(cardW / 2 - 18, top + (compact ? 10 : 14), 'LOCKED', {
        fontFamily: FONT_EN, fontSize: '16px', color: '#5A6488', fontStyle: '700', letterSpacing: 3,
      }).setOrigin(1, 0);
      cont.add([lock, icon]);
    }

    const hit = this.add.rectangle(0, 0, cardW, cardH, 0xffffff, 0.001).setName('hit');
    hit.setInteractive({ useHandCursor: true });
    cont.add(hit);
    return cont;
  }
}
