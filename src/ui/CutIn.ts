import Phaser from 'phaser';
import { PORTRAITS, portraitKey } from '../data/portraits';
import { FONT_EN, FONT_JP } from '../utils/fonts';
import { getSafeInsets } from '../utils/safeArea';

export interface CutInRequest {
  /** 使い手の表示名（PORTRAITS のキー） */
  owner: string;
  /** アーツ／パッシブ名 */
  title: string;
  /** NEW / Lv UP / EVOLVE など */
  tag: string;
  color: number;
}

/**
 * 使い手のカットイン（P3R風の斜めパネル＋顔）。左からスライドイン → 1秒保持 → スライドアウト。
 * 連続で来た場合はキューで順に表示。画像が無いキャラは名前だけのパネルになる。
 */
export class CutIn {
  private queue: CutInRequest[] = [];
  private showing = false;
  private readonly W = 420;
  private readonly H = 120;

  constructor(private scene: Phaser.Scene) {}

  show(req: CutInRequest): void {
    this.queue.push(req);
    if (!this.showing) this.next();
  }

  private next(): void {
    const req = this.queue.shift();
    if (!req) {
      this.showing = false;
      return;
    }
    this.showing = true;
    const s = this.scene;
    const cam = s.cameras.main;
    const safe = getSafeInsets(s.scale);
    const y = Math.max(safe.top, 16) + 8 + 200;
    const W = this.W;
    const H = this.H;

    const c = s.add.container(-W - 40, y).setDepth(102).setScrollFactor(0);

    // 斜めパネル
    const g = s.add.graphics();
    g.fillStyle(0x060913, 0.92);
    g.fillPoints([new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(W, 0), new Phaser.Math.Vector2(W - 36, H), new Phaser.Math.Vector2(0, H)], true);
    g.fillStyle(req.color, 1);
    g.fillPoints([new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(12, 0), new Phaser.Math.Vector2(12, H), new Phaser.Math.Vector2(0, H)], true);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokePoints([new Phaser.Math.Vector2(0, 0), new Phaser.Math.Vector2(W, 0), new Phaser.Math.Vector2(W - 36, H), new Phaser.Math.Vector2(0, H)], true);
    c.add(g);

    // 顔（円マスク）
    const id = PORTRAITS[req.owner];
    const key = id ? portraitKey(id) : '';
    let textX = 28;
    if (key && s.textures.exists(key)) {
      const r = 44;
      const face = s.add.image(24 + r, H / 2, key).setDisplaySize(r * 2.2, r * 2.2);
      const ring = s.add.graphics();
      ring.lineStyle(3, req.color, 1);
      ring.strokeCircle(24 + r, H / 2, r + 1);
      // マスクはシーン座標基準なので、コンテナの移動に追従させる
      const maskG = s.make.graphics({ x: 0, y: 0 }, false);
      maskG.fillStyle(0xffffff, 1);
      maskG.fillCircle(24 + r, H / 2, r);
      maskG.setScrollFactor(0);
      face.setMask(maskG.createGeometryMask());
      c.add([face, ring]);
      c.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());
      const syncMask = () => maskG.setPosition(c.x, c.y);
      s.events.on(Phaser.Scenes.Events.UPDATE, syncMask);
      c.once(Phaser.GameObjects.Events.DESTROY, () => s.events.off(Phaser.Scenes.Events.UPDATE, syncMask));
      textX = 24 + r * 2 + 20;
    }

    const tag = s.add.text(textX, 16, req.tag, {
      fontFamily: FONT_EN, fontSize: '16px', color: '#060913', fontStyle: '700',
      backgroundColor: Phaser.Display.Color.IntegerToColor(req.color).rgba, padding: { x: 6, y: 1 },
    });
    const owner = s.add.text(textX + tag.width + 10, 18, req.owner, { fontFamily: FONT_JP, fontSize: '16px', color: '#8A94B8' });
    const title = s.add.text(textX, 48, req.title, {
      fontFamily: FONT_JP, fontSize: '28px', color: '#FFFFFF', fontStyle: '700', wordWrap: { width: W - textX - 40, useAdvancedWrap: true },
    });
    c.add([tag, owner, title]);

    s.tweens.chain({
      targets: c,
      tweens: [
        { x: -8, duration: 220, ease: 'Cubic.out' },
        { x: -8, duration: 1000 },
        { x: -W - 40, duration: 200, ease: 'Cubic.in' },
      ],
      onComplete: () => {
        c.destroy();
        this.next();
      },
    });
    void cam;
  }

  destroy(): void {
    this.queue.length = 0;
  }
}
