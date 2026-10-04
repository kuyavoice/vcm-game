import Phaser from 'phaser';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { SelectGuard } from '../ui/SelectGuard';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel, UI, type Panel } from '../ui/theme';
import { t } from '../utils/lang';
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
    wipeIn(this, { cascade: false });
    AudioBus.leaveGameOver();

    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);
    const onResize = () => bg.setSize(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.events.on('update', () => { bg.tilePositionY -= 0.15; });

    this.add.text(W / 2, H * 0.09, 'SELECT CHARACTER', {
      fontFamily: FONT_EN, fontSize: '50px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.09 + 46, t('誰の声で、夜を渡る？', 'Whose voice will carry you through the night?'), {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const save = loadSave();
    const guard = new SelectGuard(this);
    const order = visibleCharacters(save);
    // 5人以上を並べるときは、カードを少し詰める
    const compact = order.length >= 5;
    const cardW = Math.min(640, W - 40);
    // 2026-10-05 磨き B：カードは1行（名前・クラス・HP/SPD/ATK のゲージ）。選んだキャラの詳しい説明は立ち絵の下に出す
    const cardH = compact ? 96 : 108;
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
    const picH = avail - 44;
    const portrait = this.add.image(W / 2, headerBottom + picH / 2, '__DEFAULT').setVisible(false);
    // 選んだキャラの説明（武器・必殺・特性）。立ち絵の下
    const detail = this.add.text(W / 2, cardsTop - 26, '', {
      fontFamily: FONT_JP, fontSize: '15px', color: COLOR_HEX.white, align: 'center', lineSpacing: 4, wordWrap: { width: Math.min(640, W - 40), useAdvancedWrap: true },
    }).setOrigin(0.5, 1);
    const showDetail = (id: string) => {
      const def = CHARACTERS[id];
      const weapon = WEAPONS[def.startWeapon];
      detail.setText(isCharacterUnlocked(id, save) ? `武器『${weapon.name}』／必殺『${def.special.name}』\n特性：${def.traits.desc}` : `★ ${def.unlockYell} エールで解放`);
    };
    const setPortrait = (id: string) => {
      const key = `portrait_${id}`;
      if (!this.textures.exists(key)) { portrait.setVisible(false); return; }
      portrait.setTexture(key);
      // 4倍まで（整数倍。最近傍は pixelArt 設定で全体に効く）。狭ければ 3倍 → 2倍
      const sc = portrait.height * 4 <= picH ? 4 : portrait.height * 3 <= picH ? 3 : 2;
      portrait.setScale(sc).setVisible(true);
    };
    let wiping = false;
    /** 立ち絵の切り替え：斜めの覆いが立ち絵の範囲を左から右へ走り、隠れた瞬間に絵を替える */
    const showPortrait = (id: string, animate = false) => {
      showDetail(id);
      if (!animate || wiping) { setPortrait(id); return; }
      wiping = true;
      const k = 60;
      const y0 = headerBottom - 10;
      const h = avail + 10;
      const g = this.add.graphics().setDepth(5);
      g.fillStyle(0x060913, 0.96);
      g.fillPoints([new Phaser.Math.Vector2(k, y0), new Phaser.Math.Vector2(W + k * 2, y0), new Phaser.Math.Vector2(W + k, y0 + h), new Phaser.Math.Vector2(0, y0 + h)], true);
      g.fillStyle(CHARACTERS[id].color, 1);
      g.fillPoints([new Phaser.Math.Vector2(k - 8, y0), new Phaser.Math.Vector2(k, y0), new Phaser.Math.Vector2(0, y0 + h), new Phaser.Math.Vector2(-8, y0 + h)], true);
      g.fillPoints([new Phaser.Math.Vector2(W + k * 2, y0), new Phaser.Math.Vector2(W + k * 2 + 8, y0), new Phaser.Math.Vector2(W + k + 8, y0 + h), new Phaser.Math.Vector2(W + k, y0 + h)], true);
      g.setX(-(W + k * 2) - 10);
      this.tweens.add({ targets: g, x: 0, duration: 110, ease: 'Cubic.in', onComplete: () => {
        setPortrait(id);
        this.tweens.add({ targets: g, x: W + k * 2 + 10, duration: 150, ease: 'Cubic.out', onComplete: () => { g.destroy(); wiping = false; } });
      } });
    };
    // 出現演出がまだの隠しキャラが選択中でも、演出が終わるまでは立ち絵を出さない
    let current = isSecretPending(selected, save) ? order[0] : selected;
    showPortrait(current);
    const cards = new Map<string, Panel>();
    const markSelected = () => {
      for (const [id, p] of cards) {
        const on = id === current;
        const def = CHARACTERS[id];
        const unlocked = isCharacterUnlocked(id, save);
        p.redraw({ stroke: on ? 0xffffff : unlocked ? def.color : UI.dim, strokeAlpha: on ? 1 : unlocked ? 0.9 : 0.5, strokeWidth: on ? 3 : 2 });
      }
    };

    order.forEach((id, i) => {
      const def = CHARACTERS[id];
      const unlocked = isCharacterUnlocked(id, save);
      const pending = !!def.secret && isSecretPending(id, save);
      const cont = this.buildCard(def, unlocked, cardW, cardH, compact, hasNewBadge(id, save));
      cards.set(id, cont.getData('panel') as Panel);
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
        if (guard.armed) cont.setScale(0.98);
      });
      hit.on('pointerup', () => {
        cont.setScale(1);
        if (!ready || !guard.release(hit)) return;
        if (!unlocked) { go(this, 'Shop'); return; }
        if (id === current) { this.choose(id); return; }
        // 1回目：選ぶ（立ち絵が斜めワイプで替わる）。もう一度タップで決定
        current = id;
        const sv = loadSave();
        sv.settings.character = id;
        writeSave(sv);
        AudioBus.play('se_item', 60);
        showPortrait(id, true);
        markSelected();
        // 決定ではないので、ガードを戻して次のタップを受け付ける
        guard.reset();
      });
      y += cardH + gap;
    });

    markSelected();
    this.add.text(W / 2, cardsTop + total + 14, t('選択中のカードをもう一度タップで決定', 'Tap the selected card again to confirm'), { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim }).setOrigin(0.5, 0);

    const by = buttonsY;
    makeButton(this, W / 2 - 140, by, 'TITLE', () => go(this, 'Title'), { width: 240, height: 60, fontSize: 24 });
    makeButton(this, W / 2 + 140, by, `★ SHOP  ${save.totalYell}`, () => go(this, 'Shop'), { width: 240, height: 60, fontSize: 22, primary: true });

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
    go(this, 'StageSelect');
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

  /** カード（1行）：顔／クラス・名前／右に HP・SPD・ATK のゲージ。選択中の枠は create() 側が redraw で白くする */
  private buildCard(def: CharacterDef, unlocked: boolean, cardW: number, cardH: number, compact = false, isNew = false): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);
    const color = unlocked ? def.color : 0x3a4a8a;
    const p = panel(this, -cardW / 2, -cardH / 2, cardW, cardH, { color, alpha: 1, strokeAlpha: unlocked ? 0.9 : 0.5, stripe: 8, shadow: true, wedge: 90 });
    cont.add(p.gfx);
    cont.setData('panel', p);

    // 顔（円マスク）
    const faceId = PORTRAITS[def.name];
    const key = faceId ? portraitKey(faceId) : '';
    const r = compact ? 32 : 36;
    const fx = -cardW / 2 + 24 + r;
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
    const tx = fx + r + 16;
    const role = this.add.text(tx, top + (compact ? 12 : 16), def.role, {
      fontFamily: FONT_JP, fontSize: '14px', color: unlocked ? Phaser.Display.Color.IntegerToColor(def.color).rgba : COLOR_HEX.dim, fontStyle: '700',
    });
    const name = this.add.text(tx, top + (compact ? 32 : 38), def.name, {
      fontFamily: FONT_JP, fontSize: compact ? '26px' : '28px', color: unlocked ? COLOR_HEX.white : '#5A6488', fontStyle: '700',
    });
    cont.add([role, name]);

    // 右：ゲージ3本（HP／SPD／ATK）。値の幅：HP 60〜140、SPD 110〜160、ATK 0.7〜1.5
    const gx = cardW / 2 - 18 - 150;
    const barW = 110;
    const hp = Math.round(def.hp * def.traits.maxHpMul);
    const atk = def.traits.damageMul + def.traits.resonanceArtsPower * 0.6 + (def.traits.meleePower - 1) * 0.5;
    const gauges: [string, number][] = [
      ['HP', Phaser.Math.Clamp((hp - 60) / 80, 0.08, 1)],
      ['SPD', Phaser.Math.Clamp((def.speed - 110) / 50, 0.08, 1)],
      ['ATK', Phaser.Math.Clamp((atk - 0.7) / 0.8, 0.08, 1)],
    ];
    const gh = compact ? 22 : 24;
    const gy0 = -((gauges.length - 1) * gh) / 2;
    const bars = this.add.graphics();
    gauges.forEach(([label, ratio], i) => {
      const y = gy0 + i * gh;
      cont.add(this.add.text(gx, y, label, { fontFamily: FONT_EN, fontSize: '12px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 1 }).setOrigin(0, 0.5));
      bars.fillStyle(0x000000, 0.45);
      bars.fillRect(gx + 36, y - 4, barW, 8);
      bars.fillStyle(unlocked ? def.color : 0x3a4a8a, unlocked ? 0.95 : 0.5);
      bars.fillRect(gx + 36, y - 4, Math.round(barW * ratio), 8);
    });
    cont.add(bars);

    if (!unlocked) {
      const icon = this.add.text(cardW / 2 - 18, top + 10, 'LOCKED', {
        fontFamily: FONT_EN, fontSize: '14px', color: '#5A6488', fontStyle: '700', letterSpacing: 3,
      }).setOrigin(1, 0);
      cont.add(icon);
    } else if (isNew) {
      // 隠しキャラの印は NEW だけ（説明や案内は出さない）
      const badge = this.add.text(cardW / 2 - 18, top + 8, 'NEW', {
        fontFamily: FONT_EN, fontSize: '15px', color: '#060913', fontStyle: '700', backgroundColor: '#FFD700', padding: { x: 6, y: 1 }, letterSpacing: 2,
      }).setOrigin(1, 0);
      cont.add(badge);
      this.tweens.add({ targets: badge, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    const hit = this.add.rectangle(0, 0, cardW, cardH, 0xffffff, 0.001).setName('hit');
    hit.setInteractive({ useHandCursor: true });
    cont.add(hit);
    return cont;
  }
}
