import Phaser from 'phaser';
import { FONT_EN, FONT_JP } from '../utils/fonts';

/**
 * 必殺のカットイン（2026-10-04。テイルズ／Gジェネ風の斜めワイプ。ユーザー承認の案）。
 * 流れ（実時間・合計 0.85 秒。ゲームは止めない、入力も遮らない）：
 *   0〜0.12  キャラ色の細い帯が左上→右下へ走り、その後ろを黒い帯が斜めに開く（マスク）。奥にスピード線が流れる
 *   0.10〜   立ち絵が右から行き過ぎて戻る。入った瞬間、輪郭が白く光る
 *   0.18〜   技名が左から滑り込み、文字間隔が詰まりながら止まる。下に英字とアクセント線
 *   〜0.70   保持（スピード線と光の粒だけ動く）
 *   0.70〜   白い1フレーム → 逆方向へ斜めワイプで消える
 * ゲーム速度（tweens.timeScale）に関わらず実時間で動かす。
 * 立ち絵（standing_{id}）が無いキャラは false を返す（呼ぶ側が従来の字幕を出す）。
 * 新しいカットイン用の絵が来たら `cutin_{id}` を優先して使う（1200×1000 程度・バストアップ・左向き）。
 */
export function playSpecialCutIn(scene: Phaser.Scene, characterId: string, name: string, color: number): boolean {
  const cam = scene.cameras.main;
  const W = cam.width;
  const H = cam.height;
  // 絵：横長の画面（PC）は _wide、縦はふつうの cutin_。どちらも無ければ立ち絵の上半身
  const wideScreen = W / H > 0.8;
  const cands = wideScreen ? [`cutin_${characterId}_wide`, `cutin_${characterId}`] : [`cutin_${characterId}`, `cutin_${characterId}_wide`];
  const artKey = cands.find((k) => scene.textures.exists(k)) ?? `standing_${characterId}`;
  if (!scene.textures.exists(artKey)) return false;
  const cy = H * 0.42;
  const bh = Math.min(320, H * 0.27);
  const skew = 90;
  const top = cy - bh / 2;
  const bottom = cy + bh / 2;
  const colorStr = Phaser.Display.Color.IntegerToColor(color).rgba;

  // ゲーム速度の影響を受けないように、tween とタイマーは 1/timeScale で進める
  const ts = scene.tweens.timeScale || 1;
  const tw = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => scene.tweens.add(cfg).setTimeScale(1 / ts);
  const later = (ms: number, fn: () => void) => scene.time.addEvent({ delay: ms, callback: fn, timeScale: 1 / ts });

  const root = scene.add.container(0, 0).setDepth(104).setScrollFactor(0);
  const alive = { v: true };

  // 帯の形（平行四辺形）。x0 は下辺の左端、上辺は skew ぶん右へずれる
  const bandPoly = (x0: number, x1: number) => [
    new Phaser.Math.Vector2(x0 + skew, top), new Phaser.Math.Vector2(x1 + skew, top),
    new Phaser.Math.Vector2(x1, bottom), new Phaser.Math.Vector2(x0, bottom),
  ];

  // 斜めワイプのマスク：見える範囲 [wipe.l, wipe.r]（0〜1）。帯の中身は全部このマスクの下
  const wipe = { l: 0, r: 0 };
  const maskG = scene.make.graphics({ x: 0, y: 0 }, false).setScrollFactor(0);
  const drawMask = () => {
    const xl = Phaser.Math.Linear(-skew - 10, W + 10, wipe.l);
    const xr = Phaser.Math.Linear(-skew - 10, W + 10, wipe.r);
    maskG.clear();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillPoints(bandPoly(xl, xr), true);
  };
  drawMask();
  const inner = scene.add.container(0, 0);
  inner.setMask(maskG.createGeometryMask());
  root.add(inner);

  // 1) 黒い帯＋左側のキャラ色のグラデーション＋上下の線
  const panel = scene.add.graphics();
  panel.fillStyle(0x060913, 0.88);
  panel.fillPoints(bandPoly(-skew, W + skew), true);
  panel.fillGradientStyle(color, color, color, color, 0.5, 0, 0.5, 0);
  panel.fillRect(-skew, top, W * 0.6, bh);
  panel.lineStyle(3, color, 1);
  panel.lineBetween(0, top, W + skew, top);
  panel.lineBetween(-skew, bottom, W, bottom);
  inner.add(panel);

  // 2) スピード線：右から左へ流れる細い筋（2枚ぶん描いてループ）
  const lines = scene.add.graphics();
  const seg = W + skew * 2;
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 26; i++) {
      const y = top + 8 + Math.random() * (bh - 16);
      const len = 60 + Math.random() * 220;
      const x = k * seg + Math.random() * seg;
      lines.lineStyle(1 + Math.random() * 1.5, 0xffffff, 0.08 + Math.random() * 0.16);
      lines.lineBetween(x, y, x + len, y - len * 0.18);
    }
  }
  lines.setPosition(-skew, 0);
  inner.add(lines);
  tw({ targets: lines, x: -skew - seg, duration: 900, repeat: -1 });

  // 3) 光の粒（キャラ色）：帯の中をゆっくり上へ
  const sparks: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 10; i++) {
    const s = scene.add.image(Math.random() * W, bottom - Math.random() * bh, 'art_star').setTint(color).setAlpha(0).setScale(0.5 + Math.random() * 0.8);
    inner.add(s);
    sparks.push(s);
    tw({ targets: s, y: s.y - 40 - Math.random() * 60, alpha: { from: 0, to: 0.9 }, duration: 500 + Math.random() * 300, delay: 150 + Math.random() * 350, yoyo: true, ease: 'Sine.out' });
  }

  // 4) 立ち絵（右から行き過ぎて戻る）。上半身。頭は帯より少し上へ出す
  const img = scene.add.image(0, 0, artKey).setOrigin(0.5, 0);
  const isCutinArt = artKey.startsWith('cutin_');
  const isWideArt = artKey.endsWith('_wide');
  // カットインの絵：縦の絵は画面幅の半分、横の絵は帯の 1.5 倍の高さ（右寄せ。腕は左へ伸びて文字に少しかかる。頭は帯の上にはみ出す）
  // 立ち絵（絵が無いとき）は上半分（頭〜腰）を、帯の高さの 1.45 倍に収める。幅は画面の 58% まで
  const cropRatio = 0.5;
  const scale = isCutinArt
    ? (isWideArt ? Math.min((W * 0.78) / img.width, (bh * 1.5) / img.height) : Math.min((W * 0.52) / img.width, (bh * 1.9) / img.height))
    : Math.min((W * 0.58) / img.width, (bh * 1.45) / (img.height * cropRatio));
  img.setScale(scale);
  if (!isCutinArt) img.setCrop(0, 0, img.width, img.height * cropRatio);
  const imgX = W - img.displayWidth / 2 + 10;
  const imgY = isCutinArt ? top - bh * (isWideArt ? 0.3 : 0.35) : top - H * 0.05;
  img.setPosition(W + img.displayWidth, imgY);
  root.add(img);
  // 入った瞬間の白い輪郭（同じ絵を白で塗りつぶして重ね、すぐ消す）
  const flashImg = scene.add.image(0, 0, artKey).setOrigin(0.5, 0).setScale(scale).setTintFill(0xffffff).setAlpha(0);
  if (!isCutinArt) flashImg.setCrop(0, 0, img.width, img.height * cropRatio);
  flashImg.setPosition(imgX, imgY);
  root.add(flashImg);
  // 立ち絵は帯の下端で切る（下にははみ出さない）
  const imgMaskG = scene.make.graphics({ x: 0, y: 0 }, false).setScrollFactor(0);
  imgMaskG.fillStyle(0xffffff, 1);
  imgMaskG.fillPoints([
    new Phaser.Math.Vector2(skew, top - bh * 0.4), new Phaser.Math.Vector2(W + skew, top - bh * 0.4),
    new Phaser.Math.Vector2(W, bottom), new Phaser.Math.Vector2(0, bottom),
  ], true);
  img.setMask(imgMaskG.createGeometryMask());
  flashImg.setMask(imgMaskG.createGeometryMask());

  // 5) 技名・英字・アクセント線（左から）
  const textL = 40;
  // 技名は立ち絵にかからない幅に。1行に入る大きさまで縮め（下限30px）、それでも入らなければ折り返す
  const nameW = Math.max(220, W - img.displayWidth - 60);
  const nameSize = Math.max(30, Math.min(46, Math.floor((nameW - 8) / Math.max(1, name.length)) - 2));
  const title = scene.add.text(textL - 80, cy - 4, name, {
    fontFamily: FONT_JP, fontSize: `${nameSize}px`, color: '#FFFFFF', fontStyle: '700',
    stroke: colorStr, strokeThickness: 8,
    wordWrap: { width: nameW, useAdvancedWrap: true },
  }).setOrigin(0, 0.5).setAlpha(0).setLetterSpacing(14);
  const sub = scene.add.text(textL - 60, top + 22, 'SPECIAL ARTS', {
    fontFamily: FONT_EN, fontSize: '18px', color: colorStr, fontStyle: '700', letterSpacing: 6,
  }).setOrigin(0, 0.5).setAlpha(0);
  const rule = scene.add.rectangle(textL, bottom - 26, 1, 3, color, 1).setOrigin(0, 0.5).setScale(0, 1);
  // 文字は絵より手前（腕や武器が左へ伸びて技名にかかるため）。帯のマスクの外なので、退場は自分でフェード
  const textLayer = scene.add.container(0, 0).setDepth(106).setScrollFactor(0);
  textLayer.add([title, sub, rule]);

  // 6) ワイプの先端を走るキャラ色の細い帯
  const edge = scene.add.graphics();
  edge.fillStyle(color, 1);
  edge.fillPoints([
    new Phaser.Math.Vector2(skew, top - 6), new Phaser.Math.Vector2(skew + 34, top - 6),
    new Phaser.Math.Vector2(34, bottom + 6), new Phaser.Math.Vector2(0, bottom + 6),
  ], true);
  edge.setPosition(-skew - 40, 0);
  root.add(edge);
  // 退場前の白い1フレーム
  const white = scene.add.graphics();
  white.fillStyle(0xffffff, 1);
  white.fillPoints(bandPoly(-skew, W + skew), true);
  white.setAlpha(0);
  root.add(white);

  const cleanup = () => {
    if (!alive.v) return;
    alive.v = false;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    root.destroy();
    textLayer.destroy();
    maskG.destroy();
    imgMaskG.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  // ── タイムライン ──
  // 0〜140ms：帯が開く（右端が左→右）。先端の細い帯が先に走る
  tw({ targets: edge, x: W + 40, duration: 130, ease: 'Cubic.out' });
  tw({ targets: wipe, r: 1, duration: 140, ease: 'Cubic.out', onUpdate: drawMask });
  // 90ms〜：立ち絵（行き過ぎて戻る）→ 入った瞬間に白く光る
  tw({ targets: img, x: imgX, duration: 200, delay: 90, ease: 'Back.out', onComplete: () => {
    if (!alive.v) return;
    flashImg.setAlpha(0.9);
    tw({ targets: flashImg, alpha: 0, duration: 140 });
  } });
  // 170ms〜：技名（左から、文字間隔が詰まる）、英字、線
  tw({ targets: title, x: textL, alpha: 1, duration: 220, delay: 170, ease: 'Cubic.out' });
  const spacing = { v: 14 };
  tw({ targets: spacing, v: 2, duration: 260, delay: 170, ease: 'Cubic.out', onUpdate: () => { if (alive.v) title.setLetterSpacing(spacing.v); } });
  tw({ targets: sub, x: textL, alpha: 1, duration: 200, delay: 230, ease: 'Cubic.out' });
  tw({ targets: rule, scaleX: Math.max(120, W - img.displayWidth - 70), duration: 260, delay: 260, ease: 'Cubic.out' });
  // 690ms〜：白い1フレーム → 左端が右へ閉じる（逆方向のワイプ）。先端の帯も走る。立ち絵は右へ抜ける
  later(690, () => {
    if (!alive.v) return;
    white.setAlpha(0.85);
    tw({ targets: white, alpha: 0, duration: 90 });
    tw({ targets: wipe, l: 1, duration: 150, ease: 'Cubic.in', onUpdate: drawMask });
    edge.setPosition(-skew - 40, 0);
    tw({ targets: edge, x: W + 40, duration: 150, ease: 'Cubic.in' });
    tw({ targets: [img, flashImg], x: W + img.displayWidth, duration: 150, ease: 'Cubic.in' });
    tw({ targets: sparks, alpha: 0, duration: 120 });
    tw({ targets: textLayer, alpha: 0, x: 40, duration: 130, ease: 'Cubic.in' });
  });
  later(880, cleanup);
  return true;
}
