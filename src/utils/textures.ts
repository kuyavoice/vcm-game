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
function makeEnemyTexture(scene: Phaser.Scene, key: string, size: number, eyeColor: number, seed: number) {
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
  // 薄い縁（1pxアウトライン）
  g.lineStyle(1, 0x1a2350, 1);
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

export function generateTextures(scene: Phaser.Scene) {
  // 敵（2フレーム）
  let seed = 7;
  for (const def of Object.values(ENEMIES)) {
    if (def.isObject) continue; // スピーカーは別途生成
    makeEnemyTexture(scene, `e_${def.id}_0`, def.size, def.eyeColor, seed++);
    makeEnemyTexture(scene, `e_${def.id}_1`, def.size, def.eyeColor, seed++);
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
