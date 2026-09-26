import Phaser from 'phaser';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters';
import { PERMANENT, CONSUMABLES } from '../data/shop';
import { COLOR_VARIANTS } from '../data/colors';
import { ensureColorVariant } from '../utils/recolor';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { makeButton } from '../ui/Button';
import { AudioBus } from '../utils/audio';

/**
 * エールショップ：貯めたエールで「キャラ解放」と「永続強化（控えめ・5段階）」を買う。
 * エール = ランで拾った★の累計（リザルトで加算）。
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(200, 6, 9, 19);
    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);
    const onResize = () => bg.setSize(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));

    const save = loadSave();
    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'YELL SHOP', {
      fontFamily: FONT_EN, fontSize: '48px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5);
    this.add.text(W / 2, top + 44, 'エールを送る —— 集めた声援で、夜に備える', {
      fontFamily: FONT_JP, fontSize: '19px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);
    const wallet = this.add.text(W / 2, top + 84, `★ ${save.totalYell}`, {
      fontFamily: FONT_EN, fontSize: '36px', color: COLOR_HEX.gold, fontStyle: '700',
    }).setOrigin(0.5);

    const left = 28;
    const rowW = W - left * 2;
    let y = top + 130;

    const section = (label: string) => {
      this.add.text(left, y, label, { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 3 });
      y += 34;
    };
    const flash = (text: string, color: string) => {
      const t = this.add.text(W / 2, H * 0.5, text, {
        fontFamily: FONT_JP, fontSize: '30px', color, fontStyle: '700', stroke: '#060913', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 900, delay: 300, onComplete: () => t.destroy() });
    };
    let buying = false;
    const buy = (cost: number, mutate: (sv: ReturnType<typeof loadSave>) => void, label: string) => {
      if (buying) return;
      const sv = loadSave();
      if (sv.totalYell < cost) {
        flash('エールが足りない', COLOR_HEX.danger);
        return;
      }
      buying = true;
      sv.totalYell -= cost;
      mutate(sv);
      writeSave(sv);
      AudioBus.play('se_item');
      flash(label, COLOR_HEX.gold);
      this.time.delayedCall(350, () => this.scene.restart());
    };

    // ── キャラ解放 ──
    section('CHARACTERS');
    for (const id of CHARACTER_ORDER) {
      const def = CHARACTERS[id];
      if (def.unlockYell === 0) continue;
      const owned = save.unlockedCharacters.includes(id);
      const rowH = 64;
      this.add.rectangle(left, y, rowW, rowH, 0x111a3a, 0.9).setOrigin(0).setStrokeStyle(2, owned ? def.color : 0x3a4a8a, 0.7);
      this.add.rectangle(left + 4, y + 6, 6, rowH - 12, def.color, 1).setOrigin(0);
      this.add.text(left + 22, y + 10, def.name, { fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 22, y + 38, `${def.role}　${def.traits.desc}`, { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim });
      if (owned) {
        this.add.text(left + rowW - 16, y + rowH / 2, 'UNLOCKED', { fontFamily: FONT_EN, fontSize: '18px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 2 }).setOrigin(1, 0.5);
      } else {
        makeButton(this, left + rowW - 16 - 80, y + rowH / 2, `★ ${def.unlockYell}`, () => {
          buy(def.unlockYell, (sv) => {
            if (!sv.unlockedCharacters.includes(id)) sv.unlockedCharacters.push(id);
          }, `${def.name} 解放！`);
        }, { width: 160, height: 46, fontSize: 20, primary: save.totalYell >= def.unlockYell });
      }
      y += rowH + 10;
    }

    // ── 永続強化 ──
    y += 12;
    section('PERMANENT');
    for (const up of PERMANENT) {
      const lv = save.permanent[up.id] ?? 0;
      const maxed = lv >= up.maxLevel;
      const cost = maxed ? 0 : up.costs[lv];
      const rowH = 64;
      this.add.rectangle(left, y, rowW, rowH, 0x111a3a, 0.9).setOrigin(0).setStrokeStyle(2, maxed ? 0xffd700 : 0x3a4a8a, 0.7);
      this.add.text(left + 18, y + 9, up.name, { fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 18, y + 38, up.desc, { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim });
      // Lvピップ
      const px = left + 250;
      for (let i = 0; i < up.maxLevel; i++) {
        this.add.rectangle(px + i * 22, y + 20, 16, 12, i < lv ? 0x87ceeb : 0x000000, i < lv ? 1 : 0.5).setOrigin(0, 0.5).setStrokeStyle(1, 0x87ceeb, 0.6);
      }
      if (maxed) {
        this.add.text(left + rowW - 16, y + rowH / 2, 'MAX', { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.gold, fontStyle: '700', letterSpacing: 2 }).setOrigin(1, 0.5);
      } else {
        makeButton(this, left + rowW - 16 - 80, y + rowH / 2, `★ ${cost}`, () => {
          buy(cost, (sv) => {
            sv.permanent[up.id] = (sv.permanent[up.id] ?? 0) + 1;
          }, `${up.name} Lv${lv + 1}`);
        }, { width: 160, height: 46, fontSize: 20, primary: save.totalYell >= cost });
      }
      y += rowH + 10;
    }

    // ── 便利アイテム（レベルアップ時） ──
    y += 12;
    section('ITEMS');
    for (const it of CONSUMABLES) {
      const have = save.consumables[it.id];
      const rowH = 64;
      this.add.rectangle(left, y, rowW, rowH, 0x111a3a, 0.9).setOrigin(0).setStrokeStyle(2, 0x3a4a8a, 0.7);
      this.add.text(left + 18, y + 9, `${it.name}　×${have}`, { fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 18, y + 38, it.desc, { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim });
      makeButton(this, left + rowW - 16 - 80, y + rowH / 2, `★ ${it.cost}`, () => {
        buy(it.cost, (sv) => { sv.consumables[it.id]++; }, `${it.name} +1`);
      }, { width: 160, height: 46, fontSize: 20, primary: save.totalYell >= it.cost });
      y += rowH + 10;
    }

    // ── カラーバリエーション（選択中のキャラ） ──
    y += 12;
    const charaId = CHARACTERS[save.settings.character] ? save.settings.character : 'kuya';
    const chara = CHARACTERS[charaId];
    const variants = COLOR_VARIANTS[charaId] ?? [];
    section(`COLORS — ${chara.name}`);
    const owned = save.colors[charaId] ?? [];
    const selected = save.colorSelected[charaId] ?? '';
    const colorRow = (id: string, name: string, cost: number, key: string) => {
      const rowH = 64;
      const isSel = selected === id;
      this.add.rectangle(left, y, rowW, rowH, 0x111a3a, 0.9).setOrigin(0).setStrokeStyle(2, isSel ? 0x87ceeb : 0x3a4a8a, 0.8);
      // プレビュー（待機1コマ目・2倍）
      if (this.textures.exists(key)) this.add.image(left + 40, y + rowH / 2 + 6, key, chara.sprite.frames.idle[0]).setScale(1.2).setOrigin(0.5, 0.6);
      this.add.text(left + 80, y + 10, name, { fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 80, y + 38, isSel ? '使用中' : owned.includes(id) || id === '' ? '所持' : `★ ${cost} で購入`, { fontFamily: FONT_JP, fontSize: '14px', color: isSel ? COLOR_HEX.accent : COLOR_HEX.dim });
      if (isSel) {
        this.add.text(left + rowW - 16, y + rowH / 2, 'SELECTED', { fontFamily: FONT_EN, fontSize: '18px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 2 }).setOrigin(1, 0.5);
      } else if (owned.includes(id) || id === '') {
        makeButton(this, left + rowW - 16 - 80, y + rowH / 2, 'USE', () => {
          const sv = loadSave();
          if (id) sv.colorSelected[charaId] = id;
          else delete sv.colorSelected[charaId];
          writeSave(sv);
          this.scene.restart();
        }, { width: 160, height: 46, fontSize: 20 });
      } else {
        makeButton(this, left + rowW - 16 - 80, y + rowH / 2, `★ ${cost}`, () => {
          buy(cost, (sv) => {
            sv.colors[charaId] = [...(sv.colors[charaId] ?? []), id];
            sv.colorSelected[charaId] = id;
          }, `${name} を入手`);
        }, { width: 160, height: 46, fontSize: 20, primary: save.totalYell >= cost });
      }
      y += rowH + 10;
    };
    colorRow('', '標準', 0, chara.sprite.key);
    for (const v of variants) colorRow(v.id, v.name, v.cost, ensureColorVariant(this, chara, v.id));

    makeButton(this, W / 2, y + 60, 'BACK', () => this.scene.start('CharaSelect'), { width: 240, height: 60, fontSize: 24 });
    void wallet;

    // 縦スクロール（ドラッグ／ホイール）。内容が画面より長い端末向け
    const contentH = y + 130;
    const maxScroll = Math.max(0, contentH - H);
    let dragY: number | null = null;
    let dragStart = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; dragStart = cam.scrollY; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === null || !p.isDown) return;
      cam.scrollY = Phaser.Math.Clamp(dragStart - (p.y - dragY), 0, maxScroll);
      bg.tilePositionY = cam.scrollY * 0.3;
    });
    const endDrag = () => { dragY = null; };
    this.input.on('pointerup', endDrag);
    this.input.on('pointerupoutside', endDrag);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.6, 0, maxScroll);
    });
    bg.setScrollFactor(0);
  }
}
