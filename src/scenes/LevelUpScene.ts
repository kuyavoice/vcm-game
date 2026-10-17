import Phaser from 'phaser';
import type { Choice } from '../systems/Upgrades';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { SelectGuard } from '../ui/SelectGuard';
import { loadSave, writeSave } from '../utils/storage';
import { makeButton } from '../ui/Button';
import { panel, type Panel } from '../ui/theme';
import { t } from '../utils/lang';
import { td } from '../data/descEn';
import { PORTRAITS, portraitKey } from '../data/portraits';
import type { LoadoutRow } from './PauseScene';

export interface LevelUpData {
  level: number;
  choices: Choice[];
  onPick: (c: Choice) => void;
  /** 便利アイテム（エールで購入した回数）。使うと消費 */
  reroll?: () => Choice[];
  skip?: () => void;
  ban?: (c: Choice) => Choice[];
  /** いまの手持ち（2026-10-18 ユーザー要望：選ぶときにビルドが分かるように） */
  build?: { weapons: LoadoutRow[]; passives: LoadoutRow[] };
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
    this.add.text(W / 2, H * 0.14 + 52, `Lv ${data.level}　${t('仲間の力を借りる', 'Borrow a friend\'s power')}`, {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    const cardW = Math.min(640, W - 40);

    // いまの手持ち：見出しの下に2段（上＝初期武器と共鳴アーツ、下＝サポート）。名前と Lv の小さなチップ
    const buildGroup = this.add.container(0, 0);
    let stripBottom = 0;
    if (data.build && (data.build.weapons.length || data.build.passives.length)) {
      const stripW = cardW;
      const left = W / 2 - stripW / 2;
      const chipH = 30;
      // 1行に最大4つ（名前が読める幅を保つ）。5つ以上は2行に
      const PER_ROW = 4;
      const drawRow = (all: LoadoutRow[], ry0: number, label: string): number => {
        if (!all.length) return ry0;
        let ry = ry0;
        for (let start = 0; start < all.length; start += PER_ROW) {
          const rows = all.slice(start, start + PER_ROW);
          if (start === 0) {
            const lab = this.add.text(left, ry + chipH / 2, label, { fontFamily: FONT_EN, fontSize: '12px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 1 }).setOrigin(0, 0.5);
            buildGroup.add(lab);
          }
          const x0 = left + 64;
          const gap = 6;
          const chipW = (stripW - 64 - gap * (PER_ROW - 1)) / PER_ROW;
          rows.forEach((r, i) => {
            const x = x0 + i * (chipW + gap);
          const maxed = r.level >= r.max;
          const p = panel(this, x, ry, chipW, chipH, { color: r.color, alpha: 0.92, stroke: maxed || r.evolved || r.fusion ? 0xffd700 : r.color, strokeWidth: 1, strokeAlpha: maxed || r.evolved || r.fusion ? 0.9 : 0.5, stripe: 4, cut: 8 });
          buildGroup.add(p.gfx);
          const lv = r.fusion ? 'FUS' : r.evolved ? 'EVO' : `${r.level}`;
          const lvText = this.add.text(x + chipW - 6, ry + chipH / 2, lv, { fontFamily: FONT_EN, fontSize: '13px', color: maxed || r.evolved || r.fusion ? COLOR_HEX.gold : COLOR_HEX.white, fontStyle: '700' }).setOrigin(1, 0.5);
          buildGroup.add(lvText);
          const nameW = chipW - 12 - lvText.width - 4;
          const name = this.add.text(x + 10, ry + chipH / 2, r.name, { fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.white, fontStyle: '700' }).setOrigin(0, 0.5);
          // 長い名前は末尾を落とす
          let txt = r.name;
          while (name.width > nameW && txt.length > 2) { txt = txt.slice(0, -1); name.setText(`${txt}…`); }
          buildGroup.add(name);
          });
          ry += chipH + 6;
        }
        return ry;
      };
      const top = H * 0.14 + 84;
      const afterArts = drawRow(data.build.weapons, top, 'ARTS');
      stripBottom = drawRow(data.build.passives, afterArts, 'SUPPORT');
    }

    // 4択（詩音の固有パッシブ）のときは詰めて並べる
    const compact = data.choices.length >= 4;
    const cardH = compact ? 164 : 190;
    const gap = compact ? 14 : 22;
    const total = data.choices.length * cardH + (data.choices.length - 1) * gap;
    // カードは中央寄せ。手持ちの帯が長いときは、その下から
    let y = Math.max(H / 2 - total / 2 + cardH / 2 + 20, stripBottom + 10 + cardH / 2);

    // 誤タップ対策：全指が離れる＋0.3秒待ち＋押し始めと離した位置が同じカード
    const guard = new SelectGuard(this);
    let picked = false;
    const cards: Panel[] = [];
    const hits: Phaser.GameObjects.Rectangle[] = [];
    const conts: Phaser.GameObjects.Container[] = [];
    // キーボードのカーソル（−1＝まだ選んでいない。移動キーを押すまで、決定キーは効かない）
    let cursor = -1;
    let hover = -1;
    const paint = () => {
      cards.forEach((card, i) => {
        if (i === cursor) card.redraw({ stroke: 0xffffff, strokeWidth: 4, strokeAlpha: 1 });
        else if (i === hover) card.redraw({ stroke: 0xffffff, strokeWidth: 3, strokeAlpha: 1 });
        else card.redraw({ stroke: 0x87ceeb, strokeWidth: 2, strokeAlpha: 0.5 });
        conts[i].setScale(i === cursor ? 1.02 : 1);
      });
    };
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
      const card = panel(this, -cardW / 2, -cardH / 2, cardW, cardH, { color: c.color, alpha: 1, stroke: 0x87ceeb, strokeAlpha: 0.5, stripe: 10, shadow: true, wedge: compact ? 96 : 110 });
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0xffffff, 0.001);
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
      const desc = this.add.text(tx, -cardH / 2 + (compact ? 92 : 100), td(c.desc), {
        fontFamily: FONT_JP, fontSize: compact ? '20px' : '22px', color: COLOR_HEX.white, wordWrap: { width: cardW / 2 - 24 - tx, useAdvancedWrap: true },
      }).setOrigin(0, 0);
      cont.add([card.gfx, bg, tag, title, owner, desc]);
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

      cards.push(card);
      hits.push(bg);
      conts.push(cont);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { hover = i; paint(); });
      bg.on('pointerout', () => { if (hover === i) hover = -1; paint(); });
      bg.on('pointerdown', () => {
        guard.press(bg);
        if (guard.armed) cont.setScale(0.98);
      });
      bg.on('pointerup', () => {
        cont.setScale(i === cursor ? 1.02 : 1);
        if (banMode) return;
        if (guard.release(bg)) decide(c, cont);
      });
      y += cardH + gap;
    });

    // 便利アイテム（リロール／スキップ／除外）
    const sv = loadSave();
    const cnt = sv.consumables;
    let banMode = false;
    const banHint = this.add.text(W / 2, H * 0.14 + 84 + 32, '', { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.danger, fontStyle: '700' }).setOrigin(0.5);
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
        buildGroup.setVisible(!banMode);
      }, { width: 200, height: 56, fontSize: 20, primary: cnt.ban > 0 });
    }
    // 除外モード中はカードのタップで除外→その枠だけ引き直し
    const banAt = (idx: number) => {
      if (!banMode || picked || idx < 0) return;
      if (!useItem('ban')) return;
      picked = true;
      this.scene.restart({ ...data, choices: data.ban!(data.choices[idx]) });
    };
    this.input.on('gameobjectup', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      banAt(hits.indexOf(obj as Phaser.GameObjects.Rectangle));
    });

    // PC：移動キー（W／S・↑／↓）でカーソルを動かし、スペースか Enter で決定。
    // 押しっぱなしの移動キーや、必殺のつもりで押したスペースで誤って選ばないように、
    // 押しっぱなしの繰り返しは無視し、カーソルを動かすまで決定キーは効かない
    if (this.sys.game.device.os.desktop) {
      this.add.text(W / 2, Math.min(H - 56, by + 52), 'W・S ／ ↑・↓ で選ぶ　　SPACE で決定　　（数字キーでも選べる）', {
        fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim,
      }).setOrigin(0.5);
    }
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat || picked) return;
      const k = ev.key;
      const up = k === 'ArrowUp' || k === 'w' || k === 'W';
      const down = k === 'ArrowDown' || k === 's' || k === 'S';
      if (up || down) {
        if (!guard.armed) return;
        const n = data.choices.length;
        cursor = cursor < 0 ? (down ? 0 : n - 1) : (cursor + (down ? 1 : n - 1)) % n;
        paint();
        return;
      }
      if (k === ' ' || k === 'Enter') {
        if (cursor < 0) return;
        if (banMode) banAt(cursor);
        else if (guard.confirm()) decide(data.choices[cursor], conts[cursor]);
      }
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
