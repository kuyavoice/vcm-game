import Phaser from 'phaser';
import { GALLERY, galleryKey, galleryThumbKey, type GalleryDef } from '../data/gallery';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave, type SaveData } from '../utils/storage';
import { hasOptionalImage, OPTIONAL_IMAGES } from '../utils/optionalAssets';
import { isCharacterUnlocked } from '../utils/unlock';
import { makeButton } from '../ui/Button';
import { AudioBus } from '../utils/audio';

/** 置かれている画像のキー（無ければ空文字） */
export function galleryImageKey(def: GalleryDef): string {
  const k = galleryKey(def.id);
  return hasOptionalImage(k) ? k : '';
}

/** 一覧に出してよい項目：画像が置かれていて、隠しキャラの絵ならそのキャラを解放済み。クリア報酬は手に入れたものだけ */
export function visibleGallery(save: SaveData): GalleryDef[] {
  return GALLERY.filter((g) => galleryImageKey(g) && (!g.secretOf || isCharacterUnlocked(g.secretOf, save)) && (!g.rewardOf || save.gallery.includes(g.id)));
}

/**
 * イラストギャラリー。エールで解放した絵を一覧・全画面で見られる。
 * 未解放の枠は絵を見せない（名前と価格だけ）。
 * 一覧は小さい絵（thumb）を、解放済みのものだけこの画面で読み込む。大きい絵は、開いたときに初めて読み込む。
 */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }

  preload(): void {
    const save = loadSave();
    for (const g of visibleGallery(save)) {
      if (!save.gallery.includes(g.id)) continue;
      const tk = galleryThumbKey(g.id);
      if (!this.textures.exists(tk)) this.load.image(tk, g.thumb);
    }
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(200, 6, 9, 19);
    cam.scrollY = 0;
    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setScrollFactor(0);

    const save = loadSave();
    const items = visibleGallery(save);
    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'GALLERY', { fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 42, 'キービジュアル —— 集めたエールで解放', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);
    const wallet = this.add.text(W / 2, top + 78, `★ ${save.totalYell}`, { fontFamily: FONT_EN, fontSize: '26px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(0.5);

    // 3列のグリッド（絵は縦長 2:3）
    const cols = 3;
    const gap = 14;
    const gridW = Math.min(680, W - 40);
    const cardW = Math.floor((gridW - gap * (cols - 1)) / cols);
    const imgH = Math.round(cardW * 1.5);
    const cardH = imgH + 104;
    const left = (W - gridW) / 2;
    let gridTop = top + 120;
    let buying = false;
    let viewing = false;

    const flash = (text: string, color: string) => {
      const t = this.add.text(W / 2, top + 78, text, { fontFamily: FONT_JP, fontSize: '22px', color, fontStyle: '700', stroke: '#060913', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(60);
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, duration: 900, delay: 300, onComplete: () => t.destroy() });
    };

    // 特別なイラスト（クリア報酬・横長）：1枚ずつ横幅いっぱいの枠で、キービジュアルの上に並べる
    const wides = items.filter((g) => g.wide);
    const normals = items.filter((g) => !g.wide);
    const wideImgH = Math.round(gridW * 0.6);
    const wideCardH = wideImgH + 66;
    wides.forEach((g) => {
      const cx = W / 2;
      const cy = gridTop;
      const key = galleryThumbKey(g.id);
      this.add.rectangle(cx + 5, cy + 5 + wideCardH / 2, gridW, wideCardH, 0x000000, 0.5);
      const frame = this.add.rectangle(cx, cy + wideCardH / 2, gridW, wideCardH, 0x111a3a, 1).setStrokeStyle(2, g.color, 0.9);
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
        const img = this.add.image(cx, cy + 4 + wideImgH / 2, key);
        const sc = Math.max((gridW - 8) / img.width, (wideImgH - 8) / img.height);
        img.setScale(sc).setCrop((img.width - (gridW - 8) / sc) / 2, (img.height - (wideImgH - 8) / sc) / 2, (gridW - 8) / sc, (wideImgH - 8) / sc);
        frame.setInteractive({ useHandCursor: true });
        frame.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (viewing || Math.abs(p.y - p.downY) > 12) return;
          viewing = true;
          this.openViewer(g, () => { viewing = false; });
        });
      }
      this.add.rectangle(left + 6, cy + wideImgH + 12, 6, 40, g.color, 1).setOrigin(0, 0);
      this.add.text(left + 20, cy + wideImgH + 10, g.title, { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 20, cy + wideImgH + 38, g.sub, { fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.gold, fontStyle: '700', letterSpacing: 2 });
      this.add.text(left + gridW - 12, cy + wideImgH + 24, 'TAP TO VIEW', { fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 1 }).setOrigin(1, 0);
      gridTop += wideCardH + gap;
    });

    normals.forEach((g, i) => {
      const cx = left + (i % cols) * (cardW + gap) + cardW / 2;
      const cy = gridTop + Math.floor(i / cols) * (cardH + gap);
      const owned = save.gallery.includes(g.id);
      const key = galleryThumbKey(g.id);
      this.add.rectangle(cx + 5, cy + 5 + cardH / 2, cardW, cardH, 0x000000, 0.5);
      const frame = this.add.rectangle(cx, cy + cardH / 2, cardW, cardH, 0x111a3a, 1).setStrokeStyle(2, owned ? g.color : 0x3a4a8a, owned ? 0.9 : 0.6);
      if (owned && this.textures.exists(key)) {
        // イラストは滑らかに縮小する（ゲーム全体はドット絵用の設定なので、この絵だけ切り替える）
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
        const img = this.add.image(cx, cy + 4 + imgH / 2, key);
        const sc = Math.max((cardW - 8) / img.width, (imgH - 8) / img.height);
        img.setScale(sc).setCrop((img.width - (cardW - 8) / sc) / 2, (img.height - (imgH - 8) / sc) / 2, (cardW - 8) / sc, (imgH - 8) / sc);
        frame.setInteractive({ useHandCursor: true });
        frame.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (viewing || Math.abs(p.y - p.downY) > 12) return; // スクロールのドラッグは無視
          viewing = true;
          this.openViewer(g, () => { viewing = false; });
        });
      } else {
        // 未解放：絵は見せない
        this.add.rectangle(cx, cy + 4 + imgH / 2, cardW - 8, imgH - 8, 0x060913, 1);
        this.add.text(cx, cy + 4 + imgH / 2 - 10, '?', { fontFamily: FONT_EN, fontSize: '96px', color: '#2A3560', fontStyle: '700' }).setOrigin(0.5);
      }
      this.add.rectangle(cx - cardW / 2 + 6, cy + imgH + 12, 6, 40, g.color, 1).setOrigin(0, 0);
      this.add.text(cx - cardW / 2 + 20, cy + imgH + 10, g.title, { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(cx - cardW / 2 + 20, cy + imgH + 36, g.sub, { fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 2 });
      if (owned) {
        this.add.text(cx + cardW / 2 - 10, cy + imgH + 74, 'TAP TO VIEW', { fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 1 }).setOrigin(1, 0);
      } else {
        // 誤タップで買わないように、2回押しで購入
        let armed = false;
        const btn = makeButton(this, cx, cy + imgH + 78, `★ ${g.price}`, () => {
          if (buying || viewing) return;
          const sv = loadSave();
          if (sv.totalYell < g.price) { flash('エールが足りない', COLOR_HEX.danger); return; }
          const label = btn.list[2] as Phaser.GameObjects.Text;
          if (!armed) {
            armed = true;
            label.setText('解放する？');
            this.time.delayedCall(2500, () => { if (!buying) { armed = false; label.setText(`★ ${g.price}`); } });
            return;
          }
          buying = true;
          sv.totalYell -= g.price;
          if (!sv.gallery.includes(g.id)) sv.gallery.push(g.id);
          writeSave(sv);
          AudioBus.play('se_item');
          wallet.setText(`★ ${sv.totalYell}`);
          flash(`${g.title} を解放`, COLOR_HEX.gold);
          this.time.delayedCall(450, () => this.scene.restart());
        }, { width: cardW - 24, height: 38, fontSize: 18, primary: save.totalYell >= g.price });
      }
    });

    const rows = Math.ceil(normals.length / cols);
    const by = Math.max(H - Math.max(90, H * 0.08), gridTop + rows * (cardH + gap) + 50);
    makeButton(this, W / 2, by, 'TITLE', () => this.scene.start('Title'), { width: 240, height: 60, fontSize: 24 });

    // 縦スクロール（内容が画面より長い端末向け）
    const maxScroll = Math.max(0, by + 90 - H);
    let dragY: number | null = null;
    let dragStart = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; dragStart = cam.scrollY; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (viewing || dragY === null || !p.isDown) return;
      cam.scrollY = Phaser.Math.Clamp(dragStart - (p.y - dragY), 0, maxScroll);
      bg.tilePositionY = cam.scrollY * 0.3;
    });
    const endDrag = () => { dragY = null; };
    this.input.on('pointerup', endDrag);
    this.input.on('pointerupoutside', endDrag);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!viewing) cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.6, 0, maxScroll);
    });
  }

  /** 全画面で見る。どこかをタップすると閉じる。大きい絵は、初めて開いたときに読み込む */
  private openViewer(g: GalleryDef, onClose: () => void): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const key = galleryKey(g.id);
    const shade = this.add.rectangle(0, 0, W, H, 0x020308, 0.94).setOrigin(0).setScrollFactor(0).setDepth(80).setInteractive();
    // 読み込みが終わるまでは、小さい絵を引き伸ばして見せておく
    const img = this.add.image(W / 2, H / 2 - 20, galleryThumbKey(g.id)).setScrollFactor(0).setDepth(81);
    const fit = () => Math.min((W - 16) / img.width, (H - 130) / img.height);
    let sc = fit();
    img.setScale(sc * 0.96).setAlpha(0);
    let closed = false;
    const showFull = () => {
      if (closed || !this.textures.exists(key)) return;
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      img.setTexture(key);
      sc = fit();
      img.setScale(sc);
    };
    if (this.textures.exists(key)) showFull();
    else {
      this.load.image(key, OPTIONAL_IMAGES[key]);
      this.load.once(`filecomplete-image-${key}`, showFull);
      this.load.start();
    }
    const name = this.add.text(W / 2, H - 78, `${g.title}　—　${g.sub}`, { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.white, fontStyle: '700' }).setOrigin(0.5).setScrollFactor(0).setDepth(81);
    const hint = this.add.text(W / 2, H - 44, 'TAP TO CLOSE', { fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(81);
    this.tweens.add({ targets: img, alpha: 1, duration: 220, ease: 'Cubic.out', onComplete: () => img.setScale(fit()) });
    const openedAt = this.time.now;
    shade.on('pointerup', () => {
      if (this.time.now - openedAt < 300) return;
      closed = true;
      for (const o of [shade, img, name, hint]) o.destroy();
      // 閉じたタップで下の絵がまた開かないように、少し待ってから受け付ける
      this.time.delayedCall(200, onClose);
    });
  }
}
