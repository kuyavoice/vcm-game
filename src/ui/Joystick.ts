import Phaser from 'phaser';

/** フローティング仮想スティック：触った場所が中心。指を離すと停止 */
export class Joystick {
  private base: Phaser.GameObjects.Graphics;
  private pointerId = -1;
  private origin = new Phaser.Math.Vector2();
  private vec = new Phaser.Math.Vector2();
  readonly radius = 70;
  /** 正規化済みの入力（0〜1） */
  readonly value = new Phaser.Math.Vector2();

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.graphics().setDepth(90).setScrollFactor(0).setVisible(false);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.pointerId !== -1 || over.length > 0) return;
      this.pointerId = p.id;
      this.origin.set(p.x, p.y);
      this.vec.set(0, 0);
      this.value.set(0, 0);
      this.draw();
      this.base.setVisible(true);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.vec.set(p.x - this.origin.x, p.y - this.origin.y);
      const len = this.vec.length();
      if (len > this.radius) {
        // スティックの中心を指に追従させる（大きくなぞっても操作が切れない）
        const over = len - this.radius;
        this.origin.x += (this.vec.x / len) * over;
        this.origin.y += (this.vec.y / len) * over;
        this.vec.setLength(this.radius);
      }
      this.value.set(this.vec.x / this.radius, this.vec.y / this.radius);
      this.draw();
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = -1;
      this.value.set(0, 0);
      this.base.setVisible(false);
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  get active(): boolean {
    return this.pointerId !== -1;
  }

  /** 毎フレーム呼ぶ：追跡中の指が（upイベントを取りこぼして）離れていたら停止する安全弁 */
  update(): void {
    if (this.pointerId === -1) return;
    const p = this.scene.input.manager.pointers.find((pt) => pt.id === this.pointerId);
    if (!p || !p.isDown) this.reset();
  }

  /** ポーズ・終了時に入力を強制解除 */
  reset(): void {
    this.pointerId = -1;
    this.value.set(0, 0);
    this.base.setVisible(false);
  }

  private draw(): void {
    const g = this.base;
    g.clear();
    g.lineStyle(2, 0x87ceeb, 0.5);
    g.strokeCircle(this.origin.x, this.origin.y, this.radius);
    g.fillStyle(0x87ceeb, 0.08);
    g.fillCircle(this.origin.x, this.origin.y, this.radius);
    g.fillStyle(0x87ceeb, 0.55);
    g.fillCircle(this.origin.x + this.vec.x, this.origin.y + this.vec.y, 26);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(this.origin.x + this.vec.x, this.origin.y + this.vec.y, 8);
  }

  destroy(): void {
    this.base.destroy();
  }
}
