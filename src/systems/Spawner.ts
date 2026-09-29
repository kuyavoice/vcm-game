import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { ITEMS } from '../data/items';
import { bandAt, type WaveBand } from '../data/waves';
import { STAGES, type StageDef } from '../data/stages';
import { ENDLESS } from '../data/endless';
import { Enemy } from '../entities/Enemy';

/** waves.ts に従って画面外から敵を湧かせる。壊れたスピーカーの配置とボス出現も担当 */
export class Spawner {
  private acc = 0;
  private ambushTimer = 0;
  private speakerTimer = ITEMS.speaker.intervalSec * 0.5;
  private lastBand?: WaveBand;
  /** ボスを出した帯 */
  private bossBands = new Set<WaveBand>();
  /** ボスが生きている間は true（スピーカーを置かない） */
  bossActive = false;
  /** エンドレス：いま何周目か（0から）と、出し終えたボスの数 */
  cycle = 0;
  private endlessBosses = 0;
  /** index／total：同じ時間帯に出すボスの何体目か（字幕・効果音は1体目だけ） */
  onBossSpawn?: (boss: Enemy, hpMul: number, index: number, total: number, enraged: boolean) => void;
  onBandChange?: (band: WaveBand) => void;
  constructor(
    private scene: Phaser.Scene,
    private enemies: Phaser.GameObjects.Group,
    private target: { x: number; y: number },
    private stage: StageDef = STAGES[0],
  ) {}

  get band(): WaveBand | undefined {
    return this.lastBand;
  }

  /** その時間帯に出るボス（独自の時間帯を持たないステージは、ステージごとのボス） */
  private bossOf(band: WaveBand): EnemyId | undefined {
    if (!band.boss) return undefined;
    return this.stage.bossId && !this.stage.waves ? this.stage.bossId : band.boss;
  }

  /** 画面に出す時間帯の名前（ボスの時間帯は、ボスの名前） */
  get bandLabel(): string {
    const b = this.lastBand;
    if (!b) return '';
    const boss = this.bossOf(b);
    if (this.stage.endless) return `${this.cycle + 1}周目　${b.label}`;
    return boss && !this.stage.waves ? ENEMIES[boss].name : b.label;
  }

  update(dt: number, t: number): void {
    // エンドレス：2周目からは、20分の時間帯を繰り返す
    const endless = !!this.stage.endless;
    let list = this.stage.waves;
    let tl = t;
    if (endless) {
      this.cycle = Math.floor(t / ENDLESS.loopSec);
      tl = t - this.cycle * ENDLESS.loopSec;
      if (this.cycle > 0) list = ENDLESS.loopWaves;
    }
    const band = bandAt(tl, list);
    const ramp = this.stage.ramp;
    const min = t / 60;
    const rampHp = ramp ? 1 + ramp.hpPerMin * min : 1;
    const rampSpawn = ramp ? 1 + ramp.spawnPerMin * min : 1;
    if (band !== this.lastBand) {
      this.lastBand = band;
      this.ambushTimer = band.ambush ? band.ambush.everySec * 0.5 : 0;
      this.onBandChange?.(band);
    }

    const p = Phaser.Math.Clamp((tl - band.from) / Math.max(1, band.to - band.from), 0, 1);
    let rate = Phaser.Math.Linear(band.spawnPerSecStart, band.spawnPerSecEnd, p) * this.stage.spawnMul * rampSpawn;
    if (band.fullMoon) rate *= CONFIG.fullMoon.spawnMul;
    if (endless && this.bossActive) rate *= ENDLESS.bossSpawnMul;
    const hpMul = band.hpMul * this.stage.enemyHpMul * rampHp;
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

    // エンドレスのボス：5分ごとに1体。順番に出て、1周するたびに硬くなる。2周目からは最初から後半の行動
    if (endless) {
      const k = Math.floor(t / ENDLESS.bossEverySec);
      if (k > this.endlessBosses) {
        this.endlessBosses = k;
        const def = ENDLESS.bosses[(k - 1) % ENDLESS.bosses.length];
        const round = Math.floor((k - 1) / ENDLESS.bosses.length);
        const pos = ENEMIES[def.id].fixed ? this.nearPoint(CONFIG.queen.spawnDistance) : this.ringPoint();
        const boss = this.spawnBoss(def.id, pos.x, pos.y);
        if (boss) { this.bossActive = true; this.onBossSpawn?.(boss, def.hpMul * (1 + ENDLESS.cycleBossHpAdd * round), 0, 1, round >= 1); }
      }
    }

    // ボス（帯ごとに一度。数と帯のHP倍率）
    if (band.boss && !this.bossBands.has(band)) {
      this.bossBands.add(band);
      const n = band.bossCount ?? 1;
      for (let i = 0; i < n; i++) {
        const id = this.bossOf(band) ?? band.boss;
        // 動かないボスは、画面の中に出す（外に出すと、探しに行かないと戦えない）
        const pos = ENEMIES[id].fixed ? this.nearPoint(CONFIG.queen.spawnDistance) : this.ringPoint();
        const boss = this.spawnBoss(id, pos.x, pos.y);
        if (boss) { this.bossActive = true; this.onBossSpawn?.(boss, band.bossHpMul ?? 1, i, n, !!band.bossEnraged); }
      }
    }

    // 壊れたスピーカー（ボス戦中は置かない）
    if (!this.bossActive) {
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

  /** プレイヤーから dist だけ離れた点（上か、左右の斜め上。縦長の画面の中に収まる向き） */
  private nearPoint(dist: number): { x: number; y: number } {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    return { x: this.target.x + Math.cos(a) * dist, y: this.target.y + Math.sin(a) * dist };
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

  /** ボスは、敵の数が上限に達していても必ず出す（いちばん遠い雑魚を1体消して枠を空ける） */
  private spawnBoss(id: EnemyId, x: number, y: number): Enemy | null {
    if (this.enemies.countActive(true) >= CONFIG.maxEnemies) {
      let far: Enemy | null = null;
      let farDist = -1;
      for (const e of this.enemies.getChildren() as Enemy[]) {
        if (!e.active || e.def.boss || e.def.isObject) continue;
        const d = (e.x - this.target.x) ** 2 + (e.y - this.target.y) ** 2;
        if (d > farDist) { farDist = d; far = e; }
      }
      far?.despawn();
    }
    return this.spawnOne(id, x, y, 1);
  }

  spawnOne(id: EnemyId, x: number, y: number, hpMul: number): Enemy | null {
    if (this.enemies.countActive(true) >= CONFIG.maxEnemies) return null;
    const e = this.enemies.get(x, y) as Enemy | null;
    if (!e) return null;
    e.spawn(ENEMIES[id], x, y, hpMul);
    // 背景が暗いステージは、淡い縁取りの付いた絵を使う（縁取り版のある敵だけ）
    if (this.stage.enemyOutline && !ENEMIES[id].isObject && this.scene.anims.exists(`anim_e_${id}_o`)) {
      e.animSuffix = '_o';
      e.playLoop();
      e.anims.setProgress(Math.random());
    }
    return e;
  }
}
