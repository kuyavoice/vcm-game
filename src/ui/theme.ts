import Phaser from 'phaser';
import { COLORS } from '../utils/fonts';

/**
 * UI の部品（2026-10-04。コンテスト向けの統一。ユーザー承認「A. ルールと部品」）。
 * 決まりごと：
 * - パネルは「右上の角を斜めに落とした四角＋左の太い色帯＋上辺の細い光」の1種類。角丸と素の四角は使わない
 * - 出現は「右から 36px 滑り込みながら出る」を、上から順に 45ms ずつずらす（stagger）
 * - 画面の切り替えは斜めのワイプ（wipeOut → scene.start → wipeIn）。フェードは使わない
 * - 文字は見出しだけ中央寄せ。一覧は左寄せ
 */
export const UI = {
  /** 右上の角を落とす大きさ */
  cut: 18,
  /** 左の色帯の幅 */
  stripe: 6,
  fill: COLORS.deepblue,
  fillAlpha: 0.94,
  /** 未解放・無効のときの色 */
  dim: 0x3a4a8a,
  shadow: 6,
  /** ワイプの斜めのずれ */
  wipeSkew: 140,
} as const;

export interface PanelOpts {
  /** 帯と枠の色（既定は水色） */
  color?: number;
  /** 塗りの色・濃さ */
  fill?: number;
  alpha?: number;
  /** 枠の色（省略で color）・太さ・濃さ */
  stroke?: number;
  strokeWidth?: number;
  strokeAlpha?: number;
  /** 左の色帯の幅。false で無し */
  stripe?: number | false;
  /** 角を落とす大きさ。0 で落とさない */
  cut?: number;
  /** 右下に影を落とす（浮いているカード向け） */
  shadow?: boolean;
  /** 上辺の細い光を出す */
  highlight?: boolean;
  depth?: number;
}

export interface Panel {
  gfx: Phaser.GameObjects.Graphics;
  /** 状態が変わったら描き直す（選択中は枠を金色に、など）。渡した項目だけ上書き */
  redraw(o: PanelOpts): void;
}

/**
 * 統一パネル。x, y は左上。コンテナに入れるときは x=-w/2, y=-h/2 を渡す。
 */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: PanelOpts = {}): Panel {
  // Graphics 自体を (x, y) に置き、中は原点から描く（cascade で動かせるように）
  const gfx = scene.add.graphics({ x, y });
  if (opts.depth !== undefined) gfx.setDepth(opts.depth);
  let cur: PanelOpts = { ...opts };
  const draw = () => {
    const color = cur.color ?? COLORS.accent;
    const fill = cur.fill ?? UI.fill;
    const alpha = cur.alpha ?? UI.fillAlpha;
    const stroke = cur.stroke ?? color;
    const sw = cur.strokeWidth ?? 2;
    const sa = cur.strokeAlpha ?? 0.6;
    const stripe = cur.stripe === undefined ? UI.stripe : cur.stripe;
    const cut = Math.min(cur.cut ?? UI.cut, h / 2, w / 2);
    const pts = (ox: number, oy: number) => [
      new Phaser.Math.Vector2(ox, oy),
      new Phaser.Math.Vector2(w - cut + ox, oy),
      new Phaser.Math.Vector2(w + ox, cut + oy),
      new Phaser.Math.Vector2(w + ox, h + oy),
      new Phaser.Math.Vector2(ox, h + oy),
    ];
    gfx.clear();
    if (cur.shadow) {
      gfx.fillStyle(0x000000, 0.45);
      gfx.fillPoints(pts(UI.shadow, UI.shadow), true);
    }
    gfx.fillStyle(fill, alpha);
    gfx.fillPoints(pts(0, 0), true);
    if (stripe) {
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 8, stripe, h - 16);
    }
    if (cur.highlight !== false) {
      gfx.lineStyle(1, 0xffffff, 0.18);
      gfx.lineBetween((stripe || 0) + 6, 1, w - cut - 2, 1);
    }
    if (sw > 0) {
      gfx.lineStyle(sw, stroke, sa);
      gfx.strokePoints(pts(0, 0), true);
    }
  };
  draw();
  return {
    gfx,
    redraw(o: PanelOpts) {
      cur = { ...cur, ...o };
      draw();
    },
  };
}

/**
 * 画面の中身を上から順に出す（右から 28px 滑り込みながら）。create() が終わった直後に、そのとき居る子を対象にする。
 * 背景（TileSprite）・画面いっぱいの覆い・ワイプの覆い・Zone は動かさない。
 * 自前の出現アニメがある画面（キャラ選択・ステージ選択・レベルアップ・リザルト・タイトル）では使わない
 */
export function cascade(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const W = cam.width;
  const H = cam.height;
  type Movable = Phaser.GameObjects.GameObject & { x: number; y: number; alpha: number; width?: number; height?: number; depth: number; setAlpha(a: number): unknown };
  const items = scene.children.list.filter((o) => {
    const a = o as Movable;
    if (typeof a.x !== 'number' || typeof a.y !== 'number') return false;
    if (a.depth >= 5000) return false;
    if (o.type === 'TileSprite' || o.type === 'Zone') return false;
    if ((a.width ?? 0) >= W * 0.95 && (a.height ?? 0) >= H * 0.5) return false;
    return true;
  }) as Movable[];
  if (items.length === 0) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const a of items) { minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y); }
  const span = Math.max(1, maxY - minY);
  for (const a of items) {
    const x0 = a.x;
    const alpha0 = a.alpha;
    a.x = x0 + 28;
    a.setAlpha(0);
    scene.tweens.add({ targets: a, x: x0, alpha: alpha0, duration: 220, delay: 60 + ((a.y - minY) / span) * 300, ease: 'Cubic.out' });
  }
}

/** create() が終わったら cascade を掛ける（重ねて出す画面：オプション・ポーズ） */
export function reveal(scene: Phaser.Scene): void {
  scene.events.once(Phaser.Scenes.Events.CREATE, () => cascade(scene));
}

/** 一覧の出現：右から滑り込みながら出る。上から順に step ms ずつ遅らせる */
export function stagger(scene: Phaser.Scene, targets: Phaser.GameObjects.GameObject[], opts: { delay?: number; step?: number; dx?: number; duration?: number } = {}): void {
  const step = opts.step ?? 45;
  const dx = opts.dx ?? 36;
  const duration = opts.duration ?? 220;
  targets.forEach((t, i) => {
    const o = t as unknown as { x: number; alpha: number; setAlpha(a: number): unknown };
    if (typeof o.x !== 'number') return;
    const x0 = o.x;
    o.x = x0 + dx;
    o.setAlpha(0);
    scene.tweens.add({ targets: t, x: x0, alpha: 1, duration, delay: (opts.delay ?? 0) + step * i, ease: 'Cubic.out' });
  });
}

/** 斜めの覆いを作る（画面より skew ぶん広い平行四辺形）。先端にアクセントの帯 */
function cover(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const cam = scene.cameras.main;
  const W = cam.width;
  const H = cam.height;
  const k = UI.wipeSkew;
  const g = scene.add.graphics().setDepth(5000).setScrollFactor(0);
  g.fillStyle(COLORS.night, 1);
  g.fillPoints([new Phaser.Math.Vector2(k, 0), new Phaser.Math.Vector2(W + k * 2, 0), new Phaser.Math.Vector2(W + k, H), new Phaser.Math.Vector2(0, H)], true);
  g.fillStyle(COLORS.accent, 0.9);
  g.fillPoints([new Phaser.Math.Vector2(W + k * 2, 0), new Phaser.Math.Vector2(W + k * 2 + 10, 0), new Phaser.Math.Vector2(W + k + 10, H), new Phaser.Math.Vector2(W + k, H)], true);
  g.fillStyle(COLORS.accent, 0.9);
  g.fillPoints([new Phaser.Math.Vector2(k - 10, 0), new Phaser.Math.Vector2(k, 0), new Phaser.Math.Vector2(0, H), new Phaser.Math.Vector2(-10, H)], true);
  return g;
}

const wiping = new WeakSet<Phaser.Scene>();

/** 画面を斜めの覆いで隠してから、次の画面へ。二重に呼んでも1回だけ */
export function go(scene: Phaser.Scene, key: string, data?: object): void {
  if (wiping.has(scene)) return;
  wiping.add(scene);
  const W = scene.cameras.main.width;
  const g = cover(scene);
  g.setX(-(W + UI.wipeSkew * 2) - 10);
  scene.tweens.add({
    targets: g, x: 0, duration: 200, ease: 'Cubic.in',
    onComplete: () => {
      wiping.delete(scene);
      scene.scene.start(key, data);
    },
  });
}

/**
 * 画面が始まったとき：覆いが右へ抜けて中身が現れる。create() の最初で呼ぶ（cam.fadeIn の代わり）。
 * 既定では中身の cascade も掛ける。自前の出現アニメがある画面は { cascade: false }
 */
export function wipeIn(scene: Phaser.Scene, opts: { cascade?: boolean } = {}): void {
  const W = scene.cameras.main.width;
  const g = cover(scene);
  scene.tweens.add({ targets: g, x: W + UI.wipeSkew * 2 + 10, duration: 260, ease: 'Cubic.out', onComplete: () => g.destroy() });
  if (opts.cascade !== false) reveal(scene);
}
