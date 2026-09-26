import Phaser from 'phaser';

export interface SafeInsets { top: number; bottom: number; left: number; right: number }

/** CSSのセーフエリア(env())をゲーム座標のpxに換算して返す */
export function getSafeInsets(scale: Phaser.Scale.ScaleManager): SafeInsets {
  const probe = document.getElementById('safe-probe');
  if (!probe) return { top: 0, bottom: 0, left: 0, right: 0 };
  const cs = getComputedStyle(probe);
  const ratio = scale.displayScale ? scale.displayScale.y : 1;
  const px = (v: string) => (parseFloat(v) || 0) * (ratio || 1);
  return {
    top: px(cs.paddingTop),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
    right: px(cs.paddingRight),
  };
}
