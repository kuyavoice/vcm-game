import Phaser from 'phaser';
import { ENEMIES } from '../data/enemies';

/** 決定論的な乱数（同じ見た目を再現するため） */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 敵テクスチャ：黒い影＋光る目＋ノイズ状グリッチ。frame 0/1 でグリッチ位置が変わる */
function makeEnemyTexture(scene: Phaser.Scene, key: string, size: number, eyeColor: number, seed: number, outline = false) {
  const rnd = mulberry32(seed);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = size / 2;
  const r = size * 0.42;

  // 本体：ギザギザの影
  const pts: Phaser.Math.Vector2[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.78 + rnd() * 0.3) * (a > Math.PI ? 1.05 : 0.95);
    pts.push(new Phaser.Math.Vector2(c + Math.cos(a) * rr, c + Math.sin(a) * rr + size * 0.04));
  }
  g.fillStyle(0x05070f, 1);
  g.fillPoints(pts, true);
  // 薄い縁（1pxアウトライン）。outline のときは淡い明色で見やすく（STAGE 2 用）
  g.lineStyle(outline ? 2 : 1, outline ? 0xb8c4ff : 0x1a2350, outline ? 0.5 : 1);
  g.strokePoints(pts, true);

  // グリッチ：横スライスをずらす
  const slices = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < slices; i++) {
    const y = Math.floor(rnd() * size);
    const h = 1 + Math.floor(rnd() * Math.max(1, size / 12));
    const dx = (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * Math.max(1, size / 8)));
    g.fillStyle(0x0d1230, 1);
    g.fillRect(Math.max(0, c - r + dx), y, r * 1.6, h);
    g.fillStyle(rnd() < 0.5 ? 0x2b3a8a : 0x8a2b6a, 0.8);
    g.fillRect(Math.max(0, c - r * 0.6 + dx * 2), y, r * 0.5, 1);
  }

  // 目：発光
  const ey = c - size * 0.06;
  const ex = size * 0.16;
  const er = Math.max(1.5, size * 0.07);
  g.fillStyle(eyeColor, 0.35);
  g.fillCircle(c - ex, ey, er * 2);
  g.fillCircle(c + ex, ey, er * 2);
  g.fillStyle(eyeColor, 1);
  g.fillCircle(c - ex, ey, er);
  g.fillCircle(c + ex, ey, er);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(c - ex, ey, Math.max(1, er * 0.4));
  g.fillCircle(c + ex, ey, Math.max(1, er * 0.4));

  g.generateTexture(key, size, size);
  g.destroy();
}

/** 星空＋うっすらグリッドの背景タイル */
function makeBackground(scene: Phaser.Scene) {
  const S = 256;
  const rnd = mulberry32(20260926);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x060913, 1);
  g.fillRect(0, 0, S, S);
  g.lineStyle(1, 0x0d1430, 1);
  for (let i = 0; i <= S; i += 64) {
    g.lineBetween(i, 0, i, S);
    g.lineBetween(0, i, S, i);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(rnd() * S);
    const y = Math.floor(rnd() * S);
    const a = 0.25 + rnd() * 0.6;
    g.fillStyle(rnd() < 0.2 ? 0x87ceeb : 0xffffff, a);
    g.fillRect(x, y, 1, 1);
    if (rnd() < 0.15) g.fillRect(x, y, 2, 2);
  }
  g.generateTexture('bg', S, S);
  g.destroy();
}

/** ステージ背景タイル（256×256）。敵が黒いシルエットなので、暗くしすぎない・低彩度・模様は弱く */
function makeStageBackgrounds(scene: Phaser.Scene) {
  const S = 256;
  // STAGE 1 宵の口：夕暮れの街並み・石畳
  {
    const rnd = mulberry32(101);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x6b5a78, 1);
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) {
      const off = (y / 32) % 2 === 0 ? 0 : 24;
      for (let x = -24; x < S; x += 48) {
        const shade = rnd();
        g.fillStyle(shade < 0.3 ? 0x74627f : shade < 0.6 ? 0x6f5e7b : 0x7a6685, 1);
        g.fillRect(x + off + 2, y + 2, 44, 28);
        if (rnd() < 0.25) { g.fillStyle(0x8a6e6a, 0.35); g.fillRect(x + off + 6, y + 6, 20, 8); }
      }
    }
    g.lineStyle(1, 0x5e4f6a, 0.6);
    for (let y = 0; y <= S; y += 32) g.lineBetween(0, y, S, y);
    g.generateTexture('bg_1', S, S);
    g.destroy();
  }
  // STAGE 2 真夜中：倉庫街のコンクリート・目地
  {
    const rnd = mulberry32(202);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x3e4b63, 1);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x42506a : 0x3a465d, 0.7);
      g.fillEllipse(rnd() * S, rnd() * S, 30 + rnd() * 60, 16 + rnd() * 30);
    }
    g.lineStyle(3, 0x4a5873, 1);
    for (let i = 0; i <= S; i += 128) { g.lineBetween(i, 0, i, S); g.lineBetween(0, i, S, i); }
    g.lineStyle(1, 0x34405a, 0.8);
    for (let i = 64; i < S; i += 128) { g.lineBetween(i, 0, i, S); g.lineBetween(0, i, S, i); }
    g.generateTexture('bg_2', S, S);
    g.destroy();
  }
  // STAGE 3 夜明け前：吹雪の夜の雪原（真っ白にしない）
  {
    const rnd = mulberry32(303);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xa9b8cc, 1);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      g.fillStyle(rnd() < 0.6 ? 0xc3cfdd : 0x9fb0c6, 0.55);
      g.fillEllipse(rnd() * S, rnd() * S, 40 + rnd() * 90, 14 + rnd() * 40);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle(0xffffff, 0.25 + rnd() * 0.3); g.fillRect(rnd() * S, rnd() * S, 2, 2); }
    g.generateTexture('bg_3', S, S);
    g.destroy();
  }
  // 雪片
  const s = scene.make.graphics({ x: 0, y: 0 }, false);
  s.fillStyle(0xffffff, 1);
  s.fillCircle(3, 3, 3);
  s.generateTexture('snow', 6, 6);
  s.destroy();
}

/** ダメージの数字に使うフォント（数字だけ）。キャンバスに描いた数字を、ビットマップフォントとして登録する */
export function ensureDamageFont(scene: Phaser.Scene): string {
  const key = 'dmgfont';
  if (scene.cache.bitmapFont.exists(key)) return key;
  const cw = 22;
  const ch = 32;
  const chars = '0123456789';
  const tex = scene.textures.createCanvas('dmgfont_tex', cw * chars.length, ch);
  if (!tex) return key;
  const c = tex.getContext();
  c.font = '700 27px "Oswald", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  for (let i = 0; i < chars.length; i++) {
    const x = i * cw + cw / 2;
    c.lineWidth = 5;
    c.strokeStyle = '#060913';
    c.strokeText(chars[i], x, ch / 2 + 1);
    c.fillStyle = '#ffffff';
    c.fillText(chars[i], x, ch / 2 + 1);
  }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  scene.cache.bitmapFont.add(key, Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'dmgfont_tex', width: cw, height: ch, chars, charsPerRow: chars.length,
    'offset.x': 0, 'offset.y': 0, 'spacing.x': 0, 'spacing.y': 0, lineSpacing: 0,
  }));
  return key;
}

/** 女王級の蕾：黒い茨に包まれた蕾。芯が金色に光る */
function makeBudTexture(scene: Phaser.Scene, key: string, size: number, glow: number, frame: number, outline: boolean, bodyColor = 0x141022) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = size / 2;
  const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
  // 根元の茨
  g.fillStyle(0x0a0c18, 1);
  g.fillEllipse(c, size - 4, size * 0.8, 7);
  // 蕾の外側（しずく形）
  const body = [V(c, 2), V(c + size * 0.3, size * 0.4), V(c + size * 0.36, size * 0.66), V(c + size * 0.2, size - 4), V(c - size * 0.2, size - 4), V(c - size * 0.36, size * 0.66), V(c - size * 0.3, size * 0.4)];
  g.fillStyle(bodyColor, 1);
  g.fillPoints(body, true);
  g.lineStyle(outline ? 2 : 1, outline ? 0xb8c4ff : 0x3a2a55, outline ? 0.5 : 1);
  g.strokePoints(body, true);
  // 花びらの筋
  g.lineStyle(1, 0x4a3570, 1);
  g.lineBetween(c, 3, c - size * 0.14, size - 6);
  g.lineBetween(c, 3, c + size * 0.14, size - 6);
  // 芯の光
  g.fillStyle(glow, frame === 0 ? 0.35 : 0.5);
  g.fillCircle(c, size * 0.58, size * (frame === 0 ? 0.2 : 0.24));
  g.fillStyle(glow, 1);
  g.fillCircle(c, size * 0.58, size * 0.11);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(c, size * 0.58, size * 0.05);
  g.generateTexture(key, size, size);
  g.destroy();
}

/** 城兵級の岩（岩壁の1個ぶん・砲弾）。シアンのひび割れ */
function makeRockTextures(scene: Phaser.Scene) {
  const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 岩壁の柱（48×64。足元中央が基準）
  const rock = [V(8, 62), V(2, 40), V(8, 14), V(20, 2), V(34, 6), V(44, 22), V(46, 46), V(40, 62)];
  g.fillStyle(0x1a1c26, 1);
  g.fillPoints(rock, true);
  g.fillStyle(0x2c303f, 1);
  g.fillPoints([V(8, 14), V(20, 2), V(34, 6), V(26, 20), V(12, 24)], true);
  g.fillStyle(0x3d4256, 1);
  g.fillPoints([V(20, 2), V(34, 6), V(28, 12)], true);
  g.fillStyle(0x10121a, 1);
  g.fillPoints([V(34, 6), V(44, 22), V(46, 46), V(40, 62), V(30, 62), V(32, 30)], true);
  g.lineStyle(1, 0x05060a, 1);
  g.strokePoints(rock, true);
  g.lineStyle(2, 0x40e0ff, 0.9);
  g.lineBetween(14, 30, 20, 40);
  g.lineBetween(20, 40, 16, 52);
  g.lineBetween(20, 40, 28, 46);
  g.lineStyle(1, 0xc8f8ff, 1);
  g.lineBetween(15, 32, 20, 40);
  g.generateTexture('fx_rock', 48, 64);
  // 砲弾（24×24）
  g.clear();
  g.fillStyle(0x1a1c26, 1);
  g.fillPoints([V(4, 8), V(12, 1), V(21, 6), V(23, 16), V(15, 23), V(5, 20), V(1, 13)], true);
  g.fillStyle(0x3d4256, 1);
  g.fillPoints([V(4, 8), V(12, 1), V(21, 6), V(12, 10)], true);
  g.lineStyle(2, 0x40e0ff, 0.9);
  g.lineBetween(8, 12, 13, 16);
  g.lineBetween(13, 16, 18, 13);
  g.generateTexture('fx_shell', 24, 24);
  g.destroy();
}

export function generateTextures(scene: Phaser.Scene) {
  makeRockTextures(scene);
  makeStageBackgrounds(scene);
  // 敵（2フレーム）
  let seed = 7;
  for (const def of Object.values(ENEMIES)) {
    if (def.isObject || def.sheet) continue; // スピーカーは別途生成、画像の敵はBootで読み込み
    if (def.bud) {
      // 女王級の蕾：専用の絵（1コマ目は、芯の光が強い）
      makeBudTexture(scene, `e_${def.id}_0`, def.size, def.eyeColor, 0, false, def.bodyColor);
      makeBudTexture(scene, `e_${def.id}_1`, def.size, def.eyeColor, 1, false, def.bodyColor);
      makeBudTexture(scene, `e_${def.id}_0_o`, def.size, def.eyeColor, 0, true, def.bodyColor);
      makeBudTexture(scene, `e_${def.id}_1_o`, def.size, def.eyeColor, 1, true, def.bodyColor);
      continue;
    }
    makeEnemyTexture(scene, `e_${def.id}_0`, def.size, def.eyeColor, seed, false);
    makeEnemyTexture(scene, `e_${def.id}_1`, def.size, def.eyeColor, seed + 1, false);
    makeEnemyTexture(scene, `e_${def.id}_0_o`, def.size, def.eyeColor, seed, true);
    makeEnemyTexture(scene, `e_${def.id}_1_o`, def.size, def.eyeColor, seed + 1, true);
    seed += 2;
  }

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // 自弾（スカイブルー）
  g.clear();
  g.fillStyle(0x87ceeb, 0.5);
  g.fillCircle(6, 6, 6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 3);
  g.generateTexture('bullet', 12, 12);

  // 敵弾（司祭級）
  g.clear();
  g.fillStyle(0x4dffb0, 0.35);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0x4dffb0, 1);
  g.fillCircle(8, 8, 4);
  g.fillStyle(0x05070f, 1);
  g.fillCircle(8, 8, 2);
  g.generateTexture('ebullet', 16, 16);

  // 声の欠片（菱形の光）
  g.clear();
  g.fillStyle(0x87ceeb, 0.5);
  g.fillPoints([new Phaser.Math.Vector2(7, 0), new Phaser.Math.Vector2(14, 9), new Phaser.Math.Vector2(7, 18), new Phaser.Math.Vector2(0, 9)], true);
  g.fillStyle(0xffffff, 1);
  g.fillPoints([new Phaser.Math.Vector2(7, 4), new Phaser.Math.Vector2(10, 9), new Phaser.Math.Vector2(7, 14), new Phaser.Math.Vector2(4, 9)], true);
  g.generateTexture('gem', 14, 18);

  // エール（コイン）
  g.clear();
  g.fillStyle(0xffd700, 1);
  g.fillCircle(7, 7, 7);
  g.fillStyle(0xfff3a0, 1);
  g.fillCircle(7, 7, 4);
  g.fillStyle(0xd4a300, 1);
  g.fillRect(6, 4, 2, 6);
  g.generateTexture('yell', 14, 14);

  // パーティクル用ドット
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture('px', 4, 4);

  // 影
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(12, 6, 24, 10);
  g.generateTexture('shadow', 24, 12);

  // ── アーツの弾・常駐物 ──
  // 火矢（紅蓮の矢）：右向き
  g.clear();
  g.fillStyle(0xff4500, 0.5);
  g.fillEllipse(14, 5, 24, 8);
  g.fillStyle(0xffd27f, 1);
  g.fillRect(4, 4, 18, 2);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(22, 1, 28, 5, 22, 9);
  g.generateTexture('art_arrow', 28, 10);

  // 星弾（星屑の裁定）
  g.clear();
  g.fillStyle(0xc0c0ff, 0.45);
  g.fillCircle(7, 7, 7);
  g.fillStyle(0xffffff, 1);
  const star: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 5 : 2.2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    star.push(new Phaser.Math.Vector2(7 + Math.cos(a) * r, 7 + Math.sin(a) * r));
  }
  g.fillPoints(star, true);
  g.generateTexture('art_star', 14, 14);

  // 跳ね返る弾（リフレッシュの弾丸）
  g.clear();
  g.fillStyle(0x7fffd4, 0.4);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0x7fffd4, 1);
  g.fillCircle(8, 8, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 2);
  g.generateTexture('art_refresh', 16, 16);

  // 御札（狐火の御札）：縦長の札＋炎
  g.clear();
  g.fillStyle(0xfff4dc, 1);
  g.fillRect(2, 2, 8, 16);
  g.fillStyle(0xc03020, 1);
  g.fillRect(4, 5, 4, 2);
  g.fillRect(4, 9, 4, 5);
  g.fillStyle(0xffa040, 0.8);
  g.fillCircle(6, 1, 3);
  g.generateTexture('art_ofuda', 12, 20);

  // 水圧の突き（怜水閃）：細く長い、右向き
  g.clear();
  g.fillStyle(0x87cefa, 0.45);
  g.fillRect(0, 2, 40, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRect(4, 3, 34, 2);
  g.fillTriangle(38, 0, 44, 4, 38, 8);
  g.generateTexture('art_thrust', 44, 8);

  // 衝撃波（旧『アクセル・レイド』。いまは未使用）：縦長の弧、右向き
  g.clear();
  g.fillStyle(0xe8f4ff, 0.35);
  g.fillEllipse(8, 16, 14, 32);
  g.lineStyle(3, 0xffffff, 0.95);
  g.beginPath();
  g.arc(2, 16, 12, -1.2, 1.2, false);
  g.strokePath();
  g.generateTexture('art_wave', 18, 32);

  // 氷の衝撃波（氷狼牙）：淡い水色の弧、右向き。先端に氷でできた狼の頭（横顔）
  g.clear();
  g.fillStyle(0xbfefff, 0.3);
  g.fillEllipse(8, 16, 14, 32);
  g.lineStyle(3, 0xbfefff, 0.95);
  g.beginPath();
  g.arc(2, 16, 12, -1.2, 1.2, false);
  g.strokePath();
  g.lineStyle(1, 0xffffff, 1);
  g.beginPath();
  g.arc(0, 16, 12, -1.1, 1.1, false);
  g.strokePath();
  g.fillStyle(0xe8f8ff, 1);
  g.fillTriangle(15, 11, 16, 3, 20, 10);
  g.fillTriangle(19, 11, 21, 4, 24, 11);
  g.fillPoints([{ x: 14, y: 11 }, { x: 24, y: 10 }, { x: 32, y: 15 }, { x: 32, y: 18 }, { x: 27, y: 19 }, { x: 24, y: 22 }, { x: 15, y: 22 }, { x: 13, y: 17 }], true);
  g.fillStyle(0x7fd0ff, 1);
  g.fillTriangle(27, 19, 25, 19, 26, 22);
  g.fillStyle(0x2a7fb8, 1);
  g.fillRect(22, 13, 2, 2);
  g.generateTexture('art_icewave', 34, 32);

  // 影（瞬影）：猫耳フードの小さな人影。半透明で使う
  g.clear();
  g.fillStyle(0x14141f, 1);
  g.fillTriangle(5, 6, 8, 0, 11, 6);
  g.fillTriangle(13, 6, 16, 0, 19, 6);
  g.fillCircle(12, 9, 6);
  g.fillTriangle(12, 12, 3, 30, 21, 30);
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(20, 16, 2, 9);
  g.fillStyle(0xd2b48c, 1);
  g.fillRect(9, 8, 2, 2);
  g.fillRect(13, 8, 2, 2);
  g.generateTexture('art_shadow', 24, 30);

  // 曳光弾（制圧射撃）：細い線、右向き
  g.clear();
  g.fillStyle(0xd8ff8a, 0.5);
  g.fillRect(0, 0, 22, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRect(8, 1, 14, 2);
  g.generateTexture('art_tracer', 22, 4);

  // 焔の猟犬（炎の玉）
  g.clear();
  g.fillStyle(0xff4500, 0.4);
  g.fillCircle(9, 9, 9);
  g.fillStyle(0xff6a00, 1);
  g.fillCircle(9, 9, 6);
  g.fillStyle(0xfff3a0, 1);
  g.fillCircle(8, 8, 3);
  g.generateTexture('art_hound', 18, 18);

  // 水流（流麗なる水衣）
  g.clear();
  g.fillStyle(0x87cefa, 0.4);
  g.fillEllipse(12, 8, 24, 14);
  g.fillStyle(0xbfe6ff, 1);
  g.fillEllipse(12, 8, 16, 8);
  g.fillStyle(0xffffff, 0.9);
  g.fillEllipse(10, 7, 6, 3);
  g.generateTexture('art_stream', 24, 16);

  // 狐火（九尾の狐火）
  g.clear();
  g.fillStyle(0xff6a00, 0.35);
  g.fillCircle(9, 10, 9);
  g.fillStyle(0xffa040, 1);
  g.fillPoints([new Phaser.Math.Vector2(9, 0), new Phaser.Math.Vector2(15, 9), new Phaser.Math.Vector2(9, 18), new Phaser.Math.Vector2(3, 9)], true);
  g.fillStyle(0xfff3a0, 1);
  g.fillPoints([new Phaser.Math.Vector2(9, 5), new Phaser.Math.Vector2(12, 10), new Phaser.Math.Vector2(9, 15), new Phaser.Math.Vector2(6, 10)], true);
  g.generateTexture('art_foxfire', 18, 18);

  // 傘（舞闘術）
  g.clear();
  g.fillStyle(0x2f4f4f, 1);
  g.fillEllipse(10, 6, 20, 10);
  g.fillStyle(0xdc143c, 1);
  g.fillRect(9, 6, 2, 12);
  g.fillStyle(0xffffff, 0.8);
  g.fillEllipse(10, 4, 8, 3);
  g.generateTexture('art_umbrella', 20, 20);

  // 水の盾（アクアシールド）
  g.clear();
  g.lineStyle(3, 0x87cefa, 0.9);
  g.strokeCircle(24, 24, 21);
  g.fillStyle(0x87cefa, 0.18);
  g.fillCircle(24, 24, 21);
  g.lineStyle(2, 0xffffff, 0.6);
  g.beginPath();
  g.arc(24, 24, 15, -2.4, -0.8, false);
  g.strokePath();
  g.generateTexture('shield', 48, 48);

  // ── フィールドアイテム ──
  // ギア一斉受信（青いアンテナ）
  g.clear();
  g.fillStyle(0x87ceeb, 1);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0x060913, 1);
  g.fillCircle(8, 8, 6);
  g.lineStyle(2, 0xffffff, 1);
  g.beginPath(); g.arc(8, 10, 5, Math.PI * 1.15, Math.PI * 1.85, false); g.strokePath();
  g.beginPath(); g.arc(8, 10, 2.5, Math.PI * 1.15, Math.PI * 1.85, false); g.strokePath();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 10, 1.2);
  g.generateTexture('item_magnet', 16, 16);

  // 月光のチーズケーキ（黄色い三角）
  g.clear();
  g.fillStyle(0xf0e68c, 1);
  g.fillTriangle(1, 14, 15, 14, 8, 2);
  g.fillStyle(0xd4a300, 1);
  g.fillRect(1, 12, 14, 3);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(8, 7, 2);
  g.generateTexture('item_cake', 16, 16);

  // ミニチャーハン（小皿に盛った炒飯）
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(8, 12, 14, 5);
  g.fillStyle(0xd8d8e0, 1);
  g.fillEllipse(8, 13, 12, 3);
  g.fillStyle(0xf2c14e, 1);
  g.fillEllipse(8, 9, 11, 8);
  g.fillStyle(0xffe08a, 1);
  g.fillEllipse(7, 7, 6, 4);
  g.fillStyle(0x5fbf5f, 1);
  g.fillRect(5, 8, 2, 1);
  g.fillRect(10, 6, 2, 1);
  g.fillStyle(0xff7f7f, 1);
  g.fillRect(8, 10, 2, 1);
  g.fillRect(11, 9, 1, 1);
  g.generateTexture('item_chahan', 16, 16);

  // 包丁（貫通チャーハン）：中華包丁、右向き
  g.clear();
  g.fillStyle(0x6b4a2a, 1);
  g.fillRect(0, 5, 6, 3);
  g.fillStyle(0xdfe6ee, 1);
  g.fillRect(6, 2, 11, 9);
  g.fillStyle(0xffffff, 1);
  g.fillRect(6, 9, 11, 2);
  g.fillStyle(0x9aa6b4, 1);
  g.fillRect(14, 3, 2, 2);
  g.generateTexture('art_knife', 18, 12);

  // 久遠の十字架（白い光）
  g.clear();
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 1);
  g.fillRect(7, 1, 2, 14);
  g.fillRect(3, 5, 10, 2);
  g.generateTexture('item_cross', 16, 16);

  // 美麗の宝石箱（桃色の箱）
  g.clear();
  g.fillStyle(0x8b2252, 1);
  g.fillRect(1, 6, 16, 10);
  g.fillStyle(0xff69b4, 1);
  g.fillRect(1, 3, 16, 5);
  g.fillStyle(0xffd700, 1);
  g.fillRect(8, 3, 2, 13);
  g.fillRect(7, 8, 4, 3);
  g.fillStyle(0xffffff, 0.8);
  g.fillRect(3, 4, 3, 1);
  g.generateTexture('item_chest', 18, 16);

  // 壊れたスピーカー（D-Stageの残骸）：2フレーム（ノイズ点滅）
  for (let f = 0; f < 2; f++) {
    g.clear();
    g.fillStyle(0x1a2350, 1);
    g.fillRect(4, 2, 24, 30);
    g.lineStyle(1, 0x3a4a8a, 1);
    g.strokeRect(4, 2, 24, 30);
    g.fillStyle(0x060913, 1);
    g.fillCircle(16, 12, 7);
    g.fillCircle(16, 24, 5);
    g.fillStyle(f === 0 ? 0x87ceeb : 0x2b3a8a, 1);
    g.fillCircle(16, 12, 3);
    g.fillCircle(16, 24, 2);
    // 割れ・ノイズ
    g.lineStyle(1, 0x87ceeb, 0.7);
    g.lineBetween(6, 4 + f * 3, 14, 10 + f * 3);
    g.fillStyle(0xff4d6d, 0.6);
    g.fillRect(20 - f * 6, 28 - f * 9, 6, 1);
    g.generateTexture(`e_speaker_${f}`, 32, 32);
  }

  // 満月
  g.clear();
  g.fillStyle(0xfff6d5, 0.18);
  g.fillCircle(90, 90, 90);
  g.fillStyle(0xfff6d5, 0.35);
  g.fillCircle(90, 90, 74);
  g.fillStyle(0xfff9e6, 1);
  g.fillCircle(90, 90, 60);
  g.fillStyle(0xe8dcb8, 0.7);
  g.fillCircle(70, 78, 9);
  g.fillCircle(104, 104, 13);
  g.fillCircle(100, 66, 5);
  g.generateTexture('moon', 180, 180);

  g.destroy();

  makeBackground(scene);
}
