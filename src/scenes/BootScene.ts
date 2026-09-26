import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { generateTextures } from '../utils/textures';
import { AudioBus } from '../utils/audio';
import { FONT_EN } from '../utils/fonts';
import { OPTIONAL_IMAGES, hasOptionalImage } from '../utils/optionalAssets';
import { PORTRAITS, PORTRAIT_DIR, portraitKey } from '../data/portraits';
import { createCharAnims } from '../utils/recolor';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const { width, height } = this.cameras.main;
    const txt = this.add.text(width / 2, height / 2, 'CONNECTING...', {
      fontFamily: FONT_EN, fontSize: '32px', color: '#87CEEB', fontStyle: '700',
    }).setOrigin(0.5);
    this.load.on('progress', (v: number) => txt.setText(`CONNECTING... ${Math.round(v * 100)}%`));
    // 未配置ファイルは無視して続行（立ち絵・音声は任意）
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('[asset missing]', file.key));

    for (const c of Object.values(CHARACTERS)) {
      this.load.spritesheet(c.sprite.key, c.sprite.file, {
        frameWidth: c.sprite.frameWidth,
        frameHeight: c.sprite.frameHeight,
      });
      if (c.standing) this.load.image(`standing_${c.id}`, c.standing);
    }
    // 画像スプライトの敵（黒騎士・騎兵）
    for (const e of Object.values(ENEMIES)) {
      if (e.sheet) this.load.spritesheet(`e_${e.id}`, e.sheet.file, { frameWidth: e.sheet.frameWidth, frameHeight: e.sheet.frameHeight });
    }
    // カットイン用の顔画像（ポータルの立ち絵から切り出した 256px webp）
    for (const id of new Set(Object.values(PORTRAITS))) this.load.image(portraitKey(id), `${PORTRAIT_DIR}${id}.webp`);
    // 宝箱画面のマスコット（ルナ様チビ）など、置けば使われる画像。未配置なら簡易プレースホルダー
    for (const [key, path] of Object.entries(OPTIONAL_IMAGES)) if (hasOptionalImage(key)) this.load.image(key, path);
    AudioBus.queueLoad(this.load);
  }

  create(): void {
    generateTextures(this);

    // キャラアニメ
    for (const c of Object.values(CHARACTERS)) createCharAnims(this, c);

    // 敵アニメ（2フレームのグリッチ切替。_o は縁取り付き）。画像スプライトの敵はコマ送り
    for (const e of Object.values(ENEMIES)) {
      if (e.sheet) {
        const key = `e_${e.id}`;
        if (e.id === 'blackknight') {
          // 1〜4移動／5剣閃の振りかぶり／6剣閃／7闇の弾幕／8騎兵召喚／9被弾・形態変化
          this.anims.create({ key: `anim_e_${e.id}`, frames: this.anims.generateFrameNumbers(key, { frames: [0, 1, 2, 3] }), frameRate: 6, repeat: -1 });
          this.anims.create({ key: `anim_e_${e.id}_windup`, frames: this.anims.generateFrameNumbers(key, { frames: [4] }), frameRate: 1, repeat: 0 });
          this.anims.create({ key: `anim_e_${e.id}_slash`, frames: this.anims.generateFrameNumbers(key, { frames: [5] }), frameRate: 1, repeat: 0 });
          this.anims.create({ key: `anim_e_${e.id}_barrage`, frames: this.anims.generateFrameNumbers(key, { frames: [6] }), frameRate: 1, repeat: 0 });
          this.anims.create({ key: `anim_e_${e.id}_summon`, frames: this.anims.generateFrameNumbers(key, { frames: [7] }), frameRate: 1, repeat: 0 });
          this.anims.create({ key: `anim_e_${e.id}_hit`, frames: this.anims.generateFrameNumbers(key, { frames: [8] }), frameRate: 1, repeat: 0 });
        } else {
          this.anims.create({ key: `anim_e_${e.id}`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: e.sheet.frames - 1 }), frameRate: 10, repeat: -1 });
        }
        continue;
      }
      if (e.isObject) {
        this.anims.create({ key: `anim_e_${e.id}`, frames: [{ key: `e_${e.id}_0` }, { key: `e_${e.id}_1` }], frameRate: 5, repeat: -1 });
        continue;
      }
      this.anims.create({ key: `anim_e_${e.id}`, frames: [{ key: `e_${e.id}_0` }, { key: `e_${e.id}_1` }], frameRate: 5, repeat: -1 });
      this.anims.create({ key: `anim_e_${e.id}_o`, frames: [{ key: `e_${e.id}_0_o` }, { key: `e_${e.id}_1_o` }], frameRate: 5, repeat: -1 });
    }

    this.scene.start('Title');
  }
}
