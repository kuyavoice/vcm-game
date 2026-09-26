import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { CHARACTERS, DEFAULT_CHARACTER } from '../data/characters';
import { stageById, type StageDef } from '../data/stages';
import { ITEMS, PICKUPS, type PickupKind } from '../data/items';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet, EnemyBullet, type BulletOpts } from '../entities/Bullet';
import { Pickup } from '../entities/Pickup';
import { SpatialHash } from '../systems/SpatialHash';
import { Spawner } from '../systems/Spawner';
import { XpSystem } from '../systems/XpSystem';
import type { BattleContext, ZoneOpts } from '../systems/WeaponSystem';
import { UpgradeState, type Choice, type ChestResult } from '../systems/Upgrades';
import { Hud } from '../ui/Hud';
import { Joystick } from '../ui/Joystick';
import { CutIn } from '../ui/CutIn';
import { PASSIVES } from '../data/passives';
import { AudioBus } from '../utils/audio';
import { FONT_JP } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import type { RunResult } from './ResultScene';
import type { LevelUpData } from './LevelUpScene';
import type { ChestData } from './ChestScene';

interface Zone extends ZoneOpts {
  elapsed: number;
  tick: number;
}

const MAX_ENEMY_RADIUS = 120;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private joystick!: Joystick;
  private hud!: Hud;
  private cutIn!: CutIn;
  private spawner!: Spawner;
  private xp!: XpSystem;
  private up!: UpgradeState;
  private enemies!: Phaser.GameObjects.Group;
  private bullets!: Phaser.GameObjects.Group;
  private ebullets!: Phaser.GameObjects.Group;
  private pickups!: Phaser.GameObjects.Group;
  private hash!: SpatialHash<Enemy>;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bg!: Phaser.GameObjects.TileSprite;
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private soulGfx!: Phaser.GameObjects.Graphics;
  private moon?: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private ctx!: BattleContext;

  private zones: Zone[] = [];
  private elapsed = 0;
  private kills = 0;
  private over = false;
  private characterId = DEFAULT_CHARACTER;
  private stage: StageDef = stageById(1);
  private tmp: Enemy[] = [];
  private arrowTargets: { x: number; y: number; color: number }[] = [];
  private soulGauge = 0;
  private soulUntil = 0;
  private boss: Enemy | null = null;
  private bossDefeated = false;
  /** 拾った宝箱の未開封数（重ね画面を避けるため update で順に開く） */
  private pendingChests = 0;
  /** ゲーム速度（×1 / ×1.5 / ×2） */
  private speed = 1;
  /** ゲーム内時刻（ms）。速度倍率を反映した時計。無敵・鈍化などのタイマーはこれ基準 */
  private gameNow = 0;
  /** このフレーム内で重ね画面を開いた（残りの分割ステップを止める） */
  private haltFrame = false;
  private fullMoon = false;
  private enemySpeedMul = 1;

  constructor() {
    super('Game');
  }

  init(data: { characterId?: string; stageId?: number }): void {
    this.characterId = data.characterId ?? DEFAULT_CHARACTER;
    this.stage = stageById(data.stageId ?? 1);
    this.elapsed = 0;
    this.kills = 0;
    this.over = false;
    this.zones = [];
    this.soulGauge = 0;
    this.soulUntil = 0;
    this.boss = null;
    this.bossDefeated = false;
    this.pendingChests = 0;
    this.gameNow = 0;
    this.haltFrame = false;
    this.fullMoon = false;
    this.enemySpeedMul = this.stage.enemySpeedMul;
    this.moon = undefined;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.fadeIn(300, 6, 9, 19);
    const def = CHARACTERS[this.characterId];

    // 背景（カメラに追従するタイル）
    this.bg = this.add.tileSprite(0, 0, cam.width, cam.height, 'bg').setOrigin(0).setScrollFactor(0).setDepth(0);
    if (this.stage.tint !== 0xffffff) this.bg.setTint(this.stage.tint);
    this.scale.on('resize', this.onResize, this);

    // プール
    this.enemies = this.add.group({ classType: Enemy, maxSize: CONFIG.maxEnemies });
    this.bullets = this.add.group({ classType: Bullet, maxSize: CONFIG.maxBullets });
    this.ebullets = this.add.group({ classType: EnemyBullet, maxSize: CONFIG.maxEnemyBullets });
    this.pickups = this.add.group({ classType: Pickup, maxSize: CONFIG.maxGems });
    this.hash = new SpatialHash<Enemy>(CONFIG.hashCell);
    this.zoneGfx = this.add.graphics().setDepth(4);
    this.soulGfx = this.add.graphics().setDepth(18);

    // 撃破パーティクル（ノイズ状に崩れる）
    this.particles = this.add.particles(0, 0, 'px', {
      speed: { min: 50, max: 170 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 220, max: 480 },
      scale: { start: 1.3 * CONFIG.spriteScale, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(28);

    // プレイヤー（カメラは胸の高さを追う）
    this.player = new Player(this, 0, 0, def);
    cam.startFollow(this.player, false, 0.12, 0.12, 0, this.player.displayHeight * 0.4);
    cam.setDeadzone(0, 0);

    // 入力
    this.joystick = new Joystick(this);
    const kb = this.input.keyboard;
    this.keys = kb
      ? (kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ESC,SPACE') as Record<string, Phaser.Input.Keyboard.Key>)
      : {};
    kb?.on('keydown-ESC', () => this.pause());
    kb?.on('keydown-SPACE', () => this.activateSoul());

    // タブ非表示・フォーカス喪失で自動ポーズ
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.pause, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.pause, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.pause, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.pause, this);
      this.scale.off('resize', this.onResize, this);
      this.anims.globalTimeScale = 1; // グローバル設定なので戻す
      this.hud.destroy();
      this.joystick.destroy();
    });

    // システム
    this.xp = new XpSystem(this.pickups);
    this.xp.xpMul = this.stage.xpMul;
    this.xp.onItem = (kind, value, x, y) => this.onItem(kind, value, x, y);
    this.up = new UpgradeState();
    this.up.setMain(def.startWeapon);
    for (const id of def.excludedArts) this.up.excluded.add(id);
    this.up.recompute();
    this.spawner = new Spawner(this, this.enemies, this.player, this.stage);
    this.spawner.onBandChange = (b) => this.onBandChange(b.label, !!b.fullMoon, b.from);
    this.spawner.onBossSpawn = (boss) => this.onBossSpawn(boss);
    this.hud = new Hud(this, () => this.pause(), () => this.activateSoul(), () => this.cycleSpeed());
    const savedSpeed = loadSave().settings.speed;
    this.setSpeed(CONFIG.speedModes.includes(savedSpeed) ? savedSpeed : 1);
    this.cutIn = new CutIn(this);

    this.ctx = {
      scene: this,
      player: this.player,
      enemies: this.enemies,
      hash: this.hash,
      stats: this.up.stats,
      now: 0,
      artDamageMul: 1,
      artIntervalMul: 1,
      excludedArts: this.up.excluded,
      damage: (e, dmg, kx, ky) => this.damageEnemy(e, dmg, kx, ky),
      nearestEnemy: (x, y, maxDist) => this.nearestEnemy(x, y, maxDist),
      enemiesInCircle: (x, y, r, out) => this.enemiesInCircle(x, y, r, out),
      onScreenEnemies: () => this.onScreenEnemies(),
      fireBullet: (o) => this.fireBullet(o),
      addZone: (z) => this.zones.push({ ...z, elapsed: 0, tick: 0 }),
      kick: (e, angle, speed, dur, dmg) => this.kick(e, angle, speed, dur, dmg),
      fx: {
        slash: (x, y, r, color, angle, arcDeg) => this.fxSlash(x, y, r, color, angle, arcDeg),
        ring: (x, y, r, color, width) => this.fxRing(x, y, r, color, width),
        cross: (x, y, size, color) => this.fxCross(x, y, size, color),
        line: (x1, y1, x2, y2, width, color) => this.fxLine(x1, y1, x2, y2, width, color),
        text: (x, y, text, color) => this.fxText(x, y, text, color),
      },
    };

    AudioBus.playBgm(this.stage.bgm, 'bgm_stage');
    AudioBus.play('vo_kuya_start');
    this.hud.banner(`${this.stage.nameEn} —— ${this.stage.name}`, Phaser.Display.Color.IntegerToColor(this.stage.color).rgba, 32);
  }

  private onResize(): void {
    const cam = this.cameras.main;
    this.bg.setSize(cam.width, cam.height);
    this.moon?.setPosition(cam.width - 130, 210);
  }

  private overlayActive(): boolean {
    return this.scene.isActive('LevelUp') || this.scene.isActive('Chest') || this.scene.isActive('Pause');
  }

  private pause(): void {
    if (this.over || !this.scene.isActive('Game') || this.overlayActive()) return;
    this.joystick.reset();
    this.scene.pause();
    this.scene.launch('Pause');
  }

  // ─────────────────────────── メインループ ───────────────────────────

  update(_time: number, deltaMs: number): void {
    if (this.over) return;
    this.haltFrame = false;

    // 入力（フレームに1回）
    this.joystick.update();
    let dx = this.joystick.value.x;
    let dy = this.joystick.value.y;
    if (!this.joystick.active && this.keys.W) {
      const k = this.keys;
      dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    }

    // ゲーム速度：倍率分だけ内部更新を分割し、1ステップの移動量を等速時と同程度に保つ
    const steps = Math.max(1, Math.ceil(this.speed));
    const dtStep = ((Math.min(deltaMs, 50) / 1000) * this.speed) / steps;
    for (let i = 0; i < steps; i++) {
      if (this.over || this.haltFrame) break;
      this.simulate(dtStep, dx, dy);
    }

    const now = this.gameNow;
    const p = this.player;
    const enemies = this.enemies.getChildren() as Enemy[];
    const soulActive = now < this.soulUntil;

    // 必殺の演出
    this.soulGfx.clear();
    if (soulActive) {
      const k = (this.soulUntil - now) / (CONFIG.soul.durationSec * 1000);
      this.soulGfx.lineStyle(4, 0x87ceeb, 0.5 + Math.sin(now / 80) * 0.2);
      this.soulGfx.strokeCircle(p.x, p.y - 40, 70 + Math.sin(now / 120) * 6);
      this.soulGfx.lineStyle(2, 0xffffff, 0.35 * k);
      this.soulGfx.strokeCircle(p.x, p.y - 40, 95 + Math.sin(now / 90) * 8);
    }
    const pk = this.pickups.getChildren() as Pickup[];
    for (let i = 0; i < pk.length; i++) if (pk[i].active) XpSystem.bob(pk[i], now);

    // 背景スクロール
    const cam = this.cameras.main;
    this.bg.tilePositionX = cam.scrollX;
    this.bg.tilePositionY = cam.scrollY;

    // HUD
    this.hud.update({
      hp: p.hp, maxHp: p.maxHp, xp: this.xp.xp, xpToNext: this.xp.xpToNext, level: this.xp.level,
      time: this.elapsed, kills: this.kills, yell: this.xp.yell,
      band: `${this.spawner.band?.label ?? ''}　${this.stage.nameEn}`,
      soul: this.soulGauge, soulActive,
      weapons: this.up.weapons.map((w) => `${w.name} ${w.level}`),
      passives: [...this.up.passives].map(([id, lv]) => `${this.passiveName(id)} ${lv}`),
      boss: this.boss && this.boss.active ? { name: this.boss.def.name, hp: this.boss.hp, maxHp: this.boss.maxHp } : null,
    });
    if (p.def.uniquePassive === 'info_control') {
      this.arrowTargets.length = 0;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.active && e.def.tier >= CONFIG.infoControlMinTier) this.arrowTargets.push({ x: e.x, y: e.y, color: e.def.eyeColor });
      }
      this.hud.drawArrows(this.arrowTargets);
    }

    // 終了判定
    if (p.hp <= 0) this.finish(false);
    else if (this.bossDefeated) this.finish(true);
  }

  /** 内部更新1ステップ（dt はゲーム内秒。ゲーム速度の分割後） */
  private simulate(dt: number, dx: number, dy: number): void {
    this.gameNow += dt * 1000;
    const now = this.gameNow;
    const ctx = this.ctx;
    ctx.now = now;
    ctx.stats = this.up.stats;
    const soulActive = now < this.soulUntil;
    ctx.artDamageMul = (1 + this.player.def.traits.resonanceArtsPower) * (soulActive ? CONFIG.soul.artDamageMul : 1);
    ctx.artIntervalMul = soulActive ? CONFIG.soul.artIntervalMul : 1;
    const stats = this.up.stats;
    const p = this.player;

    p.move(dx, dy, dt, stats.speedMul, now);

    // 自然回復・居眠り回復
    if (stats.regenPerSec > 0) p.heal(stats.regenPerSec * dt);
    if (p.sleeping) p.heal(CONFIG.sleepRegenPerSec * dt);

    // 時間・湧き
    this.elapsed += dt;
    this.spawner.update(dt, this.elapsed);

    // 空間ハッシュ再構築
    this.hash.clear();
    const enemies = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < enemies.length; i++) if (enemies[i].active) this.hash.insert(enemies[i]);

    this.updateEnemies(enemies, dt, now);
    this.updateZones(dt, now);
    this.updateBullets(dt, now);
    this.updateEnemyBullets(dt, now);

    for (const w of this.up.weapons) w.update(dt, ctx);

    // 経験値・アイテム
    this.xp.update(dt, now, p.x, p.y - 12, p.def.pickup * stats.pickupMul);
    if (!this.overlayActive()) {
      if (this.xp.pendingLevelUps > 0) {
        this.xp.pendingLevelUps--;
        this.openLevelUp();
      } else if (this.pendingChests > 0) {
        this.pendingChests--;
        this.openChest();
      }
    }
  }

  /** ゲーム速度を切替（×1 → ×1.5 → ×2 → ×1）。設定に保存 */
  private cycleSpeed(): void {
    if (this.over) return;
    const modes = CONFIG.speedModes;
    const i = modes.indexOf(this.speed);
    this.setSpeed(modes[(i + 1) % modes.length]);
    const save = loadSave();
    save.settings.speed = this.speed;
    writeSave(save);
  }

  private setSpeed(mul: number): void {
    this.speed = mul;
    // 演出（tween・delayedCall・アニメ）も同じ倍率で進める
    this.time.timeScale = mul;
    this.tweens.timeScale = mul;
    this.anims.globalTimeScale = mul;
    this.hud.setSpeed(mul);
  }

  private passiveName(id: string): string {
    // 表示用の短縮（HUDの幅節約）
    const map: Record<string, string> = {
      patisserie: 'Patisserie', makanai: 'まかない', jewel: '宝石', gear: 'ギア', route: '経路',
      tuning: '調律', poem: '詩', scout: '斥候', finder: '神通力',
    };
    return map[id] ?? id;
  }

  private updateEnemies(enemies: Enemy[], dt: number, now: number): void {
    const p = this.player;
    const px = p.x;
    const py = p.y - 12;
    const stats = this.up.stats;
    const sep = CONFIG.separationForce;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) continue;
      const def = e.def;

      // 被弾フラッシュ解除
      if (e.flashUntil && now > e.flashUntil) {
        e.flashUntil = 0;
        e.clearTint();
      }
      if (def.isObject) continue;

      // 炎上（0.25秒ごとに刻む）
      if (now < e.burnUntil) {
        e.burnTick += dt;
        if (e.burnTick >= 0.25) {
          e.burnTick -= 0.25;
          this.hitSpark(e.x, e.y - 10, 0xff8c00, 2);
          this.damageEnemy(e, e.burnDps * 0.25, 0, 0);
          if (!e.active) continue;
        }
      }

      const dx = px - e.x;
      const dy = py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      // 蹴り飛ばされ中
      if (e.fly) {
        const f = e.fly;
        e.x += f.vx * dt;
        e.y += f.vy * dt;
        f.vx *= 0.985;
        f.vy *= 0.985;
        this.tmp.length = 0;
        this.hash.query(e.x, e.y, e.radius + 60, this.tmp);
        for (const o of this.tmp) {
          if (o === e || !o.active || o.fly || f.hit.has(o)) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) > e.radius + o.radius) continue;
          f.hit.add(o);
          this.damageEnemy(o, f.damage, f.vx * 0.25, f.vy * 0.25);
        }
        if (now > f.until) e.fly = null;
        e.setRotation(e.rotation + dt * 14);
        continue;
      }
      if (e.rotation !== 0) e.setRotation(0);

      // 移動
      let mx = nx;
      let my = ny;
      let spd = def.speed * this.enemySpeedMul * e.speedMul(now);
      if (def.boss) {
        spd = this.updateBoss(e, dt, now, nx, ny);
        mx = e.bossState.dashing > 0 ? e.bossState.dirX : nx;
        my = e.bossState.dashing > 0 ? e.bossState.dirY : ny;
      } else if (def.ranged) {
        const keep = def.ranged.keepDistance;
        if (dist < keep - 30) { mx = -nx; my = -ny; }
        else if (dist < keep + 30) { mx = -ny * 0.4; my = nx * 0.4; }
        // 射撃
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 560) {
          e.shootTimer = def.ranged.intervalSec;
          this.fireEnemyBullet(e.x, e.y, Math.atan2(dy, dx), def.ranged.bulletSpeed, def.ranged.bulletLifeSec, def.ranged.bulletDamage);
        }
      }
      e.x += mx * spd * dt + e.kbx * dt;
      e.y += my * spd * dt + e.kby * dt;
      e.kbx *= 0.82;
      e.kby *= 0.82;
      e.setFlipX(nx < 0);

      // 押し合い（同セル内のみ）
      const cell = this.hash.sameCell(e);
      if (cell && cell.length > 1 && !def.boss) {
        for (let j = 0; j < cell.length; j++) {
          const o = cell[j];
          if (o === e) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const d = Math.hypot(ox, oy) || 0.01;
          const min = (e.radius + o.radius) * 0.8;
          if (d < min) {
            e.x += (ox / d) * sep * dt;
            e.y += (oy / d) * sep * dt;
          }
        }
      }

      // 接触ダメージ
      if (dist < e.radius + p.def.hitRadius) {
        if (p.takeDamage(def.contactDamage * stats.damageTakenMul, now)) this.onPlayerHit();
      }
    }
  }

  /** 王級：突進＋周囲弾。返り値: この フレームの移動速度 */
  private updateBoss(e: Enemy, dt: number, now: number, nx: number, ny: number): number {
    const b = e.bossState;
    const B = CONFIG.boss;
    b.ringTimer -= dt;
    if (b.ringTimer <= 0) {
      b.ringTimer = B.ringEverySec;
      for (let i = 0; i < B.ringCount; i++) {
        const a = (i / B.ringCount) * Math.PI * 2 + now / 1000;
        this.fireEnemyBullet(e.x, e.y - 20, a, B.ringBulletSpeed, 6, B.ringBulletDamage);
      }
    }
    if (b.dashing > 0) {
      b.dashing -= dt;
      return B.chargeSpeed;
    }
    if (b.windup > 0) {
      b.windup -= dt;
      e.x += (Math.random() - 0.5) * 6;
      if (b.windup <= 0) {
        b.dashing = B.chargeDurationSec;
        b.dirX = nx;
        b.dirY = ny;
        this.cameras.main.shake(120, 0.005);
      }
      return 0;
    }
    b.chargeTimer -= dt;
    if (b.chargeTimer <= 0) {
      b.chargeTimer = B.chargeEverySec;
      b.windup = B.chargeWindupSec;
      this.fxText(e.x, e.y - 130, '!!', '#FF4D6D');
      return 0;
    }
    return e.def.speed;
  }

  private updateZones(dt: number, now: number): void {
    const g = this.zoneGfx;
    g.clear();
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.elapsed += dt;
      if (z.elapsed >= z.duration) {
        this.zones.splice(i, 1);
        continue;
      }
      z.tick += dt;
      const doTick = z.tick >= 0.25;
      if (doTick) z.tick -= 0.25;
      this.tmp.length = 0;
      this.enemiesInCircle(z.x, z.y, z.radius, this.tmp);
      for (const e of this.tmp) {
        if (e.def.isObject) continue;
        if (z.stun) e.stun(0.3, now);
        else if (z.slow < 1) e.applySlow(z.slow, 0.3, now);
        if (doTick) this.damageEnemy(e, z.dps * 0.25, 0, 0);
      }
      // 描画
      const fade = Math.min(1, (z.duration - z.elapsed) / 0.4, z.elapsed / 0.15);
      if (z.shape === 'fence') {
        const r = z.radius;
        g.fillStyle(z.color, 0.12 * fade);
        g.fillRect(z.x - r, z.y - r, r * 2, r * 2);
        g.lineStyle(3, 0xb0b8c8, 0.9 * fade);
        g.strokeRect(z.x - r, z.y - r, r * 2, r * 2);
        g.lineStyle(2, 0xb0b8c8, 0.5 * fade);
        for (let k = -r + 20; k < r; k += 20) {
          g.lineBetween(z.x + k, z.y - r, z.x + k, z.y - r + 14);
          g.lineBetween(z.x + k, z.y + r, z.x + k, z.y + r - 14);
        }
      } else {
        g.fillStyle(z.color, 0.22 * fade);
        g.fillCircle(z.x, z.y, z.radius);
        g.lineStyle(3, 0x9d4dff, 0.8 * fade);
        g.strokeCircle(z.x, z.y, z.radius * (0.85 + Math.sin(now / 150) * 0.05));
        g.lineStyle(1, 0xffffff, 0.35 * fade);
        g.strokeCircle(z.x, z.y, z.radius * 0.5);
      }
    }
  }

  private updateBullets(dt: number, now: number): void {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const list = this.bullets.getChildren() as Bullet[];
    const p = this.player;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;

      // 追尾
      if (b.homing) {
        const t = this.nearestEnemy(b.x, b.y, 520);
        if (t) {
          const want = Math.atan2(t.y - b.y, t.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const diff = Phaser.Math.Angle.Wrap(want - cur);
          const turn = Phaser.Math.Clamp(diff, -6 * dt, 6 * dt);
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(cur + turn) * spd;
          b.vy = Math.sin(cur + turn) * spd;
        }
      }
      // ブーメラン
      if (b.boomerangDist > 0) {
        if (b.phase === 0 && b.traveled >= b.boomerangDist) {
          b.phase = 1;
          b.hit.clear();
        }
        if (b.phase === 1) {
          const tx = p.x;
          const ty = p.y - 16;
          const d = Math.hypot(tx - b.x, ty - b.y);
          if (d < 30) {
            if (b.orbitSec > 0) {
              // 花傘乱舞：戻ったあと周囲を舞う
              b.phase = 2;
              b.orbitLeft = b.orbitSec;
              b.orbitAngle = Math.atan2(b.y - ty, b.x - tx);
              b.hit.clear();
            } else {
              b.despawn();
              continue;
            }
          } else {
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = ((tx - b.x) / d) * spd;
            b.vy = ((ty - b.y) / d) * spd;
          }
        }
        if (b.phase === 2) {
          b.orbitLeft -= dt;
          if (b.orbitLeft <= 0) { b.despawn(); continue; }
          const r = 130;
          b.orbitAngle += dt * 5;
          const nx = p.x + Math.cos(b.orbitAngle) * r;
          const ny = p.y - 16 + Math.sin(b.orbitAngle) * r;
          b.vx = (nx - b.x) / dt;
          b.vy = (ny - b.y) / dt;
          // 1周ごとに当たり直せる
          if (Math.floor(b.orbitAngle / (Math.PI * 2)) !== Math.floor((b.orbitAngle - dt * 5) / (Math.PI * 2))) b.hit.clear();
        }
      }

      const sx = b.vx * dt;
      const sy = b.vy * dt;
      b.x += sx;
      b.y += sy;
      b.traveled += Math.hypot(sx, sy);
      b.life -= dt;
      if (b.traveled > b.maxRange || b.life <= 0) { b.despawn(); continue; }
      if (b.spin) b.setRotation(b.rotation + b.spin * dt);
      else if (b.rotateToVel) b.setRotation(Math.atan2(b.vy, b.vx));

      // 画面端で跳ね返る
      if (b.bounce) {
        let bounced = false;
        if (b.x < view.left && b.vx < 0) { b.vx = -b.vx; bounced = true; }
        if (b.x > view.right && b.vx > 0) { b.vx = -b.vx; bounced = true; }
        if (b.y < view.top && b.vy < 0) { b.vy = -b.vy; bounced = true; }
        if (b.y > view.bottom && b.vy > 0) { b.vy = -b.vy; bounced = true; }
        if (bounced) b.hit.clear();
      }

      this.tmp.length = 0;
      this.hash.query(b.x, b.y, MAX_ENEMY_RADIUS + b.hitRadius, this.tmp);
      for (const e of this.tmp) {
        if (!e.active || b.hit.has(e)) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d > e.radius + b.hitRadius) continue;
        b.hit.add(e);
        const a = Math.atan2(b.vy, b.vx);
        this.damageEnemy(e, b.damage, Math.cos(a) * b.knockback, Math.sin(a) * b.knockback);
        if (b.slow < 1) e.applySlow(b.slow, b.slowSec, now);
        this.hitSpark(b.x, b.y, 0x87ceeb, 3);
        if (b.pierce <= 0) { b.despawn(); break; }
        b.pierce--;
      }
    }
  }

  private updateEnemyBullets(dt: number, now: number): void {
    const p = this.player;
    const list = this.ebullets.getChildren() as EnemyBullet[];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) { b.despawn(); continue; }
      if (Math.hypot(p.x - b.x, p.y - 12 - b.y) < p.def.hitRadius + 5) {
        if (p.takeDamage(b.damage * this.up.stats.damageTakenMul, now)) this.onPlayerHit();
        b.despawn();
      }
    }
  }

  // ─────────────────────────── ヘルパー ───────────────────────────

  private nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxDist * maxDist;
    const list = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || e.def.isObject) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }

  private enemiesInCircle(x: number, y: number, r: number, out: Enemy[]): Enemy[] {
    const cand: Enemy[] = [];
    this.hash.query(x, y, r + MAX_ENEMY_RADIUS, cand);
    for (const e of cand) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= r + e.radius) out.push(e);
    }
    return out;
  }

  private onScreenEnemies(): Enemy[] {
    const v = this.cameras.main.worldView;
    const out: Enemy[] = [];
    const list = this.enemies.getChildren() as Enemy[];
    for (const e of list) {
      if (!e.active || e.def.isObject) continue;
      if (e.x < v.left - 40 || e.x > v.right + 40 || e.y < v.top - 40 || e.y > v.bottom + 40) continue;
      out.push(e);
    }
    return out;
  }

  private fireBullet(o: BulletOpts): Bullet | null {
    if (this.bullets.countActive(true) >= CONFIG.maxBullets) return null;
    const b = this.bullets.get(o.x, o.y) as Bullet | null;
    if (!b) return null;
    b.fire(o);
    return b;
  }

  private fireEnemyBullet(x: number, y: number, angle: number, speed: number, life: number, damage: number): void {
    const b = this.ebullets.get(x, y) as EnemyBullet | null;
    if (b) b.fire(x, y, angle, speed, life, damage);
  }

  private kick(e: Enemy, angle: number, speed: number, durationSec: number, damage: number): void {
    this.damageEnemy(e, damage, 0, 0);
    if (!e.active) return;
    e.fly = { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, until: this.ctx.now + durationSec * 1000, damage, hit: new Set() };
  }

  private damageEnemy(e: Enemy, dmg: number, kx: number, ky: number): void {
    if (!e.active) return;
    if (e.hit(dmg, this.ctx.now, kx, ky)) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    const def = e.def;
    this.particles.setParticleTint(def.eyeColor);
    this.particles.explode(Math.min(18, 5 + Math.floor(def.size / 6)), e.x, e.y - def.size * 0.25);
    this.particles.setParticleTint(0x1a2350);
    this.particles.explode(6, e.x, e.y - def.size * 0.25);
    e.despawn();

    if (def.isObject) {
      this.breakSpeaker(e.x, e.y);
      return;
    }
    this.kills++;
    this.soulGauge = Math.min(1, this.soulGauge + this.up.stats.soulGainMul / CONFIG.soul.killsToFull);
    this.xp.drop(e.x, e.y, def.xp, this.ctx.now, this.up.stats.luckMul);
    if (def.tier >= 2 && !def.boss && Math.random() < ITEMS.chest.dropChance * this.up.stats.luckMul) {
      this.xp.spawn(e.x, e.y, 'chest', 1, this.ctx.now);
    }
    AudioBus.play('se_kill', 40);
    if (def.boss) {
      this.bossDefeated = true;
      this.cameras.main.shake(400, 0.01);
      this.cameras.main.flash(500, 255, 255, 255);
    }
  }

  private breakSpeaker(x: number, y: number): void {
    AudioBus.play('se_break');
    const d = ITEMS.speaker.drops;
    const weights: [PickupKind, number][] = [
      ['magnet', d.magnet], ['cake', d.cake], ['yell', d.yell], ['cross', d.cross * this.up.stats.luckMul],
    ];
    let total = 0;
    for (const [, w] of weights) total += w;
    let r = Math.random() * total;
    let kind: PickupKind = 'cake';
    for (const [k, w] of weights) {
      r -= w;
      if (r <= 0) { kind = k; break; }
    }
    if (kind === 'yell') {
      for (let i = 0; i < ITEMS.speaker.yellCount; i++) this.xp.spawn(x, y, 'yell', 1, this.ctx.now);
    } else {
      this.xp.spawn(x, y, kind, 1, this.ctx.now);
    }
  }

  private onItem(kind: PickupKind, _value: number, x: number, y: number): void {
    const msg = PICKUPS[kind].message;
    AudioBus.play('se_item');
    if (kind === 'magnet') {
      this.xp.magnetAllUntil = this.ctx.now + 1500;
      this.fxRing(x, y, 60, 0x87ceeb, 4);
    } else if (kind === 'cake') {
      this.player.heal(ITEMS.cake.heal);
      this.fxText(this.player.x, this.player.y - 110, `+${ITEMS.cake.heal}`, '#F0E68C');
    } else if (kind === 'cross') {
      this.cameras.main.flash(400, 255, 255, 255);
      for (const e of this.onScreenEnemies()) {
        if (e.def.boss) continue;
        if (e.def.tier <= 1) this.damageEnemy(e, 1e9, 0, 0);
        else this.damageEnemy(e, ITEMS.cross.damage, 0, 0);
      }
    } else if (kind === 'chest') {
      this.pendingChests++;
      return;
    }
    if (msg) this.hud.banner(msg, '#FFFFFF', 26);
  }

  private hitSpark(x: number, y: number, color: number, n: number): void {
    this.particles.setParticleTint(color);
    this.particles.explode(n, x, y);
  }

  private counterUntil = 0;

  private onPlayerHit(): void {
    this.cameras.main.shake(90, 0.004);
    AudioBus.play('se_hit', 120);
    AudioBus.play('vo_kuya_hit', 2500);
    const now = this.ctx.now;
    // 後の先：周囲120pxへ反撃（1秒に1回）
    const cd = this.up.stats.counterDamage;
    if (cd > 0 && now >= this.counterUntil) {
      this.counterUntil = now + 1000;
      const p = this.player;
      this.tmp.length = 0;
      this.enemiesInCircle(p.x, p.y - 16, 120, this.tmp);
      for (const e of this.tmp) {
        const a = Math.atan2(e.y - (p.y - 16), e.x - p.x);
        this.damageEnemy(e, cd * this.up.stats.damageMul, Math.cos(a) * 180, Math.sin(a) * 180);
      }
      this.fxRing(p.x, p.y - 16, 120, 0xdc143c, 5);
    }
    // 被弾で反応するアーツ（『雪月風花』など）
    for (const w of this.up.arts) w.behavior.onPlayerHit?.(this.ctx, w.stats, w);
  }

  // ─────────────────────────── 演出 ───────────────────────────

  private fadeOut(g: Phaser.GameObjects.Graphics, ms: number): void {
    this.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
  }

  private fxSlash(x: number, y: number, r: number, color: number, angle: number, arcDeg: number): void {
    const half = Phaser.Math.DegToRad(arcDeg / 2);
    const g = this.add.graphics().setDepth(26);
    g.fillStyle(color, 0.35);
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, r, angle - half, angle + half, false);
    g.closePath();
    g.fillPath();
    g.strokePath();
    this.fadeOut(g, 160);
  }

  private fxRing(x: number, y: number, r: number, color: number, width = 4): void {
    const g = this.add.graphics().setDepth(26);
    g.lineStyle(width, color, 0.9);
    g.strokeCircle(0, 0, r);
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeCircle(0, 0, r * 0.9);
    g.setPosition(x, y).setScale(0.6);
    this.tweens.add({ targets: g, scale: 1.05, alpha: 0, duration: 260, ease: 'Cubic.out', onComplete: () => g.destroy() });
  }

  private fxCross(x: number, y: number, size: number, color: number): void {
    const g = this.add.graphics().setDepth(26);
    g.lineStyle(4, color, 1);
    g.lineBetween(-size, -size * 0.6, size, size * 0.6);
    g.lineBetween(-size, size * 0.6, size, -size * 0.6);
    g.lineStyle(2, 0xffffff, 0.9);
    g.lineBetween(-size * 0.7, -size * 0.4, size * 0.7, size * 0.4);
    g.setPosition(x, y).setRotation((Math.random() - 0.5) * 0.6);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.2, duration: 220, onComplete: () => g.destroy() });
  }

  private fxLine(x1: number, y1: number, x2: number, y2: number, width: number, color: number): void {
    const g = this.add.graphics().setDepth(26);
    const a = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    g.fillStyle(color, 0.7);
    // 牙のようなギザギザ
    const pts: Phaser.Math.Vector2[] = [];
    const n = Math.max(4, Math.floor(len / 30));
    for (let i = 0; i <= n; i++) pts.push(new Phaser.Math.Vector2((i / n) * len, i % 2 === 0 ? -width / 2 : -width * 0.9));
    for (let i = n; i >= 0; i--) pts.push(new Phaser.Math.Vector2((i / n) * len, i % 2 === 0 ? width / 2 : width * 0.9));
    g.fillPoints(pts, true);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokePoints(pts, true);
    g.setPosition(x1, y1).setRotation(a);
    this.tweens.add({ targets: g, alpha: 0, duration: 380, delay: 80, onComplete: () => g.destroy() });
  }

  private fxText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT_JP, fontSize: '24px', color, fontStyle: '700', stroke: '#060913', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  // ─────────────────────────── イベント ───────────────────────────

  private onBandChange(label: string, fullMoon: boolean, from: number): void {
    if (from > 0) this.hud.banner(`— ${label} —`);
    if (fullMoon && !this.fullMoon) this.startFullMoon();
    else if (!fullMoon && this.fullMoon) this.endFullMoon();
  }

  private startFullMoon(): void {
    this.fullMoon = true;
    this.enemySpeedMul = this.stage.enemySpeedMul * CONFIG.fullMoon.enemySpeedMul;
    this.xp.xpMul = this.stage.xpMul * CONFIG.fullMoon.xpMul;
    const cam = this.cameras.main;
    this.moon = this.add.image(cam.width - 130, 210, 'moon').setScrollFactor(0).setDepth(1).setAlpha(0).setScale(1.2);
    this.tweens.add({ targets: this.moon, alpha: 0.95, duration: 1500 });
    this.tweens.add({ targets: this.bg, alpha: 1, duration: 10 });
    this.bg.setTint(0xb8c4e8);
    this.hud.banner('満月 —— 声が、ざわめく', '#FFF6D5', 30);
    AudioBus.playBgm('bgm_fullmoon');
  }

  private endFullMoon(): void {
    this.fullMoon = false;
    this.enemySpeedMul = this.stage.enemySpeedMul;
    this.xp.xpMul = this.stage.xpMul;
    if (this.moon) {
      const m = this.moon;
      this.tweens.add({ targets: m, alpha: 0, duration: 1500, onComplete: () => m.destroy() });
      this.moon = undefined;
    }
    if (this.stage.tint !== 0xffffff) this.bg.setTint(this.stage.tint);
    else this.bg.clearTint();
    AudioBus.playBgm(this.stage.bgm, 'bgm_stage');
  }

  private onBossSpawn(boss: Enemy): void {
    this.boss = boss;
    // プレイヤーの成長に合わせてHPを底上げ（固定HPだと10:00の火力で即落ちする）
    boss.maxHp = Math.round((boss.def.hp + this.xp.level * CONFIG.boss.hpPerPlayerLevel) * this.stage.bossHpMul);
    boss.hp = boss.maxHp;
    this.hud.banner('王級 —— 出現', '#FF4D6D', 40);
    this.cameras.main.shake(300, 0.006);
    AudioBus.play('se_boss');
    AudioBus.playBgm('bgm_boss');
  }

  private activateSoul(): void {
    if (this.over || this.overlayActive()) return;
    if (this.soulGauge < 1 || this.ctx.now < this.soulUntil) return;
    this.soulGauge = 0;
    this.soulUntil = this.ctx.now + CONFIG.soul.durationSec * 1000;
    this.hud.banner('魂の共鳴 —— SOUL CONNECT', '#87CEEB', 36);
    this.fxRing(this.player.x, this.player.y - 40, 260, 0x87ceeb, 8);
    this.cameras.main.flash(300, 135, 206, 235);
    AudioBus.play('se_special');
    AudioBus.play('vo_kuya_special');
  }

  private openLevelUp(): void {
    if (this.overlayActive()) {
      this.xp.pendingLevelUps++;
      return;
    }
    const choices = this.up.buildChoices(3);
    const data: LevelUpData = {
      level: this.xp.level,
      choices,
      onPick: (c: Choice) => this.applyChoice(c),
    };
    AudioBus.play('se_levelup');
    AudioBus.play('vo_kuya_levelup', 4000);
    this.joystick.reset();
    this.haltFrame = true;
    this.scene.pause();
    this.scene.launch('LevelUp', data);
  }

  private applyChoice(c: Choice): void {
    const r = this.up.apply(c);
    const p = this.player;
    p.maxHp = p.def.hp + this.up.stats.maxHpBonus;
    if (r.maxHpDelta > 0) p.heal(r.maxHpDelta);
    if (r.heal > 0) p.heal(p.maxHp * r.heal);
    if (c.kind === 'weapon' && c.id === this.up.main.def.id && this.up.main.isMaxLevel) {
      this.hud.banner('『蒼天の連撃』');
      AudioBus.play('vo_kuya_evolve');
    }
    // 使い手のカットイン（共鳴アーツ・パッシブの取得／Lvアップ）
    if (c.kind === 'weapon' && c.id !== this.up.main.def.id) {
      const w = this.up.arts.find((x) => x.def.id === c.id);
      if (w) this.cutIn.show({ owner: w.def.owner, title: w.name, tag: r.newWeapon ? 'RESONANCE' : `Lv ${w.level}`, color: w.def.color });
    } else if (c.kind === 'passive') {
      const p = PASSIVES[c.id];
      this.cutIn.show({ owner: p.owner, title: p.name, tag: c.tag === 'NEW' ? 'SUPPORT' : `Lv ${this.up.passives.get(c.id)}`, color: p.color });
    }
  }

  private openChest(): void {
    if (this.overlayActive()) {
      this.pendingChests++;
      return;
    }
    const data: ChestData = {
      open: () => this.up.openChest(),
      onClose: (r: ChestResult) => {
        if (r.kind === 'yell' && r.yell) this.xp.yell += r.yell;
        if (r.weapon) {
          this.cutIn.show({
            owner: r.weapon.def.owner, title: r.weapon.name,
            tag: r.kind === 'evolve' ? 'EVOLVE' : `Lv ${r.weapon.level}`, color: r.weapon.def.color,
          });
        }
      },
    };
    this.joystick.reset();
    this.haltFrame = true;
    this.scene.pause();
    this.scene.launch('Chest', data);
  }

  private finish(cleared: boolean): void {
    if (this.over) return;
    this.over = true;
    this.haltFrame = true;
    this.joystick.reset();
    for (const key of ['LevelUp', 'Chest', 'Pause']) if (this.scene.isActive(key)) this.scene.stop(key);
    // 終了演出は等速で
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    AudioBus.stopBgm();
    AudioBus.play(cleared ? 'vo_kuya_clear' : 'vo_kuya_gameover');
    const result: RunResult = {
      characterId: this.characterId,
      cleared,
      kills: this.kills,
      timeSec: Math.floor(this.elapsed),
      level: this.xp.level,
      yell: this.xp.yell,
      speed: this.speed,
      stageId: this.stage.id,
    };
    if (!cleared) {
      this.player.play(`${this.player.def.sprite.key}_hit`);
      this.tweens.add({ targets: this.player, alpha: 0, duration: 900, delay: 300 });
    } else {
      this.hud.banner('—— 声は、届いた ——', '#FFFFFF', 36);
    }
    this.cameras.main.fadeOut(cleared ? 1800 : 1100, 6, 9, 19);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', result));
  }
}
