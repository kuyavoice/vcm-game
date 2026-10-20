// 予兆攻撃の共通の仕組み（2026-10-20。闘技場から使い始める。既存のボスの予兆はまだ個別の実装のまま）。
// 形（円・輪・帯・扇）＋ 始まり／発動の時刻 ＋ ダメージ。発動の瞬間に、その中にいれば hurt。
// 見た目：縁（白＋危険色）＋ 薄い塗り ＋ 発動までに内側が満ちていく（FF14 式。満ちた＝発動と読める）。
// 床のアーツ（チャーハンの帯など）と区別するため、色は危険色（赤）で固定し、GameScene は予兆をアーツより上の層に描く。
import Phaser from 'phaser';

export type TelegraphShape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'ring'; x: number; y: number; inner: number; outer: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; half: number }
  | { kind: 'sector'; x: number; y: number; r: number; angle: number; halfArc: number };

export interface Telegraph {
  shape: TelegraphShape;
  /** 予兆の始まり（ゲーム内時刻 ms） */
  startAt: number;
  /** 発動（ゲーム内時刻 ms） */
  at: number;
  /** 発動の瞬間に中にいたときのダメージ（0 なら当たり判定なし＝合図だけ） */
  damage: number;
  color?: number;
  /** 発動の瞬間に呼ぶ（敵の移動・弾の発射など） */
  onFire?: () => void;
  /** 発動済み（GameScene が立てる） */
  fired?: boolean;
}

export const TELEGRAPH_COLOR = 0xff2244;

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/** 輪（内径 inner〜外径 outer）を1つの多角形として塗る（外周を一周 → 内周を逆回り） */
function fillAnnulus(g: Phaser.GameObjects.Graphics, x: number, y: number, inner: number, outer: number): void {
  const N = 72;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; pts.push({ x: x + Math.cos(a) * outer, y: y + Math.sin(a) * outer }); }
  for (let i = N; i >= 0; i--) { const a = (i / N) * Math.PI * 2; pts.push({ x: x + Math.cos(a) * inner, y: y + Math.sin(a) * inner }); }
  g.fillPoints(pts, true);
}

/** 点（半径 pr）が予兆の中にいるか */
export function telegraphHit(s: TelegraphShape, px: number, py: number, pr: number): boolean {
  switch (s.kind) {
    case 'circle':
      return Math.hypot(px - s.x, py - s.y) < s.r + pr;
    case 'ring': {
      const d = Math.hypot(px - s.x, py - s.y);
      return d > s.inner - pr && d < s.outer + pr;
    }
    case 'line':
      return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2) < s.half + pr;
    case 'sector': {
      const d = Math.hypot(px - s.x, py - s.y);
      if (d >= s.r + pr) return false;
      return Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py - s.y, px - s.x) - s.angle)) <= s.halfArc;
    }
  }
}

/** 予兆を描く。k＝満ち具合（0〜1）。flash が真なら発動の閃光（濃く・輪郭のみ） */
export function drawTelegraph(g: Phaser.GameObjects.Graphics, s: TelegraphShape, k: number, color = TELEGRAPH_COLOR, flash = false): void {
  const fillA = flash ? 0.5 : 0.16 + k * 0.16;
  const innerA = flash ? 0 : 0.26 + k * 0.22;
  switch (s.kind) {
    case 'circle': {
      g.fillStyle(color, fillA);
      g.fillCircle(s.x, s.y, s.r);
      if (innerA > 0) { g.fillStyle(color, innerA); g.fillCircle(s.x, s.y, s.r * k); }
      g.lineStyle(4, 0xffffff, 0.85);
      g.strokeCircle(s.x, s.y, s.r);
      g.lineStyle(2, color, 0.95);
      g.strokeCircle(s.x, s.y, s.r + 3);
      return;
    }
    case 'ring': {
      // 輪は太いストロークだと半透明の三角形が重なって放射状の筋が出るので、外周＋内周を1つの多角形にして塗る
      const w = s.outer - s.inner;
      g.fillStyle(color, fillA);
      fillAnnulus(g, s.x, s.y, s.inner, s.outer);
      if (innerA > 0 && k > 0) { g.fillStyle(color, innerA); fillAnnulus(g, s.x, s.y, s.inner, s.inner + w * k); }
      g.lineStyle(4, 0xffffff, 0.85);
      g.strokeCircle(s.x, s.y, s.inner);
      g.strokeCircle(s.x, s.y, s.outer);
      g.lineStyle(2, color, 0.95);
      g.strokeCircle(s.x, s.y, s.outer + 3);
      return;
    }
    case 'line': {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy) || 1;
      const px = (-dy / len) * s.half;
      const py = (dx / len) * s.half;
      g.lineStyle(s.half * 2, color, fillA);
      g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      if (innerA > 0 && k > 0) { g.lineStyle(s.half * 2, color, innerA); g.lineBetween(s.x1, s.y1, s.x1 + dx * k, s.y1 + dy * k); }
      g.lineStyle(4, 0xffffff, 0.85);
      g.strokePoints([
        { x: s.x1 + px, y: s.y1 + py }, { x: s.x2 + px, y: s.y2 + py }, { x: s.x2 - px, y: s.y2 - py }, { x: s.x1 - px, y: s.y1 - py },
      ], true);
      g.lineStyle(2, color, 0.95);
      g.lineBetween(s.x1 + px * 1.05, s.y1 + py * 1.05, s.x2 + px * 1.05, s.y2 + py * 1.05);
      g.lineBetween(s.x1 - px * 1.05, s.y1 - py * 1.05, s.x2 - px * 1.05, s.y2 - py * 1.05);
      return;
    }
    case 'sector': {
      g.fillStyle(color, fillA);
      g.slice(s.x, s.y, s.r, s.angle - s.halfArc, s.angle + s.halfArc, false);
      g.fillPath();
      if (innerA > 0 && k > 0) {
        g.fillStyle(color, innerA);
        g.slice(s.x, s.y, s.r * k, s.angle - s.halfArc, s.angle + s.halfArc, false);
        g.fillPath();
      }
      g.lineStyle(4, 0xffffff, 0.85);
      g.slice(s.x, s.y, s.r, s.angle - s.halfArc, s.angle + s.halfArc, false);
      g.strokePath();
      g.lineStyle(2, color, 0.95);
      g.slice(s.x, s.y, s.r + 3, s.angle - s.halfArc, s.angle + s.halfArc, false);
      g.strokePath();
      return;
    }
  }
}
