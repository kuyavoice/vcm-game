import Phaser from 'phaser';
import { loadSave } from './storage';

/**
 * 画面全体の光（必殺・ボス撃破・十字架・大当たりなど）。オプション「SCREEN FLASH」で強さを選べる（2026-10-01）。
 * - on：今までどおり（カメラのフラッシュ）
 * - soft：薄い色を重ねて、短く消す
 * - off：光らない
 */
export function screenFlash(scene: Phaser.Scene, ms: number, r = 255, g = 255, b = 255): void {
  const mode = loadSave().settings.screenFlash;
  if (mode === 'off') return;
  const cam = scene.cameras.main;
  if (mode !== 'soft') {
    cam.flash(ms, r, g, b);
    return;
  }
  const color = (r << 16) | (g << 8) | b;
  const rect = scene.add.rectangle(0, 0, cam.width, cam.height, color, 0.3).setOrigin(0).setScrollFactor(0).setDepth(500);
  scene.tweens.add({ targets: rect, alpha: 0, duration: Math.max(80, ms * 0.7), onComplete: () => rect.destroy() });
}
