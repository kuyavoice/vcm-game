import Phaser from 'phaser';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters';
import { CODEX_CHARACTERS } from '../data/codex';
import { ACHIEVEMENTS, codexFound, codexTotal } from '../data/achievements';
import { BOND_RELAX_LEVEL, bondLevel } from '../data/bond';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, type SaveData } from '../utils/storage';
import { OPTIONAL_IMAGES, hasOptionalImage } from '../utils/optionalAssets';
import { isCharacterUnlocked } from '../utils/unlock';
import { AudioBus } from '../utils/audio';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel as uiPanel } from '../ui/theme';
import { t } from '../utils/lang';
import { visibleGallery } from './GalleryScene';
import { visibleMusic } from './MusicScene';

/** 推し（絆が一番高いキャラ）が出る重み */
const FAVORITE_WEIGHT = 3;

/**
 * EXTRA（拠点＝作戦室。2026-10-15 ユーザー承認「A案・案1」）。
 * タイトルの EXTRA から入る。作戦室の絵の上に、解放済みのキャラが1人ランダムで迎える（絆が一番高い推しは出やすい。隠しキャラは解放後だけ）。
 * 図鑑・実績・ギャラリー・ミュージック・作戦室（エールを贈る）への入口と、それぞれの進捗。各画面の「戻る」はここへ。
 */
export class LobbyScene extends Phaser.Scene {
  private charaId = 'kuya';
  private chara?: Phaser.GameObjects.Image;

  constructor() {
    super('Lobby');
  }

  /** 迎えるキャラを選ぶ：解放済みから。絆が一番高いキャラは出やすい */
  private pickCharacter(save: SaveData): string {
    const ids = CHARACTER_ORDER.filter((id) => isCharacterUnlocked(id, save));
    if (ids.length === 0) return 'kuya';
    let fav = '';
    let favBond = 0;
    for (const id of ids) {
      const b = save.bond[id] ?? 0;
      if (b > favBond) { favBond = b; fav = id; }
    }
    const weights = ids.map((id) => (id === fav ? FAVORITE_WEIGHT : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ids.length; i++) {
      r -= weights[i];
      if (r < 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const save = loadSave();
    this.charaId = this.pickCharacter(save);
    const wide = W / H > 1.0;
    const bgKey = wide && hasOptionalImage('room_wide') ? 'room_wide' : 'room';
    const lv = bondLevel(save.bond[this.charaId] ?? 0);
    const charKey = lv >= BOND_RELAX_LEVEL && hasOptionalImage(`relax_${this.charaId}`) ? `relax_${this.charaId}` : `standing_${this.charaId}`;
    const need = [bgKey, charKey].filter((k) => !this.textures.exists(k) && hasOptionalImage(k));
    for (const k of need) this.load.image(k, OPTIONAL_IMAGES[k]);
    if (need.length) {
      this.load.once('complete', () => { if (this.scene.isActive()) this.build(W, H, save, bgKey, charKey); });
      this.load.start();
    } else {
      this.build(W, H, save, bgKey, charKey);
    }
  }

  private build(W: number, H: number, save: SaveData, bgKey: string, charKey: string): void {
    const wide = W / H > 1.0;
    const def = CHARACTERS[this.charaId];
    const color = def?.color ?? 0x87ceeb;
    // 作戦室
    if (this.textures.exists(bgKey)) {
      this.textures.get(bgKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const tex = this.textures.get(bgKey).getSourceImage() as HTMLImageElement;
      const cover = Math.max(W / tex.width, H / tex.height);
      this.add.image(W / 2, H / 2, bgKey).setScale(cover).setDepth(-10);
    } else {
      this.add.rectangle(0, 0, W, H, 0x0b1026).setOrigin(0).setDepth(-10);
    }
    // 少し落として、カードの文字を読みやすく
    this.add.rectangle(0, 0, W, H, 0x060913, 0.28).setOrigin(0).setDepth(-9);

    // 迎えるキャラ：縦はバストアップで右寄り、横は全身で中央右。タップで作戦室（エールを贈る）
    const bottomY = H - 110;
    if (this.textures.exists(charKey)) {
      this.textures.get(charKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (!wide) {
        const topY = 96;
        this.chara = this.add.image(W * 0.74, topY, charKey).setOrigin(0.5, 0).setDepth(-6);
        const s = (bottomY + 60 - topY) / (this.chara.height * 0.6);
        this.chara.setScale(s);
      } else {
        const cx = W * 0.64;
        this.chara = this.add.image(cx, bottomY + 30, charKey).setOrigin(0.5, 1).setDepth(-6);
        const s = Math.min((bottomY + 20) / this.chara.height, (W * 0.5) / this.chara.width);
        this.chara.setScale(s);
      }
      this.chara.setAlpha(0);
      this.tweens.add({ targets: this.chara, alpha: 1, duration: 420, ease: 'Cubic.out' });
      const hit = this.add.zone(this.chara.x - this.chara.displayWidth / 2, this.chara.y - (wide ? this.chara.displayHeight : 0), this.chara.displayWidth, Math.min(this.chara.displayHeight, H)).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => go(this, 'YellRoom', { id: this.charaId, from: 'Lobby' }));
      // 迎えのひとこと：キャラ選択のボイス
      AudioBus.voice(this.charaId, 'select');
    }

    // 見出し・所持エール
    const left = 20;
    this.add.text(left, 16, 'EXTRA', { fontFamily: FONT_EN, fontSize: '34px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5, stroke: '#060913', strokeThickness: 5 });
    this.add.text(left, 58, t('作戦室 ― 仲間と記録の部屋', 'Operations room'), { fontFamily: FONT_JP, fontSize: '15px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 4 });
    this.add.text(W - 20, 22, `★ ${save.totalYell.toLocaleString()}`, { fontFamily: FONT_EN, fontSize: '24px', color: COLOR_HEX.gold, fontStyle: '700', stroke: '#060913', strokeThickness: 5 }).setOrigin(1, 0);

    // 入口のカード
    const name = CODEX_CHARACTERS.find((c) => c.id === this.charaId)?.name ?? def?.name ?? '';
    const favLv = bondLevel(save.bond[this.charaId] ?? 0);
    const gal = visibleGallery(save);
    const mus = visibleMusic(save);
    const cards: { title: string; sub: string; color: number; run: () => void }[] = [
      { title: t('図鑑', 'CODEX'), sub: t(`共鳴アーツ・サポート ${codexFound(save)} / ${codexTotal()}`, `Arts & supports ${codexFound(save)} / ${codexTotal()}`), color: 0x87ceeb, run: () => go(this, 'Codex', { tab: 'arts' }) },
      { title: t('実績', 'ACHIEVEMENTS'), sub: t(`解除 ${save.achievements.length} / ${ACHIEVEMENTS.length}`, `Unlocked ${save.achievements.length} / ${ACHIEVEMENTS.length}`), color: 0xffd700, run: () => go(this, 'Codex', { tab: 'achv' }) },
    ];
    if (gal.length > 0) cards.push({ title: t('ギャラリー', 'GALLERY'), sub: t(`解放 ${gal.filter((g) => g.price === 0 || save.gallery.includes(g.id)).length} / ${gal.length}`, `Unlocked ${gal.filter((g) => g.price === 0 || save.gallery.includes(g.id)).length} / ${gal.length}`), color: 0xffb7c5, run: () => go(this, 'Gallery') });
    if (mus.length > 0) cards.push({ title: t('ミュージック', 'MUSIC'), sub: t(`解放 ${mus.filter((m) => m.price === 0 || save.music.includes(m.id)).length} / ${mus.length}`, `Unlocked ${mus.filter((m) => m.price === 0 || save.music.includes(m.id)).length} / ${mus.length}`), color: 0xb0a0ff, run: () => go(this, 'Music') });
    cards.push({ title: t('エールを贈る', 'SEND YELLS'), sub: t(`${name}　絆 Lv ${favLv}`, `${name}  Bond Lv ${favLv}`), color, run: () => go(this, 'YellRoom', { id: this.charaId, from: 'Lobby' }) });

    const cardW = wide ? 520 : Math.min(430, W * 0.62);
    const cardH = wide ? 96 : 100;
    const gap = 10;
    let y = 96;
    for (const c of cards) {
      uiPanel(this, left, y, cardW, cardH, { color: c.color, alpha: 0.93, strokeAlpha: 0.7, cut: 14, highlight: true });
      this.add.text(left + 24, y + 18, c.title, { fontFamily: FONT_JP, fontSize: '24px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 24, y + 58, c.sub, { fontFamily: FONT_JP, fontSize: '15px', color: COLOR_HEX.dim });
      this.add.text(left + cardW - 22, y + cardH / 2, '▶', { fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.accent }).setOrigin(1, 0.5);
      const zone = this.add.zone(left, y, cardW, cardH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerup', c.run);
      y += cardH + gap;
    }

    makeButton(this, wide ? left + cardW / 2 : W / 2, H - 56, 'TITLE', () => go(this, 'Title'), { width: 240, height: 60, fontSize: 24 });
    this.input.keyboard?.on('keydown-ESC', () => go(this, 'Title'));
    wipeIn(this, { cascade: false });
  }
}
