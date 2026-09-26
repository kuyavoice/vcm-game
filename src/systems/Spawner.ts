import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { ITEMS } from '../data/items';
import { bandAt, type WaveBand } from '../data/waves';
import { STAGES, type StageDef } from '../data/stages';
import { Enemy } from '../entities/Enemy';

/** waves.ts に従って画面外から敵を湧かせる。壊れたスピーカーの配置とボス出現も担当 */
export class Spawner {
  private acc = 0;
  private ambushTimer = 0;
  private speakerTimer = ITEMS.speaker.intervalSec * 0.5;
  private lastBand?: WaveBand;
  bossSpawned = false;
  onBandChange?: (band: WaveBand) => void;
  onBossSpawn?: (boss: Enemy) => void;

  constructor(
    private scene: Phaser.Scene,
    private enemies: Phaser.GameObjects.Group,
    private target: { x: number; y: number },
    private stage: StageDef = STAGES[0],
  ) {}

  get band(): WaveBand | undefined {
    return this.lastBand;
  }

  update(dt: number, t: number): void {
    const band = bandAt(t);
    if (band !== this.lastBand) {
      this.lastBand = band;
      this.ambushTimer = band.ambush ? band.ambush.everySec * 0.5 : 0;
      this.onBandChange?.(band);
    }

    const p = Phaser.Math.Clamp((t - band.from) / Math.max(1, band.to - band.from), 0, 1);
    let rate = Phaser.Math.Linear(band.spawnPerSecStart, band.spawnPerSecEnd, p) * this.stage.spawnMul;
    if (band.fullMoon) rate *= CONFIG.fullMoon.spawnMul;
    const hpMul = band.hpMul * this.stage.enemyHpMul;
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      const id = this.pick(band);
      const pos = this.ringPoint();
      this.spawnOne(id, pos.x, pos.y, hpMul);
    }

    if (band.ambush) {
      this.ambushTimer += dt;
      if (this.ambushTimer >= band.ambush.everySec) {
        this.ambushTimer = 0;
        this.ambush(band.ambush.type, Math.round(band.ambush.count * this.stage.spawnMul), hpMul);
      }
    }

    // ボス
    if (band.boss && !this.bossSpawned) {
      this.bossSpawned = true;
      const pos = this.ringPoint();
      const boss = this.spawnOne(band.boss, pos.x, pos.y, 1);
      if (boss) this.onBossSpawn?.(boss);
    }

    // 壊れたスピーカー（ボス戦中は置かない）
    if (!this.bossSpawned) {
      this.speakerTimer += dt;
      if (this.speakerTimer >= ITEMS.speaker.intervalSec) {
        this.speakerTimer = 0;
        this.placeSpeaker();
      }
    }
  }

  /** 出現比率：2:00 以降はステージの追加比率を足す（強敵を早めに混ぜる） */
  private weightsFor(band: WaveBand): Partial<Record<EnemyId, number>> {
    if (band.from < 120 || band.boss) return band.weights;
    const w: Partial<Record<EnemyId, number>> = { ...band.weights };
    for (const [id, extra] of Object.entries(this.stage.extraWeights)) {
      w[id as EnemyId] = (w[id as EnemyId] ?? 0) + (extra ?? 0);
    }
    return w;
  }

  private pick(band: WaveBand): EnemyId {
    const weights = this.weightsFor(band);
    let total = 0;
    for (const w of Object.values(weights)) total += w ?? 0;
    let r = Math.random() * total;
    for (const [id, w] of Object.entries(weights)) {
      r -= w ?? 0;
      if (r <= 0) return id as EnemyId;
    }
    return 'grunt';
  }

  /** 画面の外周（矩形の少し外側）のランダムな点 */
  private ringPoint(): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    const w = cam.width + CONFIG.spawnMargin * 2;
    const h = cam.height + CONFIG.spawnMargin * 2;
    const cx = this.target.x;
    const cy = this.target.y;
    const per = 2 * (w + h);
    let d = Math.random() * per;
    if (d < w) return { x: cx - w / 2 + d, y: cy - h / 2 };
    d -= w;
    if (d < h) return { x: cx + w / 2, y: cy - h / 2 + d };
    d -= h;
    if (d < w) return { x: cx + w / 2 - d, y: cy + h / 2 };
    d -= w;
    return { x: cx - w / 2, y: cy + h / 2 - d };
  }

  /** 片側から群れで奇襲 */
  private ambush(type: EnemyId, count: number, hpMul: number): void {
    const cam = this.scene.cameras.main;
    const side = Math.floor(Math.random() * 4);
    const cx = this.target.x;
    const cy = this.target.y;
    const hw = cam.width / 2 + CONFIG.spawnMargin;
    const hh = cam.height / 2 + CONFIG.spawnMargin;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count - 0.5;
      let x = cx;
      let y = cy;
      if (side === 0) { x = cx + u * cam.width; y = cy - hh; }
      else if (side === 1) { x = cx + hw; y = cy + u * cam.height; }
      else if (side === 2) { x = cx + u * cam.width; y = cy + hh; }
      else { x = cx - hw; y = cy + u * cam.height; }
      this.spawnOne(type, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, hpMul);
    }
  }

  private placeSpeaker(): void {
    const list = this.enemies.getChildren() as Enemy[];
    let alive = 0;
    for (const e of list) if (e.active && e.def.isObject) alive++;
    if (alive >= ITEMS.speaker.maxAlive) return;
    const a = Math.random() * Math.PI * 2;
    const d = Phaser.Math.Between(ITEMS.speaker.minDist, ITEMS.speaker.maxDist);
    this.spawnOne('speaker', this.target.x + Math.cos(a) * d, this.target.y + Math.sin(a) * d, 1);
  }

  spawnOne(id: EnemyId, x: number, y: number, hpMul: number): Enemy | null {
    if (this.enemies.countActive(true) >= CONFIG.maxEnemies) return null;
    const e = this.enemies.get(x, y) as Enemy | null;
    if (!e) return null;
    e.spawn(ENEMIES[id], x, y, hpMul);
    return e;
  }
}
