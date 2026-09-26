import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { generateTextures } from '../utils/textures';
import { AudioBus } from '../utils/audio';
import { FONT_EN } from '../utils/fonts';
import { OPTIONAL_IMAGES, hasOptionalImage } from '../utils/optionalAssets';

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
    // 宝箱画面のマスコット（ルナ様チビ）など、置けば使われる画像。未配置なら簡易プレースホルダー
    for (const [key, path] of Object.entries(OPTIONAL_IMAGES)) if (hasOptionalImage(key)) this.load.image(key, path);
    AudioBus.queueLoad(this.load);
  }

  create(): void {
    generateTextures(this);

    // キャラアニメ
    for (const c of Object.values(CHARACTERS)) {
      const k = c.sprite.key;
      const f = c.sprite.frames;
      const mk = (name: string, frames: number[], frameRate: number, repeat = -1) =>
        this.anims.create({ key: `${k}_${name}`, frames: this.anims.generateFrameNumbers(k, { frames }), frameRate, repeat });
      mk('idle', f.idle, 2);
      mk('walk', f.walk, 8);
      mk('hit', f.hit, 1, 0);
      mk('sleep', f.sleep, 1.5);
    }

    // 敵アニメ（2フレームのグリッチ切替）
    for (const e of Object.values(ENEMIES)) {
      this.anims.create({
        key: `anim_e_${e.id}`,
        frames: [{ key: `e_${e.id}_0` }, { key: `e_${e.id}_1` }],
        frameRate: 5,
        repeat: -1,
      });
    }

    this.scene.start('Title');
  }
}
