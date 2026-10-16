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

/** 推し（絆が一番高いキャラ）が最初に出る重み */
const FAVORITE_WEIGHT = 3;
/** キャラごとの置き方の補正（倍率と横のずらし。横は画面幅に対する割合）。律花は髪が横に広く顔が右へ寄るので、少し小さく左へ（2026-10-15 ユーザー指定） */
const LOBBY_ADJUST: Record<string, { scale: number; dx: number }> = {
  ritsuka: { scale: 0.84, dx: -0.07 },
};

/** スワイプと判定する横の移動量（px） */
const SWIPE_PX = 60;

/**
 * EXTRA（拠点＝作戦室。2026-10-15 ユーザー承認「A案・案1」）。
 * タイトルの EXTRA から入る。作戦室の絵の上に、解放済みのキャラが1人迎える（最初は絆が一番高い推しが出やすいランダム。隠しキャラは解放後だけ）。
 * **キャラは左右スワイプ（PC は ◀ ▶）で切り替えられ、「エールを贈る」の行き先も変わる**（2026-10-15 ユーザー要望）。
 * 図鑑・実績・ギャラリー・ミュージック・作戦室（エールを贈る）への入口と、それぞれの進捗。各画面の「戻る」はここへ。
 */
export class LobbyScene extends Phaser.Scene {
  private ids: string[] = ['kuya'];
  private index = 0;
  private chara?: Phaser.GameObjects.Image;
  private nameTag?: Phaser.GameObjects.Text;
  private yellSub?: Phaser.GameObjects.Text;
  private yellPanel?: ReturnType<typeof uiPanel>;
  private switching = false;
  private W = 720;
  private H = 1280;
  /** 縦画面：カード群の上端（キャラはこの上に置く） */
  private cardsTop = 0;

  constructor() {
    super('Lobby');
  }

  private get charaId(): string {
    return this.ids[this.index];
  }

  /** 最初に迎えるキャラ：解放済みから。絆が一番高いキャラは出やすい */
  private pickFirst(save: SaveData): number {
    let fav = -1;
    let favBond = 0;
    this.ids.forEach((id, i) => {
      const b = save.bond[id] ?? 0;
      if (b > favBond) { favBond = b; fav = i; }
    });
    const weights = this.ids.map((_, i) => (i === fav ? FAVORITE_WEIGHT : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < this.ids.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return this.ids.length - 1;
  }

  private charKey(save: SaveData, id: string): string {
    const lv = bondLevel(save.bond[id] ?? 0);
    return lv >= BOND_RELAX_LEVEL && hasOptionalImage(`relax_${id}`) ? `relax_${id}` : `standing_${id}`;
  }

  create(): void {
    const cam = this.cameras.main;
    this.W = cam.width;
    this.H = cam.height;
    const W = this.W;
    const H = this.H;
    const save = loadSave();
    this.ids = CHARACTER_ORDER.filter((id) => isCharacterUnlocked(id, save));
    if (this.ids.length === 0) this.ids = ['kuya'];
    this.index = this.pickFirst(save);
    this.switching = false;
    const wide = W / H > 1.0;
    const bgKey = wide && hasOptionalImage('room_wide') ? 'room_wide' : 'room';
    const charKey = this.charKey(save, this.charaId);
    const need = [bgKey, charKey].filter((k) => !this.textures.exists(k) && hasOptionalImage(k));
    for (const k of need) this.load.image(k, OPTIONAL_IMAGES[k]);
    if (need.length) {
      this.load.once('complete', () => { if (this.scene.isActive()) this.build(save, bgKey); });
      this.load.start();
    } else {
      this.build(save, bgKey);
    }
  }

  private build(save: SaveData, bgKey: string): void {
    const W = this.W;
    const H = this.H;
    const wide = W / H > 1.0;
    if (this.textures.exists(bgKey)) {
      this.textures.get(bgKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const tex = this.textures.get(bgKey).getSourceImage() as HTMLImageElement;
      const cover = Math.max(W / tex.width, H / tex.height);
      this.add.image(W / 2, H / 2, bgKey).setScale(cover).setDepth(-10);
    } else {
      this.add.rectangle(0, 0, W, H, 0x0b1026).setOrigin(0).setDepth(-10);
    }
    this.add.rectangle(0, 0, W, H, 0x060913, 0.28).setOrigin(0).setDepth(-9);
    // タイトルを経由しない入り方でも曲が流れるように（同じ曲なら何もしない）
    AudioBus.playBgmAfterVoice('bgm_title');

    // 見出し・所持エール
    const left = 20;
    this.add.text(left, 16, 'EXTRA', { fontFamily: FONT_EN, fontSize: '34px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5, stroke: '#060913', strokeThickness: 5 });
    this.add.text(left, 58, t('作戦室 ― 仲間と記録の部屋', 'Operations room'), { fontFamily: FONT_JP, fontSize: '15px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 4 });
    this.add.text(W - 20, 22, `★ ${save.totalYell.toLocaleString()}`, { fontFamily: FONT_EN, fontSize: '24px', color: COLOR_HEX.gold, fontStyle: '700', stroke: '#060913', strokeThickness: 5 }).setOrigin(1, 0);

    // 入口のカード
    const gal = visibleGallery(save);
    const mus = visibleMusic(save);
    const cards: { title: string; sub: string; color: number; run: () => void; yell?: boolean }[] = [
      { title: t('図鑑', 'CODEX'), sub: t(`共鳴アーツ・サポート ${codexFound(save)} / ${codexTotal(save)}`, `Arts & supports ${codexFound(save)} / ${codexTotal(save)}`), color: 0x87ceeb, run: () => go(this, 'Codex', { tab: 'arts' }) },
      { title: t('実績', 'ACHIEVEMENTS'), sub: t(`解除 ${save.achievements.length} / ${ACHIEVEMENTS.length}`, `Unlocked ${save.achievements.length} / ${ACHIEVEMENTS.length}`), color: 0xffd700, run: () => go(this, 'Codex', { tab: 'achv' }) },
    ];
    if (gal.length > 0) {
      const n = gal.filter((g) => g.price === 0 || save.gallery.includes(g.id)).length;
      cards.push({ title: t('ギャラリー', 'GALLERY'), sub: t(`解放 ${n} / ${gal.length}`, `Unlocked ${n} / ${gal.length}`), color: 0xffb7c5, run: () => go(this, 'Gallery') });
    }
    if (mus.length > 0) {
      const n = mus.filter((m) => m.price === 0 || save.music.includes(m.id)).length;
      cards.push({ title: t('ミュージック', 'MUSIC'), sub: t(`解放 ${n} / ${mus.length}`, `Unlocked ${n} / ${mus.length}`), color: 0xb0a0ff, run: () => go(this, 'Music') });
    }
    cards.push({ title: t('エールを贈る', 'SEND YELLS'), sub: '', color: 0x87ceeb, run: () => this.toYellRoom(), yell: true });

    // 縦（スマホ）：カードは画面の下に全幅で並べ、キャラはその上（顔がカードに隠れない。2026-10-15 実機確認で変更）。横：カードは左、キャラは中央右
    const cardW = wide ? 520 : W - 40;
    const cardH = wide ? 96 : 84;
    const gap = wide ? 10 : 8;
    const blockH = cards.length * (cardH + gap) - gap;
    let y = wide ? 96 : H - 56 - 40 - blockH - 14;
    this.cardsTop = y;
    for (const c of cards) {
      const p = uiPanel(this, left, y, cardW, cardH, { color: c.color, alpha: 0.93, strokeAlpha: 0.7, cut: 14, highlight: true });
      this.add.text(left + 24, y + (wide ? 18 : 12), c.title, { fontFamily: FONT_JP, fontSize: wide ? '24px' : '22px', color: COLOR_HEX.white, fontStyle: '700' });
      const sub = this.add.text(left + 24, y + (wide ? 58 : 50), c.sub, { fontFamily: FONT_JP, fontSize: wide ? '15px' : '14px', color: COLOR_HEX.dim });
      this.add.text(left + cardW - 22, y + cardH / 2, '▶', { fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.accent }).setOrigin(1, 0.5);
      const zone = this.add.zone(left, y, cardW, cardH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerup', c.run);
      if (c.yell) { this.yellSub = sub; this.yellPanel = p; }
      y += cardH + gap;
    }

    // キャラ：縦はバストアップで右寄り、横は全身で中央右。スワイプ（◀ ▶）で切り替え、タップで作戦室
    const area = this.charaArea();
    const zone = this.add.zone(area.x, area.y, area.w, area.h).setOrigin(0).setInteractive({ useHandCursor: true });
    let downX = 0;
    let downY = 0;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { downX = p.x; downY = p.y; });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - downX;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(p.y - downY)) this.switchTo(dx < 0 ? 1 : -1);
      else if (Math.hypot(dx, p.y - downY) < 24) this.toYellRoom();
    });
    // キャラの名札と ◀ ▶（縦：カードのすぐ上の帯／横：キャラの足元）
    const tagY = wide ? H - 150 : this.cardsTop - 30;
    if (!wide) this.add.rectangle(0, tagY - 24, W, 48, 0x060913, 0.55).setOrigin(0).setDepth(4);
    this.nameTag = this.add.text(area.x + area.w / 2, tagY, '', { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 4, align: 'center', lineSpacing: 4 }).setOrigin(0.5).setDepth(5);
    if (this.ids.length > 1) {
      makeButton(this, area.x + 44, tagY, '◀', () => this.switchTo(-1), { width: 56, height: 44, fontSize: 20, armDelayMs: 150 }).setDepth(6);
      makeButton(this, area.x + area.w - 44, tagY, '▶', () => this.switchTo(1), { width: 56, height: 44, fontSize: 20, armDelayMs: 150 }).setDepth(6);
    }
    this.showCharacter(save, this.charaId, 0, true);

    makeButton(this, wide ? left + cardW / 2 : W / 2, H - 56, 'TITLE', () => go(this, 'Title'), { width: 240, height: 60, fontSize: 24 });
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.key === 'Escape') go(this, 'Title');
      else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') this.switchTo(1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') this.switchTo(-1);
    });
    wipeIn(this, { cascade: false });
  }

  /** キャラを置く領域（スワイプの当たり判定もこの範囲） */
  private charaArea(): { x: number; y: number; w: number; h: number; cx: number; topY: number; bottomY: number } {
    const W = this.W;
    const H = this.H;
    const wide = W / H > 1.0;
    if (!wide) {
      // 上の見出しの下から、名札の帯の上まで
      return { x: 0, y: 84, w: W, h: Math.max(100, this.cardsTop - 54 - 84), cx: W * 0.52, topY: 84, bottomY: this.cardsTop - 54 };
    }
    const cx = W * 0.64;
    const w = Math.min(W * 0.5, 900);
    return { x: cx - w / 2, y: 20, w, h: H - 20 - 180, cx, topY: 40, bottomY: H - 80 };
  }

  /** キャラを出す（dir：0＝その場、±1＝左右から滑り込む） */
  private showCharacter(save: SaveData, id: string, dir: number, first: boolean): void {
    const key = this.charKey(save, id);
    const place = () => {
      if (!this.scene.isActive()) return;
      const W = this.W;
      const H = this.H;
      const wide = W / H > 1.0;
      const area = this.charaArea();
      const old = this.chara;
      if (old) this.tweens.add({ targets: old, alpha: 0, x: old.x - dir * 60, duration: 180, onComplete: () => old.destroy() });
      if (!this.textures.exists(key)) { this.chara = undefined; return; }
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const adj = LOBBY_ADJUST[id] ?? { scale: 1, dx: 0 };
      const cx = area.cx + adj.dx * W;
      let img: Phaser.GameObjects.Image;
      if (!wide) {
        // 頭から胸までが名札の帯の上に収まる大きさ（大きくなりすぎる縦長の端末では 1.0 で止める）
        img = this.add.image(cx, area.topY, key).setOrigin(0.5, 0).setDepth(-6);
        img.setScale(Math.min(1.0, (area.bottomY - area.topY) / (img.height * 0.46)) * adj.scale);
      } else {
        img = this.add.image(cx, area.bottomY + 30, key).setOrigin(0.5, 1).setDepth(-6);
        img.setScale(Math.min((area.bottomY + 20) / img.height, (W * 0.5) / img.width) * adj.scale);
      }
      img.setAlpha(0).setX(cx + dir * 60);
      this.tweens.add({ targets: img, alpha: 1, x: cx, duration: first ? 420 : 220, ease: 'Cubic.out', onComplete: () => { this.switching = false; } });
      this.chara = img;
      // 名札と「エールを贈る」の行き先
      const def = CHARACTERS[id];
      const name = CODEX_CHARACTERS.find((c) => c.id === id)?.name ?? def?.name ?? id;
      const lv = bondLevel(save.bond[id] ?? 0);
      this.nameTag?.setText(this.ids.length > 1 ? t(`${name}　絆 Lv ${lv}
スワイプで切替／タップで作戦室`, `${name}  Bond Lv ${lv}
swipe / tap to visit`) : t(`${name}　絆 Lv ${lv}
タップで作戦室`, `${name}  Bond Lv ${lv}
tap to visit`));
      this.yellSub?.setText(t(`${name}　絆 Lv ${lv}`, `${name}  Bond Lv ${lv}`));
      this.yellPanel?.redraw({ color: def?.color ?? 0x87ceeb });
      // 迎えのひとこと：キャラ選択のボイス
      AudioBus.voice(id, 'select');
    };
    if (this.textures.exists(key) || !hasOptionalImage(key)) { place(); return; }
    this.load.image(key, OPTIONAL_IMAGES[key]);
    this.load.once(`filecomplete-image-${key}`, place);
    this.load.start();
  }

  private switchTo(dir: number): void {
    if (this.switching || this.ids.length <= 1) return;
    this.switching = true;
    this.index = (this.index + dir + this.ids.length) % this.ids.length;
    this.showCharacter(loadSave(), this.charaId, dir, false);
  }

  private toYellRoom(): void {
    go(this, 'YellRoom', { id: this.charaId, from: 'Lobby' });
  }
}
