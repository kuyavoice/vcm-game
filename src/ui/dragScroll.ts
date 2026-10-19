import Phaser from 'phaser';

/**
 * 縦に長い画面を、なぞって送る（オプション・クレジット）。
 * 2026-10-19 修正：以前は scene の pointerdown で開始位置を控えていたが、ボタンの pointerdown が stopPropagation するため
 * ボタンの上で指を置いたときは開始位置が更新されず、指がわずかに動くと古い開始位置で画面が別の場所へ跳んで、ボタンが指の下から消えてタップが通らなかった
 * （スマホで「戻るが反応しない」「もう片方の手で押さえないと押せない」）。
 * 今はポインタ自身が持つ押した位置（downY・downTime）から毎回求め、10px 以上動くまでは送らない（タップの揺れで動かさない）。
 */
export function enableDragScroll(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, maxScroll: number, threshold = 10): void {
  if (maxScroll <= 0) return;
  let dragId = -1;
  let dragDown = -1;
  let startY = 0;
  let startScroll = 0;
  let dragging = false;
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!p.isDown) return;
    if (p.id !== dragId || p.downTime !== dragDown) {
      dragId = p.id;
      dragDown = p.downTime;
      startY = p.downY;
      startScroll = cam.scrollY;
      dragging = false;
    }
    if (!dragging && Math.abs(p.y - startY) < threshold) return;
    dragging = true;
    cam.scrollY = Phaser.Math.Clamp(startScroll + (startY - p.y), 0, maxScroll);
  });
}
