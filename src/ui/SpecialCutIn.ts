import Phaser from 'phaser';
import { FONT_EN, FONT_JP } from '../utils/fonts';

/**
 * 必殺のカットイン（2026-10-04）。斜めの帯が左から、立ち絵が右から入り、技名を大きく出して、すぐ引く。
 * 合計 0.75 秒ほど。ゲームは止めない（テンポを損なわないため）。入力も遮らない。
 * 立ち絵（standing_{id}）が無いキャラは false を返す（呼ぶ側が従来の字幕を出す）。
 */
export function playSpecialCutIn(scene: Phaser.Scene, characterId: string, name: string, color: number): boolean {
  const key = `standing_${characterId}`;
  if (!scene.textures.exists(key)) return false;
  const cam = scene.cameras.main;
  const W = cam.width;
  const H = cam.height;
  const cy = H * 0.42;
  const bandH = Math.min(300, H * 0.26);
  const skew = 70;

  // 帯（左から）
  const band = scene.add.container(-W - skew, cy).setDepth(104).setScrollFactor(0);
  const g = scene.add.graphics();
  g.fillStyle(0x060913, 0.82);
  g.fillPoints([
    new Phaser.Math.Vector2(skew, -bandH / 2), new Phaser.Math.Vector2(W + skew, -bandH / 2),
    new Phaser.Math.Vector2(W, bandH / 2), new Phaser.Math.Vector2(0, bandH / 2),
  ], true);
  g.lineStyle(4, color, 1);
  g.lineBetween(skew, -bandH / 2, W + skew, -bandH / 2);
  g.lineBetween(0, bandH / 2, W, bandH / 2);
  band.add(g);
  const tag = scene.add.text(44, -bandH / 2 + 26, 'SPECIAL', {
    fontFamily: FONT_EN, fontSize: '18px', color: '#060913', fontStyle: '700', letterSpacing: 4,
    backgroundColor: Phaser.Display.Color.IntegerToColor(color).rgba, padding: { x: 8, y: 2 },
  }).setOrigin(0, 0.5);
  // 長い技名（『エンジェリック・ランブル』など）は少し小さくして、2行に収める
  const title = scene.add.text(40, 14, name, {
    fontFamily: FONT_JP, fontSize: name.length > 7 ? '34px' : '42px', color: '#FFFFFF', fontStyle: '700',
    stroke: Phaser.Display.Color.IntegerToColor(color).rgba, strokeThickness: 8,
  }).setOrigin(0, 0.5);
  band.add([tag, title]);

  // 立ち絵（右から）。幅は画面の半分まで、高さは画面の 0.78 まで。上半身が帯にかかる高さに置き、腰から下は出さない
  const img = scene.add.image(0, 0, key).setDepth(105).setScrollFactor(0).setOrigin(0.5, 0);
  const scale = Math.min((W * 0.5) / img.width, (H * 0.78) / img.height);
  img.setScale(scale);
  const imgX = W - img.displayWidth / 2 + 10;
  img.setPosition(W + img.displayWidth, cy - bandH / 2 - H * 0.05);
  img.setCrop(0, 0, img.width, img.height * 0.6);
  img.setAlpha(0.96);
  // 技名は立ち絵にかからない幅で折り返す
  title.setWordWrapWidth(Math.max(200, W - img.displayWidth - 70), true);

  const cleanup = () => {
    band.destroy();
    img.destroy();
  };
  scene.tweens.add({ targets: band, x: 0, duration: 150, ease: 'Cubic.out' });
  scene.tweens.add({ targets: img, x: imgX, duration: 170, ease: 'Cubic.out' });
  scene.tweens.add({ targets: band, x: W + skew, duration: 160, ease: 'Cubic.in', delay: 600 });
  scene.tweens.add({ targets: img, x: W + img.displayWidth, duration: 160, ease: 'Cubic.in', delay: 600, onComplete: cleanup });
  // シーンが先に終わっても残さない
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  return true;
}
