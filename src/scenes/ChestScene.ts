import Phaser from 'phaser';
import type { ChestResult } from '../systems/Upgrades';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { SelectGuard } from '../ui/SelectGuard';
import { panel } from '../ui/theme';
import { AudioBus } from '../utils/audio';
import { screenFlash } from '../utils/screenFlash';
import { PORTRAITS, portraitKey } from '../data/portraits';
import { pickLunaLine, type LunaGroup } from '../data/lunaLines';

export interface ChestData {
  /** 開封時に結果を確定する（進化・Lvアップの適用込み） */
  open: () => ChestResult;
  onClose: (r: ChestResult) => void;
  /** 操作キャラ（ルナの台詞の出し分けに使う） */
  characterId?: string;
}

/**
 * 美麗の宝石箱の開封画面。ルナ（チビ）がマスコットとして横にいる。
 * ルナの台詞は data/lunaLines.ts（開封結果に応じてグループを選び、その中からランダムに1つ）。稀に大当たり（報酬3つ）。
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

    // 宝箱：絵（chest.webp・6コマ）があれば、閉じた箱を 1・2 で0.5秒ごとに交互。無ければドット絵
    const chestY = H * 0.36 + 80;
    let chest: Phaser.GameObjects.Image;
    let setChestFrame: ((f: number) => void) | null = null;
    let closedTimer: Phaser.Time.TimerEvent | null = null;
    if (this.textures.exists('chest_box')) {
      const tex = this.textures.get('chest_box');
      if (!tex.has('f1')) {
        const src = tex.getSourceImage() as HTMLImageElement;
        const fw = Math.floor(src.width / 6);
        for (let i = 0; i < 6; i++) tex.add(`f${i + 1}`, 0, i * fw, 0, fw, src.height);
        tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      chest = this.add.image(W / 2, chestY, 'chest_box', 'f1').setOrigin(0.5, 1);
      chest.setScale(200 / chest.width);
      setChestFrame = (f) => chest.setFrame(`f${f}`);
      let closed = 1;
      closedTimer = this.time.addEvent({ delay: 500, loop: true, callback: () => { closed = 3 - closed; chest.setFrame(`f${closed}`); } });
    } else {
      chest = this.add.image(W / 2, chestY, 'item_chest').setOrigin(0.5, 1).setScale(10);
    }
    this.tweens.add({ targets: chest, y: chest.y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // ルナ（チビ）：画像があれば表示、無ければ小さなプレースホルダー
    const lunaX = W / 2 + 190;
    const lunaY = H * 0.36 + 40;
    // 4コマの絵があれば、瞬きをする。大当たりのときは、きらきらの2コマを交互に出す
    let lunaSprite: Phaser.GameObjects.Image | null = null;
    let lunaJackpot = false;
    if (this.textures.exists('luna_chest')) {
      const tex = this.textures.get('luna_chest');
      if (!tex.has('f0')) {
        const src = tex.getSourceImage() as HTMLImageElement;
        const fw = Math.floor(src.width / 4);
        for (let i = 0; i < 4; i++) tex.add(`f${i}`, 0, i * fw, 0, fw, src.height);
        // 大きな絵を縮めて出すので、なめらかに
        tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      const luna = this.add.image(lunaX, lunaY, 'luna_chest', 'f0').setOrigin(0.5, 1);
      luna.setScale(230 / luna.height);
      lunaSprite = luna;
      this.tweens.add({ targets: luna, y: lunaY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const blink = () => {
        if (lunaJackpot) return;
        luna.setFrame('f1');
        this.time.delayedCall(130, () => { if (!lunaJackpot) luna.setFrame('f0'); });
        this.time.delayedCall(Phaser.Math.Between(2200, 4200), blink);
      };
      this.time.delayedCall(1400, blink);
    } else if (this.textures.exists('luna_chibi')) {
      const luna = this.add.image(lunaX, lunaY, 'luna_chibi').setOrigin(0.5, 1);
      const sc = 220 / luna.height;
      luna.setScale(sc);
      this.tweens.add({ targets: luna, y: lunaY - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    } else {
      const ph = this.add.rectangle(lunaX, lunaY, 120, 160, 0x111a3a, 0.6).setOrigin(0.5, 1).setStrokeStyle(2, 0x87ceeb, 0.5);
      this.add.text(ph.x, ph.y - 80, 'LUNA', { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.dim }).setOrigin(0.5);
    }
    // 吹き出し：ルナの足元の下（上は見出しと重なるので、長い台詞が入らない）。宝箱の絵にかからない高さに置き、右端からはみ出さないように折り返す
    const bubbleW = Math.min(340, W - 40);
    const bubble = this.add.text(Math.min(lunaX, W - 20 - bubbleW / 2), lunaY + 52, '…', {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, backgroundColor: '#111A3A', padding: { x: 12, y: 8 },
      align: 'center', wordWrap: { width: bubbleW - 24, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

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
      this.tweens.add({ targets: chest, scaleX: chest.scaleX * 1.2, scaleY: chest.scaleY * 0.8, duration: 90, yoyo: true });
      screenFlash(this, 250, 255, 200, 230);

      // ルナの台詞：合体 → 進化 → 通常 の優先でグループを選ぶ（大当たりのときも、中身でいちばん上のもの）
      const group: LunaGroup = result.rewards.some((r) => r.kind === 'fusion') ? 'fusion' : result.rewards.some((r) => r.kind === 'evolve') ? 'evolve' : 'normal';
      // 宝箱の絵：3（開く途中）を0.15秒 → 4（開いた）。進化・合体・大当たりは 5・6 を0.2秒ごとに交互
      closedTimer?.remove();
      if (setChestFrame) {
        const frame = setChestFrame;
        const big = result.jackpot || group !== 'normal';
        frame(3);
        this.time.delayedCall(150, () => {
          if (!big) { frame(4); return; }
          let f = 5;
          frame(f);
          this.time.addEvent({ delay: 200, loop: true, callback: () => { f = 11 - f; frame(f); } });
        });
      }
      bubble.setText(pickLunaLine(group, data.characterId ?? ''));
      if (result.jackpot) {
        header.setText('大当たり！').setColor('#FFD700');
        headerEn.setText('JACKPOT');
        this.cameras.main.shake(200, 0.006);
        AudioBus.play('se_evolve');
        // ルナ：大当たりの2コマを交互に
        if (lunaSprite) {
          const luna = lunaSprite;
          lunaJackpot = true;
          let f = 0;
          luna.setFrame('f2');
          this.time.addEvent({ delay: 260, loop: true, callback: () => { f = 1 - f; luna.setFrame(f === 0 ? 'f2' : 'f3'); } });
        }
      } else if (group === 'fusion') {
        AudioBus.play('se_fusion', 0, 'se_evolve');
      } else if (group !== 'normal') {
        AudioBus.play('se_evolve');
      }

      // 報酬カード（縦に並べる）
      const cardW = Math.min(600, W - 60);
      const rowH = result.rewards.length > 1 ? 96 : 130;
      let y = H * 0.54;
      result.rewards.forEach((r, i) => {
        const cont = this.add.container(W / 2, y + rowH / 2).setAlpha(0);
        const bg = panel(this, -cardW / 2, -(rowH - 10) / 2, cardW, rowH - 10, { color: r.color, alpha: 0.95, strokeAlpha: 0.9, stripe: 8, wedge: 90 }).gfx;
        const tag = this.add.text(-cardW / 2 + 28, -rowH / 2 + 14, r.kind === 'fusion' ? 'FUSION' : r.kind === 'evolve' ? 'EVOLVE' : r.kind === 'weapon' ? 'ARTS' : r.kind === 'passive' ? 'SUPPORT' : 'YELL', {
          fontFamily: FONT_EN, fontSize: '14px', color: '#060913', backgroundColor: Phaser.Display.Color.IntegerToColor(r.color).rgba, fontStyle: '700', padding: { x: 6, y: 1 },
        });
        const title = this.add.text(-cardW / 2 + 28, -rowH / 2 + 38, r.title, {
          fontFamily: FONT_JP, fontSize: r.kind === 'evolve' || r.kind === 'fusion' ? '30px' : '26px', color: r.kind === 'evolve' || r.kind === 'fusion' ? '#FFD700' : COLOR_HEX.white, fontStyle: '700',
        });
        const sub = this.add.text(cardW / 2 - 20, -rowH / 2 + 40, r.sub, {
          fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
        }).setOrigin(1, 0);
        cont.add([bg, tag, title, sub]);
        // 合体：素材2人の顔を並べる
        if (r.kind === 'fusion' && r.owners) {
          r.owners.forEach((owner, k) => {
            const id = PORTRAITS[owner];
            const key = id ? portraitKey(id) : '';
            if (!key || !this.textures.exists(key)) return;
            const fr = 26;
            const fx = cardW / 2 - 40 - k * 64;
            const fy = rowH / 2 - 34;
            const face = this.add.image(fx, fy, key).setDisplaySize(fr * 2.2, fr * 2.2);
            const m = this.make.graphics({ x: 0, y: 0 }, false);
            m.fillStyle(0xffffff, 1);
            m.fillCircle(fx, fy, fr);
            face.setMask(m.createGeometryMask());
            const ring = this.add.graphics();
            ring.lineStyle(2, r.color, 1);
            ring.strokeCircle(fx, fy, fr + 1);
            cont.add([face, ring]);
            const sync = () => m.setPosition(cont.x, cont.y);
            this.events.on(Phaser.Scenes.Events.UPDATE, sync);
            cont.once(Phaser.GameObjects.Events.DESTROY, () => { this.events.off(Phaser.Scenes.Events.UPDATE, sync); m.destroy(); });
          });
        }
        if (r.desc && result!.rewards.length === 1) {
          cont.add(this.add.text(-cardW / 2 + 28, -rowH / 2 + 78, r.desc, {
            fontFamily: FONT_JP, fontSize: '17px', color: COLOR_HEX.white, wordWrap: { width: cardW - 56, useAdvancedWrap: true },
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
