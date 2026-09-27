import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { CHARACTERS, DEFAULT_CHARACTER } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { stageById, type StageDef } from '../data/stages';
import { SCORE } from '../data/score';
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
import { SPECIALS, type SpecialHost } from '../systems/specials';
import { AudioBus } from '../utils/audio';
import { makeButton } from '../ui/Button';
import { getSafeInsets } from '../utils/safeArea';
import { FONT_JP } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { ensureColorVariant } from '../utils/recolor';
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
  private snow?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** 黒騎士のオーラ・予告線 */
  private bossGfx!: Phaser.GameObjects.Graphics;
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
  /** いま与えているダメージが必殺技によるものか（撃破してもゲージに数えない） */
  private specialDamage = false;
  /** 必殺の終了時刻（ゲーム内時計） */
  private soulUntil = 0;
  private specialHost: SpecialHost = { state: {} };
  private specialRunning = false;
  /** 完全看破：回避後の攻撃力+30%が続く時刻 */
  private kanpaUntil = 0;
  /** 慈愛の雫のタイマー */
  private cureTimer = 0;
  private tmp2: Enemy[] = [];
  private boss: Enemy | null = null;
  private bosses: Enemy[] = [];
  private bossDefeated = false;
  /** スコアアタック */
  private score = 0;
  private combo = 0;
  private comboMul = 1;
  private comboUntil = 0;
  private noDamageSec = 0;
  private timeUp = false;
  /** 拾った宝箱の未開封数（重ね画面を避けるため update で順に開く） */
  private pendingChests = 0;
  /** ゲーム速度（×1 / ×1.5 / ×2） */
  private speed = 1;
  /** ゲーム内時刻（ms）。速度倍率を反映した時計。無敵・鈍化などのタイマーはこれ基準 */
  private gameNow = 0;
  /** このフレーム内で重ね画面を開いた（残りの分割ステップを止める） */
  private haltFrame = false;
  /** `?debug` でボスHP・DPS などを表示 */
  private debug = typeof location !== 'undefined' && /debug/.test(location.search);
  /** デバッグ操作を使ったプレイは記録・エールを保存しない */
  private debugUsed = false;
  private debugInvincible = false;
  private debugNoSpawn = false;
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
    // デバッグ操作の状態は1プレイごとに戻す（シーンは使い回されるため）
    this.debugUsed = false;
    this.debugInvincible = false;
    this.debugNoSpawn = false;
    this.specialHost = { state: {} };
    this.specialRunning = false;
    this.kanpaUntil = 0;
    this.cureTimer = 0;
    this.boss = null;
    this.bossDefeated = false;
    this.bosses = [];
    this.score = 0;
    this.combo = 0;
    this.comboMul = 1;
    this.comboUntil = 0;
    this.noDamageSec = 0;
    this.timeUp = false;
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
    const bgKey = this.textures.exists(`bg_${this.stage.id}`) ? `bg_${this.stage.id}` : 'bg';
    this.bg = this.add.tileSprite(0, 0, cam.width, cam.height, bgKey).setOrigin(0).setScrollFactor(0).setDepth(0);
    if (this.stage.tint !== 0xffffff) this.bg.setTint(this.stage.tint);
    if (this.stage.weather === 'snow') {
      // 降雪：まばら・横風。当たり判定なし
      this.snow = this.add.particles(0, 0, 'snow', {
        x: { min: -100, max: cam.width + 100 }, y: -10,
        lifespan: 6000, speedY: { min: 60, max: 120 }, speedX: { min: 40, max: 110 },
        scale: { min: 0.5, max: 1.2 }, alpha: { start: 0.4, end: 0.1 }, frequency: 90, quantity: 1,
      }).setScrollFactor(0).setDepth(3);
    }
    this.scale.on('resize', this.onResize, this);

    // プール
    this.enemies = this.add.group({ classType: Enemy, maxSize: CONFIG.maxEnemies });
    this.bullets = this.add.group({ classType: Bullet, maxSize: CONFIG.maxBullets });
    this.ebullets = this.add.group({ classType: EnemyBullet, maxSize: CONFIG.maxEnemyBullets });
    this.pickups = this.add.group({ classType: Pickup, maxSize: CONFIG.maxGems });
    this.hash = new SpatialHash<Enemy>(CONFIG.hashCell);
    this.zoneGfx = this.add.graphics().setDepth(4);
    this.bossGfx = this.add.graphics().setDepth(9);
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
    const colorSel = loadSave().colorSelected[def.id];
    const spriteKey = colorSel ? ensureColorVariant(this, def, colorSel) : def.sprite.key;
    this.player = new Player(this, 0, 0, def, spriteKey);
    // 永続強化（セーブ）を反映してから最大HPを決める
    this.up = new UpgradeState();
    this.up.permanent = loadSave().permanent;
    this.up.setMain(def.startWeapon);
    for (const id of def.excludedArts) this.up.excluded.add(id);
    this.up.traitDamageMul = def.traits.damageMul;
    this.up.characterId = this.characterId;
    this.up.recompute();
    this.player.maxHp = Math.round(def.hp * def.traits.maxHpMul * this.up.stats.maxHpMul);
    this.player.hp = this.player.maxHp;
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
    this.spawner = new Spawner(this, this.enemies, this.player, this.stage);
    this.spawner.onBandChange = (b) => this.onBandChange(b.label, !!b.fullMoon, b.from, !!b.boss);
    this.spawner.onBossSpawn = (boss, hpMul, index, total) => this.onBossSpawn(boss, hpMul, index, total);
    this.hud = new Hud(this, () => this.pause(), () => this.activateSoul(), () => this.cycleSpeed());
    this.hud.setSpecialLabel(def.special.shortName);
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
      characterId: this.characterId,
      meleeMul: def.traits.meleePower,
      bonusDamageMul: 1,
      damage: (e, dmg, kx, ky) => this.damageEnemy(e, dmg, kx, ky),
      nearestEnemy: (x, y, maxDist) => this.nearestEnemy(x, y, maxDist),
      enemiesInCircle: (x, y, r, out) => this.enemiesInCircle(x, y, r, out),
      onScreenEnemies: () => this.onScreenEnemies(),
      fireBullet: (o) => this.fireBullet(o),
      addZone: (z) => this.addZone(z),
      kick: (e, angle, speed, dur, dmg) => this.kick(e, angle, speed, dur, dmg),
      fx: {
        slash: (x, y, r, color, angle, arcDeg) => this.fxSlash(x, y, r, color, angle, arcDeg),
        ring: (x, y, r, color, width) => this.fxRing(x, y, r, color, width),
        cross: (x, y, size, color) => this.fxCross(x, y, size, color),
        line: (x1, y1, x2, y2, width, color) => this.fxLine(x1, y1, x2, y2, width, color),
        text: (x, y, text, color) => this.fxText(x, y, text, color),
      },
    };

    AudioBus.playBgm(`bgm_chara_${def.id}`, this.stage.bgm, 'bgm_stage');
    this.vo('start');
    this.hud.banner(`${this.stage.nameEn} —— ${this.stage.name}`, Phaser.Display.Color.IntegerToColor(this.stage.color).rgba, 32);
    if (this.debug) this.buildDebugPanel();
  }

  /**
   * デバッグパネル（URLに `?debug` を付けたときだけ）：ボスの即出現・HP50%・無敵・雑魚の停止・Lv+5。
   * 一度でも使うと、そのプレイの記録・エールは保存しない。
   */
  private buildDebugPanel(): void {
    const used = () => { this.debugUsed = true; };
    const spawnBoss = (id: 'king' | 'blackknight') => {
      used();
      const boss = this.spawner.spawnOne(id, this.player.x, this.player.y - 420, 1);
      if (!boss) return;
      this.spawner.bossActive = true;
      this.onBossSpawn(boss, 1);
    };
    const items: { label: string; run: (setLabel: (s: string) => void) => void }[] = [
      { label: '王級', run: () => spawnBoss('king') },
      { label: '黒騎士', run: () => spawnBoss('blackknight') },
      {
        label: '騎兵必殺',
        run: () => {
          used();
          for (const b of this.bosses) if (b.active && b.def.id === 'blackknight' && b.bk.rush === 0 && !b.bk.rushCharge) this.startKnightRush(b, this.gameNow);
        },
      },
      {
        label: '連撃',
        run: () => {
          used();
          for (const b of this.bosses) {
            if (!b.active || b.def.id !== 'blackknight') continue;
            b.bk.forceCombo = true;
            b.bossState.chargeTimer = 0;
          }
        },
      },
      {
        label: 'ボスHP50%',
        run: () => {
          used();
          for (const b of this.bosses) if (b.active) b.hp = Math.min(b.hp, Math.floor(b.maxHp * 0.5));
        },
      },
      {
        label: '無敵 OFF',
        run: (set) => {
          used();
          this.debugInvincible = !this.debugInvincible;
          set(this.debugInvincible ? '無敵 ON' : '無敵 OFF');
        },
      },
      {
        label: '雑魚 ON',
        run: (set) => {
          used();
          this.debugNoSpawn = !this.debugNoSpawn;
          set(this.debugNoSpawn ? '雑魚 OFF' : '雑魚 ON');
          if (this.debugNoSpawn) {
            for (const e of this.enemies.getChildren() as Enemy[]) {
              if (e.active && !e.def.boss && !e.def.isObject) e.despawn();
            }
          }
        },
      },
      {
        label: 'Lv +5',
        run: () => {
          used();
          this.xp.level += 5;
          this.xp.pendingLevelUps += 5;
        },
      },
    ];
    const buttons = items.map((it) => {
      const c = makeButton(this, 0, 0, it.label, () => it.run((s) => (c.list[2] as Phaser.GameObjects.Text).setText(s)), { width: 132, height: 44, fontSize: 18, armDelayMs: 0 });
      c.setDepth(1000).setScrollFactor(0).setAlpha(0.85);
      c.each((o: Phaser.GameObjects.GameObject) => (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0));
      return c;
    });
    const layout = () => {
      const top = Math.max(getSafeInsets(this.scale).top, 16) + 8;
      buttons.forEach((c, i) => c.setPosition(24 + 66, top + 160 + i * 54));
    };
    layout();
    this.scale.on('resize', layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', layout));
  }

  private onResize(): void {
    const cam = this.cameras.main;
    this.bg.setSize(cam.width, cam.height);
    this.moon?.setPosition(cam.width - 130, 210);
    this.snow?.updateConfig({ x: { min: -100, max: cam.width + 100 } });
  }

  private overlayActive(): boolean {
    return this.scene.isActive('LevelUp') || this.scene.isActive('Chest') || this.scene.isActive('Pause');
  }

  private pause(): void {
    if (this.over || !this.scene.isActive('Game') || this.overlayActive()) return;
    this.joystick.reset();
    this.scene.pause();
    this.scene.launch('Pause', {
      character: this.player.def.name,
      stage: `${this.stage.nameEn} ${this.stage.name}`,
      weapons: this.up.weapons.map((w) => ({ name: w.name, level: w.level, max: w.def.maxLevel, color: w.def.color, owner: w.def.owner, evolved: w.evolved, fusion: !!w.def.fusion })),
      passives: [...this.up.passives].map(([id, lv]) => ({ name: PASSIVES[id].name, level: lv, max: PASSIVES[id].maxLevel, color: PASSIVES[id].color, owner: PASSIVES[id].owner })),
    });
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
      boss: (() => { const b = this.bosses.find((x) => x.active) ?? null; return b ? { name: this.bosses.filter((x) => x.active).length > 1 ? `${b.def.name} ×${this.bosses.filter((x) => x.active).length}` : b.def.name, hp: b.hp, maxHp: b.maxHp } : null; })(),
      score: this.stage.scoreMode ? { score: Math.round(this.score), combo: this.comboMul } : null,
    });
    if (this.debug) {
      while (this.dmgLog.length && this.dmgLog[0].t < now - 5000) this.dmgLog.shift();
      const dps = this.dmgLog.reduce((a, b) => a + b.d, 0) / 5;
      const b = this.boss && this.boss.active ? `BOSS ${Math.ceil(this.boss.hp)}/${this.boss.maxHp}  残${(this.boss.hp / Math.max(1, dps)).toFixed(0)}s` : 'BOSS -';
      this.hud.setDebug(`DPS ${dps.toFixed(0)}  ${b}  敵${enemies.filter((e) => e.active).length}  Lv${this.xp.level}`);
    }
    if (p.def.uniquePassive.id === 'info_control') {
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
    else if (this.timeUp) this.finish(false);
  }

  /** 内部更新1ステップ（dt はゲーム内秒。ゲーム速度の分割後） */
  private simulate(dt: number, dx: number, dy: number): void {
    this.gameNow += dt * 1000;
    const now = this.gameNow;
    const ctx = this.ctx;
    ctx.now = now;
    ctx.stats = this.up.stats;
    const def = this.player.def;
    const specialActive = now < this.soulUntil;
    const soulActive = specialActive && def.special.id === 'soul_connect';
    ctx.artDamageMul = (1 + def.traits.resonanceArtsPower) * (soulActive ? CONFIG.soul.artDamageMul : 1);
    ctx.artIntervalMul = soulActive ? CONFIG.soul.artIntervalMul : 1;
    ctx.bonusDamageMul = now < this.kanpaUntil ? 1.3 : 1;
    const stats = this.up.stats;
    const p = this.player;

    p.move(dx, dy, dt, stats.speedMul, now);

    // 『流麗なる水衣』発動中は Midnight Patisserie Lv2相当（+1.0/秒）の回復を上乗せ（v2）
    if (specialActive && def.special.id === 'aqua_lament') p.heal(1.0 * dt);

    // 固有パッシブ『慈愛の雫』：20秒ごとにHP+10
    if (def.uniquePassive.id === 'cure_drop') {
      this.cureTimer += dt;
      if (this.cureTimer >= 20) {
        this.cureTimer -= 20;
        p.heal(10);
        this.fxText(p.x, p.y - 110, '+10', '#87CEFA');
        this.fxRing(p.x, p.y - 40, 50, 0x87cefa, 3);
      }
    }

    // 自然回復・居眠り回復
    if (stats.regenPerSec > 0) p.heal(stats.regenPerSec * dt);
    if (p.sleeping) p.heal(CONFIG.sleepRegenPerSec * dt);

    // 時間・湧き
    this.elapsed += dt;
    if (!this.debugNoSpawn) this.spawner.update(dt, this.elapsed);
    if (this.stage.ramp) this.enemySpeedMul = this.stage.enemySpeedMul * (1 + this.stage.ramp.speedPerMin * (this.elapsed / 60)) * (this.fullMoon ? CONFIG.fullMoon.enemySpeedMul : 1);
    if (this.stage.scoreMode) {
      this.noDamageSec += dt;
      if (now > this.comboUntil && this.combo > 0) { this.combo = 0; this.comboMul = 1; }
      if (this.elapsed >= SCORE.timeLimitSec && !this.timeUp) { this.timeUp = true; }
    }

    // 空間ハッシュ再構築
    this.hash.clear();
    const enemies = this.enemies.getChildren() as Enemy[];
    for (let i = 0; i < enemies.length; i++) if (enemies[i].active) this.hash.insert(enemies[i]);

    this.updateEnemies(enemies, dt, now);
    this.updateZones(dt, now);
    this.updateBullets(dt, now);
    this.updateEnemyBullets(dt, now);

    for (const w of this.up.weapons) w.update(dt, ctx);

    // 必殺の進行・終了
    if (this.specialRunning) {
      const sp = SPECIALS[def.special.id];
      if (specialActive) {
        this.specialDamage = true;
        sp.update?.(dt, ctx, this.specialHost);
        this.specialDamage = false;
      }
      else {
        sp.end?.(ctx, this.specialHost);
        this.specialRunning = false;
      }
    }

    // 経験値・アイテム
    if (this.xp.update(dt, now, p.x, p.y - 12, p.def.pickup * stats.pickupMul) > 0) AudioBus.play('se_gem', 90);
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

  private updateEnemies(enemies: Enemy[], dt: number, now: number): void {
    const p = this.player;
    const px = p.x;
    const py = p.y - 12;
    const sep = CONFIG.separationForce;
    this.bossGfx.clear();

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
          this.specialDamage = e.burnBySpecial;
          this.damageEnemy(e, e.burnDps * 0.25, 0, 0);
          this.specialDamage = false;
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
        // 跳弾バグ：画面端で跳ね返る
        if (f.bounces && f.bounces > 0) {
          const v = this.cameras.main.worldView;
          let bounced = false;
          if (e.x < v.left && f.vx < 0) { f.vx = -f.vx; bounced = true; }
          if (e.x > v.right && f.vx > 0) { f.vx = -f.vx; bounced = true; }
          if (e.y < v.top && f.vy < 0) { f.vy = -f.vy; bounced = true; }
          if (e.y > v.bottom && f.vy > 0) { f.vy = -f.vy; bounced = true; }
          if (bounced) {
            f.bounces--;
            f.hit.clear();
            this.hitSpark(e.x, e.y, 0x00ced1, 6);
          }
        }
        if (now > f.until) e.fly = null;
        e.setRotation(e.rotation + dt * 14);
        continue;
      }
      if (e.rotation !== 0) e.setRotation(0);

      // 騎兵：直線に突っ切って画面外で消える
      if (def.charger && e.charge) {
        e.x += e.charge.vx * dt;
        e.y += e.charge.vy * dt;
        e.setFlipX(e.charge.vx < 0);
        const v = this.cameras.main.worldView;
        if (e.x < v.left - 200 || e.x > v.right + 200 || e.y < v.top - 200 || e.y > v.bottom + 200) { e.despawn(); continue; }
        if (dist < e.radius + p.def.hitRadius) this.hurt(def.contactDamage, now);
        continue;
      }

      // 移動
      let mx = nx;
      let my = ny;
      let spd = def.speed * this.enemySpeedMul * e.speedMul(now);
      if (def.id === 'blackknight') {
        const r = this.updateBlackKnight(e, dt, now, dist, nx, ny);
        mx = r.mx;
        my = r.my;
        spd = r.spd;
      } else if (def.boss) {
        spd = this.updateBoss(e, dt, now, dist, nx, ny);
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
      if (dist < e.radius + p.def.hitRadius) this.hurt(def.contactDamage, now);
    }
  }

  /** 黒騎士（STAGE 3）：前半は騎兵突撃と剣閃、50%で形態変化、後半は突進の直後に追撃（ばらまき／右→左の二連斬） */
  private updateBlackKnight(e: Enemy, dt: number, now: number, dist: number, nx: number, ny: number): { mx: number; my: number; spd: number } {
    const b = e.bk;
    const p = this.player;
    // 形態変化（50%を切った瞬間）：1.5秒無敵＋黒いオーラ＋揺れ
    if (b.phase === 1 && e.hp <= e.maxHp * 0.5) {
      b.phase = 2;
      b.invulnUntil = now + 1500;
      b.animLock = now + 1500;
      e.play('anim_e_blackknight_hit', true);
      this.cameras.main.shake(400, 0.006);
      this.hud.banner('黒騎士 —— 形態変化', '#9D4DFF', 34);
      this.fxRing(e.x, e.y - 60, 220, 0x9d4dff, 10);
    }
    // オーラ（形態変化後は常時）＋予告線
    const g = this.bossGfx;
    if (b.phase === 2) {
      const k = 0.35 + Math.sin(now / 110) * 0.12;
      g.fillStyle(0x2a0a3a, k);
      g.fillCircle(e.x, e.y - 50, 120 + Math.sin(now / 90) * 8);
      g.lineStyle(3, 0x9d4dff, 0.5);
      g.strokeCircle(e.x, e.y - 50, 130 + Math.sin(now / 70) * 6);
    }
    for (const w of this.cavalryWarnings) {
      const a = Math.min(1, (w.at - now) / 1000);
      g.lineStyle(4, 0xff2244, 0.35 + (1 - a) * 0.5);
      g.lineBetween(w.x1, w.y1, w.x2, w.y2);
    }
    // 予告が時間になったら騎兵を出す
    for (let i = this.cavalryWarnings.length - 1; i >= 0; i--) {
      const w = this.cavalryWarnings[i];
      if (now >= w.at) {
        this.cavalryWarnings.splice(i, 1);
        const c = this.spawner.spawnOne('cavalry', w.x1, w.y1, this.stage.enemyHpMul);
        if (c) {
          const d = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
          c.charge = { vx: ((w.x2 - w.x1) / d) * ENEMIES.cavalry.speed, vy: ((w.y2 - w.y1) / d) * ENEMIES.cavalry.speed };
        }
      }
    }
    if (now < b.invulnUntil) return { mx: 0, my: 0, spd: 0 };

    // 突進（両形態）：予備動作0.8秒（赤い矢印で予告）→ 0.7秒ダッシュ
    const bs = e.bossState;
    const B = CONFIG.boss;
    if (bs.dashing > 0) {
      bs.dashing -= dt;
      if (bs.dashing <= 0) {
        bs.chargeTimer = b.phase === 1 ? 7 : 6;
        if (b.phase === 2 || b.forceCombo) this.startKnightFollow(e, now);
      }
      return { mx: bs.dirX, my: bs.dirY, spd: B.chargeSpeed * 1.1 };
    }
    // 後半：突進の直後の追撃中は他の行動をしない
    if (b.follow) return this.updateKnightFollow(e, dt, now);
    if (bs.windup > 0) {
      bs.windup -= dt;
      e.x += (Math.random() - 0.5) * 6;
      g.lineStyle(6, 0xff2244, 0.35 + (0.8 - bs.windup) * 0.6);
      g.lineBetween(e.x, e.y - 40, e.x + nx * 520, e.y - 40 + ny * 520);
      if (bs.windup <= 0) {
        bs.dashing = B.chargeDurationSec;
        bs.dirX = nx;
        bs.dirY = ny;
        e.play('anim_e_blackknight', true);
        this.cameras.main.shake(120, 0.005);
      }
      return { mx: 0, my: 0, spd: 0 };
    }
    bs.chargeTimer -= dt;
    if (bs.chargeTimer <= 0 && b.slashWindup <= 0 && b.rush === 0 && !b.rushCharge) {
      bs.windup = B.chargeWindupSec;
      e.play('anim_e_blackknight_windup', true);
      b.animLock = now + 800;
      this.fxText(e.x, e.y - 150, '!!', '#FF4D6D');
      return { mx: 0, my: 0, spd: 0 };
    }

    // 必殺（スコアアタックのみ）：騎兵を横↔縦と交互に4連で呼び、直後に突進。進行中は他の行動をしない
    if (b.rush > 0 || b.rushCharge) {
      const K = CONFIG.blackKnight;
      b.rushT -= dt;
      if (b.rushT <= 0) {
        if (b.rush > 0) {
          this.queueCavalry(now, b.rushH, Math.random() < 0.5, K.rushCavalry);
          b.rushH = !b.rushH;
          b.rush--;
          b.rushT = b.rush > 0 ? K.rushIntervalSec : K.rushChargeDelaySec;
          if (b.rush === 0) b.rushCharge = true;
          e.play('anim_e_blackknight_summon', true);
          b.animLock = now + 700;
        } else {
          b.rushCharge = false;
          bs.windup = B.chargeWindupSec;
          e.play('anim_e_blackknight_windup', true);
          b.animLock = now + 800;
          this.fxText(e.x, e.y - 150, '!!', '#FF4D6D');
        }
      }
      return { mx: 0, my: 0, spd: 0 };
    }

    // 騎兵突撃（前半 6秒ごと／後半 4秒ごと）：3〜5体が画面を一直線に突っ切る。1秒前に赤線で予告
    b.cavalryTimer -= dt;
    if (b.cavalryTimer <= 0) {
      b.cavalryTimer = b.phase === 1 ? 6 : 4;
      if (this.stage.scoreMode && now >= b.rushCdUntil && b.slashWindup <= 0 && Math.random() < CONFIG.blackKnight.rushChance) {
        this.startKnightRush(e, now);
        return { mx: 0, my: 0, spd: 0 };
      }
      this.queueCavalry(now, Math.random() < 0.5, Math.random() < 0.5, Phaser.Math.Between(3, 5));
      e.play('anim_e_blackknight_summon', true);
      b.animLock = now + 700;
    }

    // 剣閃：200px以内で0.7秒予告 → 前方150°・半径180の横薙ぎ（25）
    b.slashCd -= dt;
    if (b.slashWindup > 0) {
      b.slashWindup -= dt;
      const a = Math.atan2(ny, nx);
      g.fillStyle(0xff2244, 0.18);
      g.slice(e.x, e.y - 40, 180, a - Phaser.Math.DegToRad(75), a + Phaser.Math.DegToRad(75), false);
      g.fillPath();
      if (b.slashWindup <= 0) {
        e.play('anim_e_blackknight_slash', true);
        b.animLock = now + 400;
        if (dist < 180 + p.def.hitRadius && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - 12 - (e.y - 40), p.x - e.x) - a)) <= Phaser.Math.DegToRad(75)) this.hurt(25, now);
        this.fxSlash(e.x, e.y - 40, 180, 0x9d4dff, a, 150, true);
        this.cameras.main.shake(100, 0.004);
      }
      return { mx: 0, my: 0, spd: 0 };
    }
    if (dist < 200 && b.slashCd <= 0) {
      b.slashWindup = 0.7;
      b.slashCd = 2.5;
      e.play('anim_e_blackknight_windup', true);
      b.animLock = now + 700;
      return { mx: 0, my: 0, spd: 0 };
    }

    if (now > b.animLock && e.anims.currentAnim?.key !== 'anim_e_blackknight') e.play('anim_e_blackknight', true);
    // 後半は少し速く詰める（弾幕は突進直後の追撃に移した）
    return { mx: nx, my: ny, spd: e.def.speed * (b.phase === 2 ? CONFIG.blackKnight.phase2SpeedMul : 1) };
  }

  /** 騎兵の一斉突撃を予約：n体が横（または縦）一直線に画面を突っ切る。1秒前から赤線で予告 */
  private queueCavalry(now: number, horizontal: boolean, fromLeft: boolean, n: number): void {
    const v = this.cameras.main.worldView;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const jitter = (Math.random() - 0.5) * 60;
      if (horizontal) {
        const y = v.top + 120 + t * (v.height - 240) + jitter;
        this.cavalryWarnings.push({ at: now + 1000 + i * 120, x1: fromLeft ? v.left - 150 : v.right + 150, y1: y, x2: fromLeft ? v.right + 150 : v.left - 150, y2: y });
      } else {
        const x = v.left + 80 + t * (v.width - 160) + jitter;
        this.cavalryWarnings.push({ at: now + 1000 + i * 120, x1: x, y1: fromLeft ? v.top - 150 : v.bottom + 150, x2: x, y2: fromLeft ? v.bottom + 150 : v.top - 150 });
      }
    }
  }

  /** 黒騎士の必殺（スコアアタック専用）を開始：騎兵4連（横↔縦を交互）→突進 */
  private startKnightRush(e: Enemy, now: number): void {
    const b = e.bk;
    const K = CONFIG.blackKnight;
    b.rush = K.rushVolleys;
    b.rushT = 0.6;
    b.rushH = Math.random() < 0.5;
    b.rushCharge = false;
    b.rushCdUntil = now + K.rushCooldownSec * 1000;
    b.cavalryTimer = (b.phase === 1 ? 6 : 4) + K.rushVolleys * K.rushIntervalSec;
    this.hud.banner('黒騎士 —— 鉄騎、総突撃', '#FF4D6D', 34);
    this.cameras.main.shake(250, 0.006);
    e.play('anim_e_blackknight_summon', true);
    b.animLock = now + 700;
  }

  /** 黒騎士・後半：突進直後の追撃を選ぶ（ばらまき／二連斬／連射。直前と同じものは選ばない） */
  private startKnightFollow(e: Enemy, now: number): void {
    const b = e.bk;
    const K = CONFIG.blackKnight;
    // 連撃（低確率）：すぐ斬撃 → 連射かばらまき
    if (b.forceCombo || Math.random() < K.comboChance) {
      b.forceCombo = false;
      b.lastFollow = 'combo';
      b.follow = 'comboSlash';
      b.followT = K.comboSlashWindupSec;
      b.comboAngle = Math.atan2(this.player.y - 12 - (e.y - 40), this.player.x - e.x);
      this.fxText(e.x, e.y - 170, '連撃', '#FF4D6D');
      e.play('anim_e_blackknight_windup', true);
      b.animLock = now + 450;
      return;
    }
    const options = ['scatter', 'cleave', 'barrage'].filter((x) => x !== b.lastFollow);
    const pick = options[Math.floor(Math.random() * options.length)];
    b.lastFollow = pick;
    if (pick === 'scatter') {
      b.follow = 'scatter';
      b.followT = K.scatterWindupSec + K.scatterSec;
      b.followTick = 0;
    } else if (pick === 'barrage') {
      b.follow = 'barrage';
      b.followT = K.barrageWindupSec + K.barrageBursts * K.barrageTickSec;
      b.followTick = 0;
    } else {
      b.follow = 'cleaveR';
      b.followT = K.cleaveWindupSec;
    }
    e.play('anim_e_blackknight_windup', true);
    b.animLock = now + 500;
  }

  /** 黒騎士・後半の追撃。ばらまき：足元の輪で予兆 → 全方位へランダム弾／二連斬：右半分（予兆）→ 左半分（予兆） */
  private updateKnightFollow(e: Enemy, dt: number, now: number): { mx: number; my: number; spd: number } {
    const b = e.bk;
    const K = CONFIG.blackKnight;
    const g = this.bossGfx;
    const p = this.player;
    const cx = e.x;
    const cy = e.y - 40;
    const still = { mx: 0, my: 0, spd: 0 };
    const finish = () => {
      b.follow = '';
      e.bossState.chargeTimer = K.followChargeDelaySec;
    };
    b.followT -= dt;

    // 連撃の一段目：突進の勢いのまま前方を斬る（予兆は短い）→ 連射かばらまきへ
    if (b.follow === 'comboSlash') {
      const half = Phaser.Math.DegToRad(K.comboSlashArcDeg / 2);
      if (b.followT > 0) {
        const k = 1 - b.followT / K.comboSlashWindupSec;
        g.fillStyle(0xff2244, 0.18 + k * 0.25);
        g.slice(cx, cy, K.comboSlashRadius, b.comboAngle - half, b.comboAngle + half, false);
        g.fillPath();
        return still;
      }
      const rx = p.x - cx;
      const ry = p.y - 12 - cy;
      if (Math.hypot(rx, ry) < K.comboSlashRadius + p.def.hitRadius && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ry, rx) - b.comboAngle)) <= half) this.hurt(K.comboSlashDamage, now);
      e.play('anim_e_blackknight_slash', true);
      b.animLock = now + 300;
      this.fxSlash(cx, cy, K.comboSlashRadius, 0x9d4dff, b.comboAngle, K.comboSlashArcDeg, true);
      this.cameras.main.shake(100, 0.004);
      if (Math.random() < 0.5) {
        b.follow = 'barrage';
        b.followT = K.barrageWindupSec + K.barrageBursts * K.barrageTickSec;
      } else {
        b.follow = 'scatter';
        b.followT = K.scatterWindupSec + K.scatterSec;
      }
      b.followTick = 0;
      return still;
    }

    if (b.follow === 'scatter') {
      if (b.followT > K.scatterSec) {
        const k = 1 - (b.followT - K.scatterSec) / K.scatterWindupSec;
        g.lineStyle(5, 0x9d4dff, 0.4 + k * 0.5);
        g.strokeCircle(cx, cy, 60 + k * 90);
        g.lineStyle(2, 0x9d4dff, 0.5);
        g.strokeCircle(cx, cy, 150);
        return still;
      }
      b.followTick -= dt;
      if (b.followTick <= 0) {
        b.followTick = K.scatterTickSec;
        for (let i = 0; i < K.scatterPerTick; i++) {
          this.fireEnemyBullet(cx, cy, Math.random() * Math.PI * 2, Phaser.Math.Between(K.scatterSpeedMin, K.scatterSpeedMax), 5, K.scatterDamage, 0x9d4dff);
        }
      }
      e.play('anim_e_blackknight_barrage', true);
      b.animLock = now + 200;
      if (b.followT <= 0) finish();
      return still;
    }

    // 連射（従来のマシンガン）：予告線のあと、狙いを追いながら扇状3連を撃ち続ける
    if (b.follow === 'barrage') {
      const a = Math.atan2(p.y - 12 - cy, p.x - cx);
      if (b.followT > K.barrageBursts * K.barrageTickSec) {
        g.lineStyle(3, 0x9d4dff, 0.65);
        g.lineBetween(cx, cy, cx + Math.cos(a) * 700, cy + Math.sin(a) * 700);
        return still;
      }
      b.followTick -= dt;
      if (b.followTick <= 0) {
        b.followTick = K.barrageTickSec;
        for (const off of [-0.18, 0, 0.18]) {
          this.fireEnemyBullet(cx + Math.cos(a) * 40, cy, a + off + (Math.random() - 0.5) * 0.05, K.barrageSpeed, 5, K.barrageDamage, 0x9d4dff);
        }
      }
      e.play('anim_e_blackknight_barrage', true);
      b.animLock = now + 200;
      if (b.followT <= 0) finish();
      return still;
    }

    // 二連斬（画面の左右基準）
    const right = b.follow === 'cleaveR';
    if (b.followT > 0) {
      const k = 1 - b.followT / (right ? K.cleaveWindupSec : K.cleaveSecondWindupSec);
      g.fillStyle(0xff2244, 0.14 + k * 0.22);
      g.slice(cx, cy, K.cleaveRadius, right ? -Math.PI / 2 : Math.PI / 2, right ? Math.PI / 2 : Math.PI * 1.5, false);
      g.fillPath();
      g.lineStyle(3, 0xff2244, 0.8);
      g.lineBetween(cx, cy - K.cleaveRadius, cx, cy + K.cleaveRadius);
      return still;
    }
    const rx = p.x - cx;
    const ry = p.y - 12 - cy;
    if (Math.hypot(rx, ry) < K.cleaveRadius && (right ? rx > 0 : rx < 0)) this.hurt(K.cleaveDamage, now);
    e.play('anim_e_blackknight_slash', true);
    b.animLock = now + 400;
    this.fxSlash(cx, cy, K.cleaveRadius, 0x9d4dff, right ? 0 : Math.PI, 180, true);
    this.cameras.main.shake(100, 0.004);
    if (right) {
      b.follow = 'cleaveL';
      b.followT = K.cleaveSecondWindupSec;
    } else {
      finish();
    }
    return still;
  }

  private cavalryWarnings: { at: number; x1: number; y1: number; x2: number; y2: number }[] = [];

  /**
   * 王級：周囲弾を撃ちながら、突進／狙い撃ち／踏み鳴らし／回転弾／十字斬りを重み付き乱数で繰り出す（直前と同じ行動は出さない）。
   * HP50%で「激昂」：1.2秒の咆哮のあと攻撃間隔が短くなり、弾数増・2連突進（低確率）・召集が加わる。
   * 範囲攻撃はすべて予兆（線・帯・円）を出してから当てる。突進は予兆の後半で向きが固定される。
   * 返り値: このフレームの移動速度
   */
  private updateBoss(e: Enemy, dt: number, now: number, dist: number, nx: number, ny: number): number {
    const b = e.bossState;
    const B = CONFIG.boss;
    const g = this.bossGfx;
    const p = this.player;
    // 激昂（50%を切った瞬間）
    if (b.phase === 1 && e.hp <= e.maxHp * B.phase2At) {
      b.phase = 2;
      b.act = 'roar';
      b.actT = 1.2;
      b.actLeft = 0;
      b.windup = 0;
      b.dashing = 0;
      this.hud.banner(`${e.def.name} —— 激昂`, '#FF4D6D', 34);
      this.cameras.main.shake(400, 0.007);
      this.fxRing(e.x, e.y - 60, 240, 0xff4d6d, 10);
    }
    const p2 = b.phase === 2;
    if (p2) {
      g.fillStyle(0xff2244, 0.16 + Math.sin(now / 120) * 0.06);
      g.fillCircle(e.x, e.y - 50, 125 + Math.sin(now / 95) * 8);
    }
    if (b.act === 'roar') {
      b.actT -= dt;
      e.x += (Math.random() - 0.5) * 8;
      if (b.actT <= 0) { b.act = ''; b.actTimer = 1; }
      return 0;
    }

    // 周囲弾（常時）：激昂後は弾数増・間隔短。毎回少し回転させて隙間の位置をずらす
    b.ringTimer -= dt;
    if (b.ringTimer <= 0) {
      b.ringTimer = p2 ? B.ringEverySec * 0.8 : B.ringEverySec;
      const n = p2 ? B.ringCount + 4 : B.ringCount;
      b.ringSpin += 0.37;
      for (let i = 0; i < n; i++) this.fireEnemyBullet(e.x, e.y - 20, (i / n) * Math.PI * 2 + b.ringSpin, B.ringBulletSpeed, 6, B.ringBulletDamage);
    }

    // 突進：予兆（前半は狙いを追う細い線 → 後半は向きを固定した帯）→ダッシュ。2連のときは2回目も同じ長さの予兆を出す
    if (b.dashing > 0) {
      b.dashing -= dt;
      if (b.dashing <= 0 && b.actLeft > 0) {
        b.actLeft--;
        b.windup = B.kingChargeTrackSec + B.kingChargeLockSec;
        this.fxText(e.x, e.y - 130, '!!', '#FF4D6D');
      }
      return B.chargeSpeed;
    }
    if (b.windup > 0) {
      b.windup -= dt;
      e.x += (Math.random() - 0.5) * 6;
      const reach = B.chargeSpeed * B.chargeDurationSec + e.radius;
      if (b.windup > B.kingChargeLockSec) {
        b.dirX = nx;
        b.dirY = ny;
        g.lineStyle(4, 0xff2244, 0.55);
        g.lineBetween(e.x, e.y - 40, e.x + nx * reach, e.y - 40 + ny * reach);
      } else {
        const k = 1 - Math.max(0, b.windup) / B.kingChargeLockSec;
        g.lineStyle(e.radius * 1.7, 0xff2244, 0.14 + k * 0.22);
        g.lineBetween(e.x, e.y - 40, e.x + b.dirX * reach, e.y - 40 + b.dirY * reach);
        g.lineStyle(4, 0xff2244, 0.8);
        g.lineBetween(e.x, e.y - 40, e.x + b.dirX * reach, e.y - 40 + b.dirY * reach);
      }
      if (b.windup <= 0) {
        b.dashing = B.chargeDurationSec;
        this.cameras.main.shake(120, 0.005);
      }
      return 0;
    }

    // 狙い撃ち：0.5秒の予告線 → プレイヤーへ扇状3way（激昂後5way）を0.22秒間隔で連射
    if (b.act === 'burst') {
      b.actT -= dt;
      if (b.actT > 0) {
        g.lineStyle(3, 0xffd700, 0.55);
        g.lineBetween(e.x, e.y - 40, e.x + nx * 700, e.y - 40 + ny * 700);
        return 0;
      }
      b.actTick -= dt;
      if (b.actTick <= 0) {
        b.actTick = 0.22;
        b.actLeft--;
        const a = Math.atan2(ny, nx);
        const offs = p2 ? [-0.34, -0.17, 0, 0.17, 0.34] : [-0.2, 0, 0.2];
        for (const off of offs) this.fireEnemyBullet(e.x + nx * 50, e.y - 40, a + off, B.burstBulletSpeed, 5, B.burstBulletDamage, 0xffd700);
        this.fxCross(e.x + nx * 50, e.y - 40, 26, 0xffd700);
        if (b.actLeft <= 0) { b.actLeft = 0; b.act = ''; }
      }
      return 0;
    }

    // 踏み鳴らし：広がる予告円 → 円内にダメージ＋衝撃波（遅い弾を全周に）
    if (b.act === 'stomp') {
      b.actT -= dt;
      const R = p2 ? B.stompRadius * 1.15 : B.stompRadius;
      const cx = e.x;
      const cy = e.y - 30;
      if (b.actT > 0) {
        const k = 1 - b.actT / B.stompWindupSec;
        g.fillStyle(0xff2244, 0.12 + k * 0.18);
        g.fillCircle(cx, cy, R);
        g.lineStyle(4, 0xff2244, 0.5 + k * 0.4);
        g.strokeCircle(cx, cy, R * k);
        return 0;
      }
      b.act = '';
      this.cameras.main.shake(220, 0.009);
      this.fxRing(cx, cy, R, 0xff4d6d, 8);
      if (Math.hypot(p.x - cx, p.y - 12 - cy) < R) this.hurt(B.stompDamage, now);
      const n = p2 ? 12 : 8;
      for (let i = 0; i < n; i++) this.fireEnemyBullet(cx, cy, (i / n) * Math.PI * 2 + b.ringSpin, 110, 3.5, 8, 0xff8866);
      return 0;
    }

    // 十字斬り：自身を中心に十字（または×字）の帯で予告 → 帯の上にダメージ。激昂後は45°回して二段目
    if (b.act === 'cross') {
      b.actT -= dt;
      const cx = e.x;
      const cy = e.y - 30;
      const L = B.crossLength;
      const total = b.actLeft > 0 || !p2 ? B.crossWindupSec : B.crossSecondWindupSec;
      if (b.actT > 0) {
        const k = 1 - b.actT / total;
        for (let i = 0; i < 2; i++) {
          const a = b.actAngle + (i * Math.PI) / 2;
          const ux = Math.cos(a) * L;
          const uy = Math.sin(a) * L;
          g.lineStyle(B.crossHalfWidth * 2, 0xff2244, 0.14 + k * 0.22);
          g.lineBetween(cx - ux, cy - uy, cx + ux, cy + uy);
          g.lineStyle(3, 0xff2244, 0.8);
          g.lineBetween(cx - ux, cy - uy, cx + ux, cy + uy);
        }
        return 0;
      }
      const rx = p.x - cx;
      const ry = p.y - 12 - cy;
      let hit = false;
      for (let i = 0; i < 2; i++) {
        const a = b.actAngle + (i * Math.PI) / 2;
        const along = rx * Math.cos(a) + ry * Math.sin(a);
        const perp = -rx * Math.sin(a) + ry * Math.cos(a);
        if (Math.abs(perp) < B.crossHalfWidth && Math.abs(along) < L) hit = true;
        this.fxBand(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L, B.crossHalfWidth * 2, 0xff4d6d);
      }
      if (hit) this.hurt(B.crossDamage, now);
      this.cameras.main.shake(140, 0.006);
      if (b.actLeft > 0) {
        b.actLeft--;
        b.actAngle += Math.PI / 4;
        b.actT = B.crossSecondWindupSec;
      } else {
        b.act = '';
      }
      return 0;
    }

    // 回転弾：ゆっくり歩きながら2本腕（激昂後3本）の渦を撒く
    if (b.act === 'spiral') {
      b.actT -= dt;
      b.actTick -= dt;
      if (b.actTick <= 0) {
        b.actTick = 0.09;
        b.ringSpin += 0.42;
        const arms = p2 ? 3 : 2;
        for (let i = 0; i < arms; i++) this.fireEnemyBullet(e.x, e.y - 30, b.ringSpin + (i / arms) * Math.PI * 2, B.spiralBulletSpeed, 6, B.ringBulletDamage, 0xff88aa);
      }
      if (b.actT <= 0) b.act = '';
      return e.def.speed * 0.35;
    }

    // 次の行動：重み付き乱数（直前と同じ行動は除く）
    b.actTimer -= dt;
    if (b.actTimer <= 0) {
      const table = p2 ? B.weightsPhase2 : B.weights;
      const same = (k: string) => k === b.lastAct || (k.startsWith('charge') && b.lastAct.startsWith('charge'));
      let total = 0;
      for (const k in table) if (!same(k)) total += table[k];
      let r = Math.random() * total;
      let act = 'charge';
      for (const k in table) {
        if (same(k)) continue;
        r -= table[k];
        if (r <= 0) { act = k; break; }
      }
      b.lastAct = act;
      b.pattern++;
      b.actTimer = p2 ? B.attackEverySec * 0.75 : B.attackEverySec;
      switch (act) {
        case 'charge':
        case 'charge2':
          b.windup = B.kingChargeTrackSec + B.kingChargeLockSec;
          b.actLeft = act === 'charge2' ? 1 : 0;
          this.fxText(e.x, e.y - 130, act === 'charge2' ? '!!×2' : '!!', '#FF4D6D');
          return 0;
        case 'burst':
          b.act = 'burst';
          b.actT = 0.5;
          b.actLeft = p2 ? 4 : 3;
          b.actTick = 0;
          return 0;
        case 'stomp':
          b.act = 'stomp';
          b.actT = B.stompWindupSec;
          return 0;
        case 'cross':
          b.act = 'cross';
          b.actT = B.crossWindupSec;
          b.actAngle = Math.random() < 0.5 ? 0 : Math.PI / 4;
          b.actLeft = p2 ? 1 : 0;
          return 0;
        case 'spiral':
          b.act = 'spiral';
          b.actT = p2 ? 2.2 : 1.8;
          b.actTick = 0;
          b.ringSpin += 0.5;
          return 0;
        case 'summon': {
          // 召集：周囲に雑兵（4体に1体は狩人級）
          const n = 8;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + b.ringSpin;
            const sp = this.spawner.spawnOne(i % 4 === 3 ? 'hunter' : 'grunt', e.x + Math.cos(a) * 170, e.y - 30 + Math.sin(a) * 170, this.stage.enemyHpMul);
            if (sp) this.hitSpark(sp.x, sp.y, 0xff4d6d, 4);
          }
          this.fxRing(e.x, e.y - 40, 190, 0xff4d6d, 5);
          this.fxText(e.x, e.y - 130, '集え', '#FF4D6D');
          return 0;
        }
      }
    }
    return e.def.speed;
  }

  /** 設置物を追加。同じ出所の同時数が上限（CONFIG.zoneCaps）を超えたら古いものから消す */
  private addZone(z: ZoneOpts): void {
    const src = z.source ?? '';
    const cap = CONFIG.zoneCaps[src] ?? CONFIG.zoneCaps.default;
    let same = 0;
    for (const o of this.zones) if ((o.source ?? '') === src) same++;
    for (let i = 0; i < this.zones.length && same >= cap; i++) {
      if ((this.zones[i].source ?? '') === src) { this.zones.splice(i, 1); i--; same--; }
    }
    while (this.zones.length >= CONFIG.maxZones) this.zones.shift();
    this.zones.push({ ...z, elapsed: 0, tick: 0 });
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
        if (doTick) this.damageEnemy(e, z.dps * 0.25 * (z.source === 'cage' && e.def.id === 'blackknight' ? 0.5 : 1), 0, 0);
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
          const turn = Phaser.Math.Clamp(diff, -b.turnRate * dt, b.turnRate * dt);
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
        // 跳弾バグ：飛んでいる敵に響の弾が当たると加速
        if (e.fly && e.fly.bounces && b.texture.key === 'art_refresh') { e.fly.vx *= 1.25; e.fly.vy *= 1.25; }
        this.damageEnemy(e, b.damage, Math.cos(a) * b.knockback, Math.sin(a) * b.knockback);
        if (b.slow < 1) e.applySlow(b.slow, b.slowSec, now);
        this.hitSpark(b.x, b.y, 0x87ceeb, 3);
        // 小爆発（焔の猟犬）
        if (b.explodeRadius > 0) {
          this.tmp2.length = 0;
          this.enemiesInCircle(b.x, b.y, b.explodeRadius, this.tmp2);
          for (const o of this.tmp2) if (o !== e) this.damageEnemy(o, b.explodeDamage, 0, 0);
          this.fxRing(b.x, b.y, b.explodeRadius, 0xff6a00, 3);
        }
        // 倒したら同じ弾を生む（焔の大狩猟）
        if (b.spawnOnKill && !e.active && b.opts) {
          const tex = b.texture.key;
          let alive = 0;
          for (const o of list) if (o.active && o.texture.key === tex) alive++;
          if (alive < b.maxSpawned) this.fireBullet({ ...b.opts, x: e.x, y: e.y, angle: Math.random() * Math.PI * 2 });
        }
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
        this.hurt(b.damage, now);
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
    // 固有パッシブ『精密制御』：投射物すべてにゆるい追尾（跳弾・ブーメランは除く）
    if (this.player.def.uniquePassive.id === 'precision' && !o.homing && !o.bounce && !o.boomerangDist) {
      o = { ...o, homing: true, turnRate: Math.PI / 2 };
    }
    const b = this.bullets.get(o.x, o.y) as Bullet | null;
    if (!b) return null;
    b.fire(o);
    AudioBus.play('se_shot', 70);
    return b;
  }

  private fireEnemyBullet(x: number, y: number, angle: number, speed: number, life: number, damage: number, tint?: number): void {
    const b = this.ebullets.get(x, y) as EnemyBullet | null;
    if (b) b.fire(x, y, angle, speed, life, damage, tint);
  }

  private kick(e: Enemy, angle: number, speed: number, durationSec: number, damage: number): void {
    this.damageEnemy(e, damage, 0, 0);
    if (!e.active) return;
    e.fly = { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, until: this.ctx.now + durationSec * 1000, damage, hit: new Set() };
  }

  /** DPS計測（デバッグ表示用）：直近5秒の与ダメージ */
  private dmgLog: { t: number; d: number }[] = [];

  private damageEnemy(e: Enemy, dmg: number, kx: number, ky: number): void {
    if (!e.active) return;
    if (e.def.id === 'blackknight' && this.gameNow < e.bk.invulnUntil) return;
    if (this.debug) this.dmgLog.push({ t: this.gameNow, d: Math.min(dmg, e.hp) });
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
    // 必殺技（その炎上も含む）で倒した分はゲージに数えない
    if (!this.specialDamage) this.soulGauge = Math.min(1, this.soulGauge + this.up.stats.soulGainMul / CONFIG.soul.killsToFull);
    if (this.stage.scoreMode) {
      const now = this.ctx.now;
      if (now < this.comboUntil) this.combo++;
      else this.combo = 0;
      this.comboUntil = now + SCORE.comboWindowSec * 1000;
      this.comboMul = Math.min(SCORE.comboMax, 1 + this.combo * SCORE.comboStep);
      this.score += (SCORE.points[def.id] ?? 1) * this.comboMul;
    }
    this.xp.drop(e.x, e.y, def.xp, this.ctx.now, this.up.stats.luckMul);
    if (def.tier >= 2 && !def.boss && Math.random() < ITEMS.chest.dropChance * this.up.stats.luckMul) {
      this.xp.spawn(e.x, e.y, 'chest', 1, this.ctx.now);
    }
    AudioBus.play('se_kill', 40);
    if (def.boss) {
      // 撃破ボーナスのエール
      if (def.defeatYell) {
        this.xp.yell += def.defeatYell;
        this.fxText(this.player.x, this.player.y - 140, `+${def.defeatYell} ★`, '#FFD700');
      }
      this.bosses = this.bosses.filter((b) => b !== e);
      if (this.bosses.every((b) => !b.active)) this.spawner.bossActive = false;
      if (this.stage.scoreMode && def.id !== 'blackknight') {
        this.hud.banner(`${def.name} 撃破　+${SCORE.points[def.id]}`, '#FFD700', 34);
        this.cameras.main.flash(300, 255, 255, 255);
        // スコアアタックは撃破後も続くので、ボスが居なくなったら道中の曲に戻す
        this.resumeBgm();
        return;
      }
      this.bossGfx?.clear();
      this.cavalryWarnings.length = 0;
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
      const heal = Math.round(ITEMS.cake.heal * this.player.def.traits.healItemMul);
      this.player.heal(heal);
      this.fxText(this.player.x, this.player.y - 110, `+${heal}`, '#F0E68C');
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

  /** ボイス（キャラ別。未配置なら無音） */
  private vo(kind: string, minGapMs = 0): void {
    AudioBus.play(`vo_${this.player.def.voicePrefix}_${kind}`, minGapMs);
  }

  /** プレイヤーへのダメージ入口：被ダメ倍率・必殺の軽減・完全看破の回避 */
  private hurt(amount: number, now: number): void {
    if (this.debugInvincible) return;
    const p = this.player;
    const def = p.def;
    if (now < p.invulnUntil) return;
    if (now >= p.shieldUntil && def.uniquePassive.id === 'kanpa' && Math.random() < 0.2) {
      // 完全看破：回避して1秒間攻撃力+30%
      p.invulnUntil = now + 150;
      this.kanpaUntil = now + 1000;
      this.fxText(p.x, p.y - 110, '看破', '#E8F4FF');
      return;
    }
    let mul = this.up.stats.damageTakenMul;
    if (now < this.soulUntil && def.special.id === 'aqua_lament') mul *= 0.3;
    if (p.takeDamage(amount * mul, now, amount)) {
      this.onPlayerHit();
      if (this.stage.scoreMode) { this.combo = 0; this.comboMul = 1; this.scoreNoDamageBreak(); }
    }
  }

  private onPlayerHit(): void {
    this.cameras.main.shake(90, 0.004);
    AudioBus.play('se_hit', 120);
    this.vo('hit', 2500);
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

  /** heavy：黒騎士の斬撃用の重い音（未配置なら通常の斬撃音） */
  private fxSlash(x: number, y: number, r: number, color: number, angle: number, arcDeg: number, heavy = false): void {
    if (heavy) AudioBus.play('se_slash_heavy', 80, 'se_slash');
    else AudioBus.play('se_slash', 80);
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

  /** 帯状の閃光（ボスの範囲攻撃の命中表示。敵より下に描く） */
  private fxBand(x1: number, y1: number, x2: number, y2: number, width: number, color: number): void {
    const g = this.add.graphics().setDepth(9);
    g.lineStyle(width, color, 0.6);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(Math.max(4, width * 0.2), 0xffffff, 0.85);
    g.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
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

  private onBandChange(label: string, fullMoon: boolean, from: number, hasBoss = false): void {
    // ボスの時間帯と満月は専用の字幕が出るので、時間帯名の字幕は出さない（二重表示の防止）
    const ownBanner = hasBoss || (fullMoon && !this.fullMoon);
    if (from > 0 && !ownBanner) this.hud.banner(`— ${label} —`);
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
    this.resumeBgm();
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
    this.resumeBgm();
  }

  /** いまの状況に合うBGMへ：ボス生存中はボス曲（王級／黒騎士で別）、満月中は満月曲、それ以外はキャラ曲 */
  private resumeBgm(): void {
    const boss = this.bosses.find((b) => b.active);
    if (boss) {
      if (boss.def.id === 'blackknight') AudioBus.playBgm('bgm_boss_blackknight', 'bgm_boss');
      else AudioBus.playBgm('bgm_boss', 'bgm_boss_blackknight');
      return;
    }
    const chara = `bgm_chara_${this.player.def.id}`;
    if (this.fullMoon) AudioBus.playBgm('bgm_fullmoon', chara, this.stage.bgm, 'bgm_stage');
    else AudioBus.playBgm(chara, this.stage.bgm, 'bgm_stage');
  }

  /** ノーダメージ時間を確定させる（被弾で区切る） */
  private scoreNoDamageBreak(): void {
    this.score += this.noDamageSec * SCORE.noDamagePerSec;
    this.noDamageSec = 0;
  }

  private onBossSpawn(boss: Enemy, bandHpMul = 1, index = 0, total = 1): void {
    this.boss = boss;
    this.bosses.push(boss);
    // プレイヤーの成長に合わせてHPを底上げ（固定HPだと10:00の火力で即落ちする）
    boss.maxHp = Math.round((boss.def.hp + this.xp.level * CONFIG.boss.hpPerPlayerLevel) * this.stage.bossHpMul * bandHpMul);
    boss.hp = boss.maxHp;
    // 複数同時に出るときも、字幕・揺れ・効果音は1回だけ
    if (index === 0) {
      this.hud.banner(total > 1 ? `${boss.def.name} ×${total} —— 出現` : `${boss.def.name} —— 出現`, '#FF4D6D', 40);
      this.cameras.main.shake(300, 0.006);
      AudioBus.play('se_boss');
    }
    this.resumeBgm();
  }

  private activateSoul(): void {
    if (this.over || this.overlayActive()) return;
    if (this.soulGauge < 1 || this.ctx.now < this.soulUntil) return;
    const def = this.player.def;
    const sp = SPECIALS[def.special.id];
    this.soulGauge = 0;
    this.soulUntil = this.ctx.now + sp.durationSec * 1000;
    this.specialHost = { state: {} };
    this.specialRunning = true;
    this.specialDamage = true;
    sp.activate(this.ctx, this.specialHost);
    this.specialDamage = false;
    this.hud.banner(def.special.name, Phaser.Display.Color.IntegerToColor(def.color).rgba, 36);
    this.cameras.main.flash(300, 135, 206, 235);
    AudioBus.play('se_special');
    this.vo('special');
  }

  private openLevelUp(): void {
    if (this.overlayActive()) {
      this.xp.pendingLevelUps++;
      return;
    }
    const choices = this.up.buildChoices(3);
    // 強化できるものが無い：選択画面を出さずにその場で回復
    if (choices.length === 1 && choices[0].kind === 'heal') {
      const p = this.player;
      const amount = Math.round(p.maxHp * CONFIG.levelUpFallbackHeal);
      p.heal(amount);
      this.fxText(p.x, p.y - 110, `Lv UP  +${amount}`, '#7CFFB2');
      AudioBus.play('se_levelup', 300);
      return;
    }
    const data: LevelUpData = {
      level: this.xp.level,
      choices,
      onPick: (c: Choice) => this.applyChoice(c),
      reroll: () => this.up.buildChoices(3),
      skip: () => this.player.heal(this.player.maxHp * 0.1),
      ban: (c: Choice) => {
        this.up.banned.add(`${c.kind}:${c.id}`);
        const keep = choices.filter((x) => x !== c);
        const extra = this.up.buildChoices(6).filter((x) => !keep.some((k) => k.id === x.id && k.kind === x.kind) && !(x.kind === c.kind && x.id === c.id));
        return [...keep, ...extra].slice(0, 3);
      },
    };
    AudioBus.play('se_levelup');
    this.vo('levelup', 4000);
    this.joystick.reset();
    this.haltFrame = true;
    this.scene.pause();
    this.scene.launch('LevelUp', data);
  }

  private applyChoice(c: Choice): void {
    const r = this.up.apply(c);
    const p = this.player;
    p.maxHp = Math.round(p.def.hp * p.def.traits.maxHpMul * this.up.stats.maxHpMul) + this.up.stats.maxHpBonus;
    if (r.maxHpDelta > 0) p.heal(r.maxHpDelta);
    if (r.heal > 0) p.heal(p.maxHp * r.heal);
    if (c.kind === 'weapon' && c.id === this.up.main.def.id && this.up.main.isMaxLevel) {
      const last = this.up.main.def.levels[this.up.main.def.levels.length - 1].desc;
      const m = last.match(/『([^』]+)』/);
      this.hud.banner(m ? `『${m[1]}』` : last);
      this.vo('evolve');
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
    // 強化できるものが無いときは開封画面を出さず、その場でエール＋HP回復（v2）
    if (!this.up.hasChestReward()) {
      this.xp.yell += 20;
      this.player.heal(10);
      this.fxText(this.player.x - 30, this.player.y - 110, '+20 ★', '#FFD700');
      this.fxText(this.player.x + 40, this.player.y - 130, '+10', '#87CEFA');
      AudioBus.play('se_item');
      return;
    }
    const data: ChestData = {
      open: () => this.up.openChest(this.up.stats.luckMul),
      onClose: (r: ChestResult) => {
        const p = this.player;
        p.maxHp = Math.round(p.def.hp * p.def.traits.maxHpMul * this.up.stats.maxHpMul) + this.up.stats.maxHpBonus;
        for (const rw of r.rewards) {
          if (rw.kind === 'yell' && rw.yell) this.xp.yell += rw.yell;
          if (rw.kind === 'fusion' && rw.owners) {
            for (const o of rw.owners) this.cutIn.show({ owner: o, title: rw.title, tag: 'FUSION', color: rw.color });
          } else if (rw.owner && rw.kind !== 'yell') {
            this.cutIn.show({
              owner: rw.owner, title: rw.title,
              tag: rw.kind === 'evolve' ? 'EVOLVE' : rw.sub, color: rw.color,
            });
          }
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
    if (this.specialRunning) {
      SPECIALS[this.player.def.special.id].end?.(this.ctx, this.specialHost);
      this.specialRunning = false;
    }
    // 終了演出は等速で
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    AudioBus.stopBgm();
    this.vo(cleared ? 'clear' : 'gameover');
    if (this.stage.scoreMode) {
      this.scoreNoDamageBreak();
      this.score += this.elapsed * SCORE.survivalPerSec;
    }
    const result: RunResult = {
      characterId: this.characterId,
      cleared,
      score: this.stage.scoreMode ? Math.round(this.score) : undefined,
      timeUp: this.timeUp,
      kills: this.kills,
      timeSec: Math.floor(this.elapsed),
      level: this.xp.level,
      yell: this.xp.yell,
      speed: this.speed,
      stageId: this.stage.id,
      arts: this.up.arts.map((w) => ({ name: w.name, level: w.level, color: w.def.color, evolved: w.evolved, fusion: !!w.def.fusion })),
      debug: this.debugUsed,
    };
    if (!cleared) {
      this.player.play(`${this.player.spriteKey}_hit`);
      this.tweens.add({ targets: this.player, alpha: 0, duration: 900, delay: 300 });
    } else {
      this.hud.banner('—— 声は、届いた ——', '#FFFFFF', 36);
    }
    this.cameras.main.fadeOut(cleared ? 1800 : 1100, 6, 9, 19);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', result));
  }
}
