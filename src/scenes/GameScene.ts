import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { CHARACTERS, DEFAULT_CHARACTER } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { stageById, type StageDef } from '../data/stages';
import { SCORE } from '../data/score';
import { ENDLESS } from '../data/endless';
import { RUSH, rushWaves, rushTempo, rushDamageMul, fmtTime } from '../data/rush';
import { isHeld } from '../utils/heldKeys';
import { screenFlash } from '../utils/screenFlash';
import { customBgmKeys, type BgmSlot } from '../utils/bgmCustom';
import { ITEMS, PICKUPS, type PickupKind } from '../data/items';
import { Player } from '../entities/Player';
import { Enemy, type Hazard } from '../entities/Enemy';
import { ensureDamageFont } from '../utils/textures';
import { isCharacterOwned } from '../utils/unlock';
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
import { loadSave, writeSave, isStageUnlocked } from '../utils/storage';
import { ensureBestiary, recordEnemySeen } from '../utils/bestiary';
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
  /** 『エンジェリック・ランブル』のあとの攻撃力アップが切れる時刻 */
  private rumbleUntil = 0;
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
  private lastMinuteShown = false;
  /** 拾った宝箱の未開封数（重ね画面を避けるため update で順に開く） */
  private pendingChests = 0;
  /** ゲーム速度（×1 / ×1.5 / ×2） */
  private speed = 1;
  /** ゲーム内時刻（ms）。速度倍率を反映した時計。無敵・鈍化などのタイマーはこれ基準 */
  private gameNow = 0;
  /** このフレーム内で重ね画面を開いた（残りの分割ステップを止める） */
  private haltFrame = false;
  /** ヒットストップ（ボス撃破の瞬間に、一瞬だけ時間を止める）。残り時間（ms） */
  private hitStopMs = 0;
  /** ダメージの数字（使い回す） */
  private dmgNums: { t: Phaser.GameObjects.BitmapText; life: number }[] = [];
  private showDamage = true;
  /** `?debug` でボスHP・DPS などを表示 */
  private debug = typeof location !== 'undefined' && /debug/.test(location.search);
  /** デバッグ操作を使ったプレイは記録・エールを保存しない */
  private debugUsed = false;
  /** 図鑑に登録済みの敵（このプレイで画面に入った敵を含む） */
  private seenEnemies = new Set<string>();
  private debugInvincible = false;
  private debugNoSpawn = false;
  private debugExIndex = 0;
  /** 次にゲームへ戻ったとき、少しだけ無敵にする（レベルアップ・宝箱の画面を開いたとき立てる） */
  private guardOnResume = false;
  /** ボスラッシュで選んだ共鳴アーツ（init で受け取る） */
  private rushArts: string[] = [];
  private rushSupports: string[] = [];
  /** ボスラッシュの進行：周・組・次のボスが出る時刻・周の開始時刻・周ごとのクリア時間・ボスごとの撃破時刻・未処理の報酬 */
  private rush = { loop: 1, wave: 0, nextAt: 0, loopStartSec: 0, loopTimes: [] as number[], bossTimes: [] as { name: string; sec: number; loop: number }[], rewards: [] as ('support' | 'art' | 'chest')[], bossesDefeated: 0 };
  /** 戦闘中の曲のカスタム（場面 → 音声のキー。CUSTOM でなければ空） */
  private customBgm: Partial<Record<BgmSlot, string>> = {};
  private debugRookIndex = 0;
  private debugQueenIndex = 0;
  private fullMoon = false;
  private enemySpeedMul = 1;

  constructor() {
    super('Game');
  }

  init(data: { characterId?: string; stageId?: number; rushArts?: string[]; rushSupports?: string[] }): void {
    this.characterId = data.characterId ?? DEFAULT_CHARACTER;
    this.stage = stageById(data.stageId ?? 1);
    this.rushArts = data.rushArts ?? [];
    this.rushSupports = data.rushSupports ?? [];
    this.rush = { loop: 1, wave: 0, nextAt: 0, loopStartSec: 0, loopTimes: [], bossTimes: [], rewards: [], bossesDefeated: 0 };
    this.elapsed = 0;
    this.kills = 0;
    this.over = false;
    this.zones = [];
    this.soulGauge = 0;
    this.soulUntil = 0;
    // デバッグ操作の状態は1プレイごとに戻す（シーンは使い回されるため）
    this.debugUsed = false;
    this.guardOnResume = false;
    this.seenEnemies = new Set(ensureBestiary(loadSave()));
    this.debugInvincible = false;
    this.debugNoSpawn = false;
    this.specialHost = { state: {} };
    this.specialRunning = false;
    this.kanpaUntil = 0;
    this.rumbleUntil = 0;
    this.cureTimer = 0;
    this.boss = null;
    this.bossDefeated = false;
    this.hitStopMs = 0;
    this.bosses = [];
    this.cavalryWarnings = [];
    this.hazards = [];
    this.cycleShown = 0;
    this.cycleDamageMul = 1;
    this.walls = [];
    this.pollens = [];
    this.cage = null;
    this.pkx = 0;
    this.pky = 0;
    this.inPollen = false;
    this.fixedArrow = false;
    this.score = 0;
    this.combo = 0;
    this.comboMul = 1;
    this.comboUntil = 0;
    this.noDamageSec = 0;
    this.timeUp = false;
    this.lastMinuteShown = false;
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
    this.up.permanent = this.stage.noPermanent ? {} : loadSave().permanent;
    this.up.setMain(def.startWeapon);
    for (const id of def.excludedArts) this.up.excluded.add(id);
    this.up.traitDamageMul = def.traits.damageMul;
    this.up.characterId = this.characterId;
    // ボスラッシュ：Lv40 固定。初期武器と、選んだ共鳴アーツ3つを Lv8 で持って始める
    if (this.stage.rush) {
      while (!this.up.main.isMaxLevel) this.up.main.levelUp();
      for (const id of this.rushArts) {
        if (this.up.arts.some((w) => w.def.id === id)) continue;
        const r = this.up.apply({ kind: 'weapon', id, title: '', owner: '', tag: '', desc: '', color: 0 });
        const w = r.newWeapon;
        if (w) while (!w.isMaxLevel) w.levelUp();
      }
      // 持っていくサポートは最大Lv
      for (const id of this.rushSupports) if (PASSIVES[id]) this.up.passives.set(id, PASSIVES[id].maxLevel);
    }
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
    // ボスラッシュは Lv 固定（ボスのHPの式に使う）
    if (this.stage.rush) this.xp.level = RUSH.fixedLevel;
    this.xp.xpMul = this.stage.xpMul;
    this.xp.onItem = (kind, value, x, y) => this.onItem(kind, value, x, y);
    this.spawner = new Spawner(this, this.enemies, this.player, this.stage);
    this.spawner.onBandChange = (b) => this.onBandChange(b.label, !!b.fullMoon, b.from, !!b.boss);
    this.spawner.onBossSpawn = (boss, hpMul, index, total, enraged) => this.onBossSpawn(boss, hpMul, index, total, enraged);
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
        slash: (x, y, r, color, angle, arcDeg, playSe) => this.fxSlash(x, y, r, color, angle, arcDeg, playSe),
        ring: (x, y, r, color, width) => this.fxRing(x, y, r, color, width),
        cross: (x, y, size, color) => this.fxCross(x, y, size, color),
        line: (x1, y1, x2, y2, width, color) => this.fxLine(x1, y1, x2, y2, width, color),
        text: (x, y, text, color) => this.fxText(x, y, text, color),
      },
    };

    // 曲は resumeBgm で決める（カスタムの割り当てがあれば、最初からそれを流す。シーンは使い回されるので、ここで読み直す）
    this.customBgm = customBgmKeys(loadSave());
    this.resumeBgm();
    this.vo('start');
    this.hud.banner(`${this.stage.nameEn} —— ${this.stage.name}`, Phaser.Display.Color.IntegerToColor(this.stage.color).rgba, 32);
    // ダメージの数字（オプションで出す／出さないを切り替え。ポーズからオプションを開いて戻ったときも読み直す）
    const font = ensureDamageFont(this);
    this.dmgNums = [];
    for (let i = 0; i < 48; i++) this.dmgNums.push({ t: this.add.bitmapText(0, 0, font, '', 32).setOrigin(0.5).setDepth(41).setLetterSpacing(-7).setVisible(false), life: 0 });
    const readSetting = () => {
      const sv = loadSave();
      const st = sv.settings;
      this.showDamage = st.damageNumbers !== false;
      this.hud.setSpecialSide(st.specialSide === 'left' ? 'left' : 'right');
      Enemy.hitFlash = st.hitFlash === 'soft' || st.hitFlash === 'off' ? st.hitFlash : 'strong';
      // 曲のカスタム（ポーズ → オプションで切り替えたら、戻った瞬間に曲も変える）
      const before = JSON.stringify(this.customBgm);
      this.customBgm = customBgmKeys(sv);
      if (JSON.stringify(this.customBgm) !== before && this.player) this.resumeBgm();
    };
    readSetting();
    this.events.on(Phaser.Scenes.Events.RESUME, readSetting);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, readSetting));
    // レベルアップ・宝箱の画面を閉じた直後は、少しだけ無敵（ポーズからの復帰には付けない）
    const guardResume = () => {
      if (!this.guardOnResume) return;
      this.guardOnResume = false;
      const p = this.player;
      p.invulnUntil = Math.max(p.invulnUntil, this.gameNow + CONFIG.resumeInvulnSec * 1000 * this.speed);
    };
    this.events.on(Phaser.Scenes.Events.RESUME, guardResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, guardResume));
    if (this.debug) this.buildDebugPanel();
    // `?debug` の仮の解放で選んだキャラは、確認用のプレイとして扱う（記録・エールを保存しない）
    if (this.debug && !isCharacterOwned(this.characterId, loadSave())) this.debugUsed = true;
    // `?debug` で、解放していないエンドレスに入ったときも同じ
    if (this.debug && this.stage.endless && !isStageUnlocked(loadSave(), this.stage.unlockAfter)) this.debugUsed = true;
  }

  /**
   * デバッグパネル（URLに `?debug` を付けたときだけ）：ボスの即出現・HP50%・無敵・雑魚の停止・Lv+5。
   * 一度でも使うと、そのプレイの記録・エールは保存しない。
   */
  private buildDebugPanel(): void {
    const used = () => { this.debugUsed = true; };
    const spawnBoss = (id: 'rook' | 'queen' | 'blackknight' | 'redknight') => {
      used();
      const boss = this.spawner.spawnOne(id, this.player.x, this.player.y - 420, 1);
      if (!boss) return;
      this.spawner.bossActive = true;
      this.onBossSpawn(boss, 1);
    };
    const items: { label: string; run: (setLabel: (s: string) => void) => void }[] = [
      { label: '城兵級', run: () => spawnBoss('rook') },
      { label: '女王級', run: () => spawnBoss('queen') },
      { label: '黒騎士', run: () => spawnBoss('blackknight') },
      { label: '悪夢黒騎士', run: () => spawnBoss('redknight') },
      {
        label: '騎兵必殺',
        run: () => {
          used();
          for (const b of this.bosses) if (b.active && b.def.knight && b.bk.rush === 0 && !b.bk.rushCharge) this.startKnightRush(b, this.gameNow);
        },
      },
      {
        label: '連撃',
        run: () => {
          used();
          for (const b of this.bosses) {
            if (!b.active || !b.def.knight) continue;
            b.bk.forceCombo = true;
            b.bossState.chargeTimer = 0;
          }
        },
      },
      {
        label: '城兵の技',
        run: (set) => {
          used();
          // 押すたびに 砲撃 → 岩壁 → 突進 → 連続砲撃 の順で、次の技として予約する
          const order = ['cannon', 'wall', 'charge', 'barrage'];
          const names = ['砲撃', '岩壁', '突進', '連続砲撃'];
          const i = this.debugRookIndex++ % order.length;
          for (const b of this.bosses) {
            if (!b.active || b.def.bossKind !== 'rook') continue;
            b.bk.exForce = order[i];
            b.bossState.actTimer = 0;
          }
          set(`城:${names[i]}`);
        },
      },
      {
        label: '女王の技',
        run: (set) => {
          used();
          // 押すたびに 蔓の鞭 → 鱗粉 → 地中の触手 → 触手の突き → 茨の檻 の順で、次の技として予約する
          const order = ['whip', 'pollen', 'burrow', 'thrust', 'cage'];
          const names = ['蔓の鞭', '鱗粉', '地中の触手', '触手の突き', '茨の檻'];
          const i = this.debugQueenIndex++ % order.length;
          for (const b of this.bosses) {
            if (!b.active || b.def.bossKind !== 'queen') continue;
            b.bk.exForce = order[i];
            b.bossState.actTimer = 0;
          }
          set(`女:${names[i]}`);
        },
      },
      {
        label: '悪夢の技',
        run: (set) => {
          used();
          // 押すたびに 新月 → 半月 → 漆黒の牙 → 漆黒の檻 → 闇の炎 の順で、次の技として予約する
          const order = ['shingetsu', 'hangetsu', 'kiba', 'ori', 'honoo'];
          const names = ['新月', '半月', '漆黒の牙', '漆黒の檻', '闇の炎'];
          const i = this.debugExIndex % order.length;
          this.debugExIndex++;
          for (const b of this.bosses) {
            if (!b.active || b.def.id !== 'redknight') continue;
            b.bk.enraged = true;
            b.bk.exForce = order[i];
            b.bk.exTimer = 0;
          }
          set(`技:${names[i]}`);
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
      // キーは、ウィンドウで数えた「いま押されているか」を見る（選択画面の間に押したキーも、閉じた瞬間から効く）
      dx = (isHeld('KeyD', 'ArrowRight') ? 1 : 0) - (isHeld('KeyA', 'ArrowLeft') ? 1 : 0);
      dy = (isHeld('KeyS', 'ArrowDown') ? 1 : 0) - (isHeld('KeyW', 'ArrowUp') ? 1 : 0);
    }

    // ゲーム速度：倍率分だけ内部更新を分割し、1ステップの移動量を等速時と同程度に保つ
    const steps = Math.max(1, Math.ceil(this.speed));
    const dtStep = ((Math.min(deltaMs, 50) / 1000) * this.speed) / steps;
    if (this.hitStopMs > 0) {
      // ヒットストップ中は、戦場の時間を進めない（描画と演出は続く）
      this.hitStopMs -= deltaMs;
    } else {
      for (let i = 0; i < steps; i++) {
        if (this.over || this.haltFrame) break;
        this.simulate(dtStep, dx, dy);
      }
    }
    this.updateDamageNumbers(deltaMs / 1000);

    const now = this.gameNow;
    const p = this.player;
    const enemies = this.enemies.getChildren() as Enemy[];
    const soulActive = now < this.soulUntil;

    // 必殺の演出
    this.soulGfx.clear();
    if (now < this.rumbleUntil) {
      // 攻撃力アップ中：足元に炎色の輪
      const k = (this.rumbleUntil - now) / (CONFIG.rumble.buffSec * 1000);
      this.soulGfx.lineStyle(3, 0xff4500, 0.35 + Math.sin(now / 90) * 0.15);
      this.soulGfx.strokeCircle(p.x, p.y - 8, 34 + Math.sin(now / 140) * 3);
      this.soulGfx.lineStyle(2, 0xffb347, 0.5 * k);
      this.soulGfx.strokeCircle(p.x, p.y - 8, 44);
    }
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
      band: this.stage.rush ? this.rushLabel(now) : `${this.spawner.bandLabel}　${this.stage.nameEn}`,
      soul: this.soulGauge, soulActive,
      boss: (() => { const b = this.bosses.find((x) => x.active) ?? null; return b ? { name: this.bosses.filter((x) => x.active).length > 1 ? `${b.def.name} ×${this.bosses.filter((x) => x.active).length}` : b.def.name, hp: b.hp, maxHp: b.maxHp } : null; })(),
      score: this.stage.scoreMode ? { score: Math.round(this.score), combo: this.comboMul } : null,
      // スコアアタック：時間切れが近づいたら残り時間を出す
      remainSec: this.stage.scoreMode && !this.stage.endless && SCORE.timeLimitSec - this.elapsed <= SCORE.countdownFromSec ? Math.max(0, SCORE.timeLimitSec - this.elapsed) : null,
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
    } else if (this.fixedArrow || this.bosses.some((b) => b.active && b.def.fixed)) {
      // 動かないボスは、画面の外にいるとき方向を矢印で示す（どのキャラでも）
      this.arrowTargets.length = 0;
      for (const b of this.bosses) if (b.active && b.def.fixed) this.arrowTargets.push({ x: b.x, y: b.y - 60, color: b.def.eyeColor });
      this.hud.drawArrows(this.arrowTargets);
      this.fixedArrow = this.arrowTargets.length > 0;
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
    // 固有パッシブ『情報統制システム』（空夜）：共鳴アーツの発動間隔 −5%（2026-10-01）
    ctx.artIntervalMul = (soulActive ? CONFIG.soul.artIntervalMul : 1) * (def.uniquePassive.id === 'info_control' ? CONFIG.infoControlIntervalMul : 1);
    ctx.bonusDamageMul = (now < this.kanpaUntil ? 1.3 : 1) * (now < this.rumbleUntil ? CONFIG.rumble.buffMul : 1);
    const stats = this.up.stats;
    const p = this.player;

    p.move(dx, dy, dt, stats.speedMul * (this.inPollen ? CONFIG.queen.pollenSlowMul : 1), now);
    if (this.pkx !== 0 || this.pky !== 0) {
      // 吹き飛び（城兵級の踏み鳴らし）：すぐ弱まる
      p.x += this.pkx * dt;
      p.y += this.pky * dt;
      const f = Math.exp(-8 * dt);
      this.pkx *= f;
      this.pky *= f;
      if (Math.abs(this.pkx) + Math.abs(this.pky) < 6) this.pkx = this.pky = 0;
    }
    if (this.walls.length) this.pushOutOfWalls(p, 12);
    if (this.cage) this.pushOutOfCage();

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
    if (this.stage.ramp) this.enemySpeedMul = this.stage.enemySpeedMul * Math.min(this.stage.ramp.speedMax ?? Infinity, 1 + this.stage.ramp.speedPerMin * (this.elapsed / 60)) * (this.fullMoon ? CONFIG.fullMoon.enemySpeedMul : 1);
    // エンドレス：1周するたびに、敵の攻撃力が上がる
    if (this.stage.endless && this.spawner.cycle !== this.cycleShown) {
      this.cycleShown = this.spawner.cycle;
      this.cycleDamageMul = 1 + ENDLESS.cycleDamageAdd * this.cycleShown;
      if (this.cycleShown > 0) {
        this.hud.banner(`— ${this.cycleShown + 1}周目 —`, '#7CFFB2', 40);
        screenFlash(this, 300, 124, 255, 178);
      }
    }
    if (this.stage.scoreMode) {
      this.noDamageSec += dt;
      if (now > this.comboUntil && this.combo > 0) { this.combo = 0; this.comboMul = 1; }
      // エンドレスには、時間切れが無い
      if (!this.stage.endless && this.elapsed >= SCORE.timeLimitSec && !this.timeUp) { this.timeUp = true; }
      // 残り1分の知らせ（1回だけ）
      if (!this.stage.endless && !this.lastMinuteShown && SCORE.timeLimitSec - this.elapsed <= 60) {
        this.lastMinuteShown = true;
        this.hud.banner('残り 1:00', '#FF4D6D', 36);
      }
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

    // ボスラッシュ：ボスの組を順に出す。前の組を倒して報酬を受け取り、少し間を置いてから次
    if (this.stage.rush && !this.overlayActive() && this.rush.rewards.length === 0 && this.bosses.every((b) => !b.active)) {
      if (this.rush.nextAt === 0) this.rush.nextAt = now + RUSH.firstDelaySec * 1000;
      if (now >= this.rush.nextAt) this.spawnRushWave();
    }

    // 経験値・アイテム
    if (this.xp.update(dt, now, p.x, p.y - 12, p.def.pickup * stats.pickupMul) > 0) AudioBus.play('se_gem', 90);
    if (!this.overlayActive()) {
      if (this.rush.rewards.length > 0) {
        this.openRushReward(this.rush.rewards.shift()!);
      } else if (this.xp.pendingLevelUps > 0) {
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
    this.updateHazards(now);
    if (this.walls.length) this.updateWalls(now);
    this.updatePollens(dt, now);
    this.updateCage(now);

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) continue;
      const def = e.def;

      // 図鑑：初めて画面に入った敵を登録する（デバッグ操作をしたプレイは登録しない）
      if (!this.seenEnemies.has(def.id) && !def.isObject) {
        const v = this.cameras.main.worldView;
        if (e.x > v.left && e.x < v.right && e.y > v.top && e.y < v.bottom) {
          this.seenEnemies.add(def.id);
          if (!this.debugUsed) recordEnemySeen(def.id);
        }
      }

      // 被弾フラッシュ解除
      if (e.flashUntil && now > e.flashUntil) {
        e.flashUntil = 0;
        if (now < e.frozenUntil) e.setTint(0x9fdcff);
        else e.clearTint();
      }
      // 氷漬けが解ける：氷が砕ける
      if (e.frozenUntil && now >= e.frozenUntil) {
        e.frozenUntil = 0;
        if (!e.flashUntil) e.clearTint();
        this.hitSpark(e.x, e.y - 10, 0xbfefff, 4);
      }
      if (def.isObject) continue;

      // 女王級の蕾：ふくらんで、時間が来たら孵る
      if (def.bud) {
        e.shootTimer -= dt;
        const k = 1 - Math.max(0, e.shootTimer) / CONFIG.queen.budHatchSec;
        e.setScale(CONFIG.spriteScale * (1 + k * 0.4 + Math.sin(now / 60) * 0.05 * k));
        if (e.shootTimer <= 0) { this.hatchBud(e); continue; }
      } else if (!def.boss && e.poseT > 0) e.tickPose(dt);

      // 炎上（0.25秒ごとに刻む）
      if (now < e.burnUntil) {
        e.burnTick += dt;
        if (e.burnTick >= 0.25) {
          e.burnTick -= 0.25;
          this.hitSpark(e.x, e.y - 10, 0xff8c00, 2);
          this.specialDamage = now < e.burnSpecialUntil;
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
        const chill = e.chillFactor(now);
        e.x += e.charge.vx * chill * dt;
        e.y += e.charge.vy * chill * dt;
        e.setFlipX(e.charge.vx < 0);
        const v = this.cameras.main.worldView;
        if (e.x < v.left - 200 || e.x > v.right + 200 || e.y < v.top - 200 || e.y > v.bottom + 200) { e.despawn(); continue; }
        if (dist < e.radius + p.def.hitRadius) this.hurt(def.contactDamage, now, true);
        continue;
      }

      // 移動
      let mx = nx;
      let my = ny;
      let spd = def.speed * this.enemySpeedMul * e.speedMul(now);
      // 『氷狼牙』の減速は、ボスの歩く速さだけに掛ける（突進・攻撃は遅くしない。予兆と届く距離がずれるため）
      const walking = e.bossState.dashing <= 0;
      if (def.knight) {
        const r = this.updateBlackKnight(e, dt, now, dist, nx, ny);
        mx = r.mx;
        my = r.my;
        spd = walking ? r.spd * e.chillFactor(now) : r.spd;
      } else if (def.bossKind === 'rook') {
        spd = this.updateRook(e, dt, now, dist, nx, ny);
        if (walking) spd *= e.chillFactor(now);
        mx = e.bossState.dashing > 0 ? e.bossState.dirX : nx;
        my = e.bossState.dashing > 0 ? e.bossState.dirY : ny;
      } else if (def.bossKind === 'queen') {
        this.updateQueen(e, dt, now, dist, nx, ny);
        spd = 0;
      } else if (def.boss) {
        spd = this.updateBoss(e, dt, now, dist, nx, ny);
        if (walking) spd *= e.chillFactor(now);
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
          e.pose('cast', 0.4);
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

      // 岩壁は、敵も通れない（壁を作る城兵級と、動かないものは除く）
      if (this.walls.length && !def.boss && def.speed > 0) this.pushOutOfWalls(e, Math.min(e.radius, 26) * 0.6, 12);

      // 接触ダメージ（蕾と、姿を現している途中の女王級には無い）
      if (def.contactDamage > 0 && dist < e.radius + p.def.hitRadius && e.bossState.act !== 'emerge') this.hurt(def.contactDamage, now, true);
    }
  }

  /** 黒騎士（STAGE 3）：前半は騎兵突撃と剣閃、50%で形態変化、後半は突進の直後に追撃（ばらまき／右→左の二連斬） */
  private updateBlackKnight(e: Enemy, dt: number, now: number, dist: number, nx: number, ny: number): { mx: number; my: number; spd: number } {
    const b = e.bk;
    const p = this.player;
    // 赤騎士：行動の間隔が短く、突進が速い。光の色は赤
    const red = e.def.id === 'redknight';
    const tempo = (red ? CONFIG.redKnight.tempoMul : 1) / this.bossIdleMul();
    const glow = red ? 0xff2244 : 0x9d4dff;
    // 赤騎士の激昂（50%を切った瞬間）：短い無敵のあと、専用の技を使い始める
    if (red && !b.enraged && e.hp <= e.maxHp * CONFIG.redKnight.enrageAt) {
      b.enraged = true;
      b.invulnUntil = now + CONFIG.redKnight.enrageInvulnSec * 1000;
      b.animLock = b.invulnUntil;
      b.exTimer = 2;
      e.play(`anim_e_${e.def.id}_hit`, true);
      this.cameras.main.shake(400, 0.007);
      this.hud.banner(`${e.def.name} —— 激昂`, '#FF4D6D', 34);
      this.fxRing(e.x, e.y - 60, 240, glow, 10);
    }
    // 形態変化（50%を切った瞬間）：1.5秒無敵＋黒いオーラ＋揺れ
    if (b.phase === 1 && e.hp <= e.maxHp * 0.5) {
      b.phase = 2;
      b.invulnUntil = now + 1500;
      b.animLock = now + 1500;
      e.play(`anim_e_${e.def.id}_hit`, true);
      this.cameras.main.shake(400, 0.006);
      this.hud.banner(`${e.def.name} —— 形態変化`, '#9D4DFF', 34);
      this.resumeBgm();
      this.fxRing(e.x, e.y - 60, 220, glow, 10);
    }
    // オーラ（形態変化後は常時）＋予告線
    const g = this.bossGfx;
    if (b.phase === 2) {
      const k = 0.35 + Math.sin(now / 110) * 0.12;
      g.fillStyle(red ? 0x3a0a10 : 0x2a0a3a, k);
      g.fillCircle(e.x, e.y - 50, 120 + Math.sin(now / 90) * 8);
      g.lineStyle(3, glow, 0.5);
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
    // 赤騎士の専用技（新月／漆黒の牙／漆黒の檻）の最中は、他の行動をしない
    if (b.ex) return this.updateKnightEx(e, dt, now);

    // 突進（両形態）：予備動作0.8秒（赤い矢印で予告）→ 0.7秒ダッシュ
    const bs = e.bossState;
    const B = CONFIG.boss;
    if (bs.dashing > 0) {
      bs.dashing -= dt;
      if (bs.dashing <= 0) {
        bs.chargeTimer = (b.phase === 1 ? 7 : 6) / tempo;
        if (b.phase === 2 || b.forceCombo) this.startKnightFollow(e, now);
      }
      return { mx: bs.dirX, my: bs.dirY, spd: B.chargeSpeed * 1.1 * tempo };
    }
    // 後半：突進の直後の追撃中は他の行動をしない
    if (b.follow) return this.updateKnightFollow(e, dt, now);
    if (bs.windup > 0) {
      bs.windup -= dt;
      e.x += (Math.random() - 0.5) * 6;
      g.lineStyle(6, 0xff2244, 0.35 + (0.8 - bs.windup) * 0.6);
      g.lineBetween(e.x, e.y - 40, e.x + nx * 520, e.y - 40 + ny * 520);
      if (bs.windup <= 0) {
        bs.dashing = B.chargeDurationSec / tempo; // 速くても届く距離は同じ
        bs.dirX = nx;
        bs.dirY = ny;
        e.play(`anim_e_${e.def.id}`, true);
        this.cameras.main.shake(120, 0.005);
      }
      return { mx: 0, my: 0, spd: 0 };
    }
    // 赤騎士の専用技（激昂後）：一定の間隔で1つ選んで使う
    if (red && b.enraged && b.slashWindup <= 0 && b.rush === 0 && !b.rushCharge) {
      b.exTimer -= dt;
      if (b.exTimer <= 0) {
        this.startKnightEx(e, now);
        return { mx: 0, my: 0, spd: 0 };
      }
    }
    bs.chargeTimer -= dt;
    if (bs.chargeTimer <= 0 && b.slashWindup <= 0 && b.rush === 0 && !b.rushCharge) {
      bs.windup = B.chargeWindupSec;
      e.play(`anim_e_${e.def.id}_windup`, true);
      b.animLock = now + 800;
      this.fxText(e.x, e.y - 150, '!!', '#FF4D6D');
      AudioBus.play('se_knight_charge', 300);
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
          e.play(`anim_e_${e.def.id}_summon`, true);
          b.animLock = now + 700;
        } else {
          b.rushCharge = false;
          bs.windup = B.chargeWindupSec;
          e.play(`anim_e_${e.def.id}_windup`, true);
          b.animLock = now + 800;
          this.fxText(e.x, e.y - 150, '!!', '#FF4D6D');
          AudioBus.play('se_knight_charge', 300);
        }
      }
      return { mx: 0, my: 0, spd: 0 };
    }

    // 騎兵突撃（前半 6秒ごと／後半 4秒ごと）：3〜5体が画面を一直線に突っ切る。1秒前に赤線で予告
    b.cavalryTimer -= dt;
    if (b.cavalryTimer <= 0) {
      b.cavalryTimer = (b.phase === 1 ? 6 : 4) / tempo;
      if ((this.stage.scoreMode || red) && now >= b.rushCdUntil && b.slashWindup <= 0 && Math.random() < CONFIG.blackKnight.rushChance) {
        this.startKnightRush(e, now);
        return { mx: 0, my: 0, spd: 0 };
      }
      this.queueCavalry(now, Math.random() < 0.5, Math.random() < 0.5, Phaser.Math.Between(3, 5));
      e.play(`anim_e_${e.def.id}_summon`, true);
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
      this.knightSlashSe(e, b.slashWindup, nx >= 0);
      if (b.slashWindup <= 0) {
        b.slashSePlayed = false;
        e.play(`anim_e_${e.def.id}_slash`, true);
        b.animLock = now + 400;
        if (dist < 180 + p.def.hitRadius && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - 12 - (e.y - 40), p.x - e.x) - a)) <= Phaser.Math.DegToRad(75)) this.hurt(25, now);
        this.fxSlash(e.x, e.y - 40, 180, glow, a, 150, false);
        this.cameras.main.shake(100, 0.004);
      }
      return { mx: 0, my: 0, spd: 0 };
    }
    if (dist < 200 && b.slashCd <= 0) {
      b.slashWindup = 0.7;
      b.slashCd = 2.5 / tempo;
      e.play(`anim_e_${e.def.id}_windup`, true);
      b.animLock = now + 700;
      return { mx: 0, my: 0, spd: 0 };
    }

    if (now > b.animLock && e.anims.currentAnim?.key !== `anim_e_${e.def.id}`) e.play(`anim_e_${e.def.id}`, true);
    // 後半は少し速く詰める（弾幕は突進直後の追撃に移した）
    return { mx: nx, my: ny, spd: e.def.speed * (b.phase === 2 ? CONFIG.blackKnight.phase2SpeedMul : 1) };
  }

  /**
   * 黒騎士の斬撃音。当たる瞬間より少し前（slashSeLeadSec）に鳴らし始めて、音の山を斬撃に合わせる。
   * 右へ振るときは heavy、左へ振るときは heavy2。1回の斬撃につき1度だけ鳴らす。
   */
  private knightSlashSe(e: Enemy, remainingSec: number, toRight: boolean): void {
    const b = e.bk;
    if (b.slashSePlayed || remainingSec > CONFIG.blackKnight.slashSeLeadSec) return;
    b.slashSePlayed = true;
    AudioBus.play(toRight ? 'se_slash_heavy' : 'se_slash_heavy2', 0, 'se_slash');
  }

  /** 騎兵の一斉突撃を予約：n体が横（または縦）一直線に画面を突っ切る。1秒前から赤線で予告 */
  private queueCavalry(now: number, horizontal: boolean, fromLeft: boolean, n: number, leadMs = 1000): void {
    const v = this.cameras.main.worldView;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const jitter = (Math.random() - 0.5) * 60;
      if (horizontal) {
        const y = v.top + 120 + t * (v.height - 240) + jitter;
        this.cavalryWarnings.push({ at: now + leadMs + i * 120, x1: fromLeft ? v.left - 150 : v.right + 150, y1: y, x2: fromLeft ? v.right + 150 : v.left - 150, y2: y });
      } else {
        const x = v.left + 80 + t * (v.width - 160) + jitter;
        this.cavalryWarnings.push({ at: now + leadMs + i * 120, x1: x, y1: fromLeft ? v.top - 150 : v.bottom + 150, x2: x, y2: fromLeft ? v.bottom + 150 : v.top - 150 });
      }
    }
  }

  /** 赤騎士の専用技を1つ選んで始める（重み付きの乱数。直前と同じ技は選ばない） */
  private startKnightEx(e: Enemy, now: number): void {
    const b = e.bk;
    const R = CONFIG.redKnight;
    const p = this.player;
    b.exTimer = R.exEverySec;
    let pick = b.exForce;
    b.exForce = '';
    if (!pick) {
      const options = Object.entries(R.exWeights).filter(([id]) => id !== b.lastEx);
      let total = 0;
      for (const [, w] of options) total += w;
      let r = Math.random() * total;
      pick = options[0][0];
      for (const [id, w] of options) {
        r -= w;
        if (r <= 0) { pick = id; break; }
      }
    }
    b.lastEx = pick;
    b.exStage = 0;
    const names: Record<string, string> = { shingetsu: '新月', hangetsu: '半月', kiba: '漆黒の牙', ori: '漆黒の檻', honoo: '闇の炎' };
    this.hud.banner(`『${names[pick]}』`, '#FF4D6D', 34);
    // 技ごとの音（発動の瞬間＝予兆の始まり。未配置なら無音）
    const exSe: Record<string, string> = { shingetsu: 'se_redknight_moon', hangetsu: 'se_redknight_moon', kiba: 'se_redknight_fang', honoo: 'se_redknight_flame' };
    if (exSe[pick]) AudioBus.play(exSe[pick], 0);
    e.play(`anim_e_${e.def.id}_windup`, true);
    b.ex = pick;
    if (pick === 'honoo') {
      // 1本目の向きは、技を始めた瞬間のプレイヤーの位置で固定する
      b.exT = R.flameWindupSec;
      b.exAngle = Math.atan2(p.y - 12 - (e.y - 40), p.x - e.x);
      b.animLock = now + R.flameWindupSec * 1000;
    } else if (pick === 'hangetsu') {
      // 軸は、技を始めた瞬間のプレイヤーの位置で固定する
      b.exT = R.halfMoonWindupSec;
      b.exX = p.x;
      b.animLock = now + R.halfMoonWindupSec * 1000;
    } else if (pick === 'shingetsu') {
      b.exT = R.moonWindupSec;
      b.animLock = now + R.moonWindupSec * 1000;
    } else if (pick === 'kiba') {
      b.exT = R.fangWindupSec;
      b.exX = p.x;
      b.exY = p.y - 12;
      b.animLock = now + R.fangWindupSec * 1000;
    } else {
      b.exT = 0;
    }
  }

  /** 赤騎士の専用技の進行。『新月』：外側 → 内側／『半月』：左の全面 → 右の全面／『漆黒の牙』：飛び込み／『闇の炎』：3方向の直線／『漆黒の檻』：騎兵の格子 */
  private updateKnightEx(e: Enemy, dt: number, now: number): { mx: number; my: number; spd: number } {
    const b = e.bk;
    const R = CONFIG.redKnight;
    const g = this.bossGfx;
    const p = this.player;
    const cx = e.x;
    const cy = e.y - 40;
    const still = { mx: 0, my: 0, spd: 0 };
    const finish = () => {
      b.ex = '';
      e.bossState.chargeTimer = Math.max(e.bossState.chargeTimer, 1.5);
    };
    b.exT -= dt;

    if (b.ex === 'shingetsu') {
      const pd = Math.hypot(p.x - cx, p.y - 12 - cy);
      if (b.exStage === 0) {
        // 一段目：赤騎士の周りの円（新月）の中だけが安全
        const k = 1 - Math.max(0, b.exT) / R.moonWindupSec;
        g.lineStyle(R.moonOuterRadius - R.moonSafeRadius, 0xff2244, 0.1 + k * 0.2);
        g.strokeCircle(cx, cy, (R.moonOuterRadius + R.moonSafeRadius) / 2);
        g.fillStyle(0x05020a, 0.45);
        g.fillCircle(cx, cy, R.moonSafeRadius);
        g.lineStyle(4, 0xffffff, 0.5 + k * 0.4);
        g.strokeCircle(cx, cy, R.moonSafeRadius);
        if (b.exT <= 0) {
          if (pd > R.moonSafeRadius) this.hurt(R.moonDamage, now);
          const flash = this.add.graphics().setDepth(26);
          flash.lineStyle(R.moonOuterRadius - R.moonSafeRadius, 0xff2244, 0.35);
          flash.strokeCircle(cx, cy, (R.moonOuterRadius + R.moonSafeRadius) / 2);
          this.fadeOut(flash, 260);
          this.cameras.main.shake(160, 0.006);
          AudioBus.play('se_slash_heavy', 0, 'se_slash');
          e.play(`anim_e_${e.def.id}_slash`, true);
          b.exStage = 1;
          b.exT = R.moonInnerWindupSec;
          b.animLock = now + R.moonInnerWindupSec * 1000;
        }
        return still;
      }
      // 二段目：足元の円の中が危険
      const k = 1 - Math.max(0, b.exT) / R.moonInnerWindupSec;
      g.fillStyle(0xff2244, 0.14 + k * 0.26);
      g.fillCircle(cx, cy, R.moonInnerRadius);
      g.lineStyle(3, 0xff2244, 0.85);
      g.strokeCircle(cx, cy, R.moonInnerRadius);
      if (b.exT <= 0) {
        if (pd < R.moonInnerRadius) this.hurt(R.moonDamage, now);
        this.fxRing(cx, cy, R.moonInnerRadius, 0xff2244, 10);
        this.cameras.main.shake(160, 0.006);
        AudioBus.play('se_slash_heavy2', 0, 'se_slash');
        e.play(`anim_e_${e.def.id}_slash`, true);
        b.animLock = now + 400;
        finish();
      }
      return still;
    }

    if (b.ex === 'hangetsu') {
      // 軸（縦の線）から左の全面 → 右の全面。画面の外まで届く
      const left = b.exStage === 0;
      const total = left ? R.halfMoonWindupSec : R.halfMoonSecondWindupSec;
      const k = 1 - Math.max(0, b.exT) / total;
      const v = this.cameras.main.worldView;
      const x0 = left ? v.left - 300 : b.exX;
      const w = left ? b.exX - (v.left - 300) : v.right + 300 - b.exX;
      const draw = (gfx: Phaser.GameObjects.Graphics, alpha: number) => {
        gfx.fillStyle(0xff2244, alpha);
        gfx.fillRect(x0, v.top - 300, w, v.height + 600);
      };
      if (b.exT > 0) {
        draw(g, 0.1 + k * 0.24);
        // 反対側は「次に来る」ことが分かるように、うっすら見せる（一段目のあいだだけ）
        if (left) {
          g.fillStyle(0xff2244, 0.05);
          g.fillRect(b.exX, v.top - 300, v.right + 300 - b.exX, v.height + 600);
        }
        g.lineStyle(4, 0xffffff, 0.85);
        g.lineBetween(b.exX, v.top - 300, b.exX, v.bottom + 300);
        return still;
      }
      const side = p.x - b.exX;
      if (left ? side < R.halfMoonMargin : side > -R.halfMoonMargin) this.hurt(R.halfMoonDamage, now);
      const flash = this.add.graphics().setDepth(26);
      draw(flash, 0.45);
      flash.lineStyle(5, 0xffffff, 0.9);
      flash.lineBetween(b.exX, v.top - 300, b.exX, v.bottom + 300);
      this.fadeOut(flash, 260);
      this.cameras.main.shake(160, 0.006);
      AudioBus.play(left ? 'se_slash_heavy2' : 'se_slash_heavy', 0, 'se_slash');
      e.play(`anim_e_${e.def.id}_slash`, true);
      if (left) {
        b.exStage = 1;
        b.exT = R.halfMoonSecondWindupSec;
        b.animLock = now + R.halfMoonSecondWindupSec * 1000;
      } else {
        b.animLock = now + 400;
        finish();
      }
      return still;
    }

    if (b.ex === 'kiba') {
      // 狙った地点に円の予兆。赤騎士は姿を薄くして、着地の瞬間にその地点へ現れる
      const k = 1 - Math.max(0, b.exT) / R.fangWindupSec;
      g.fillStyle(0xff2244, 0.16 + k * 0.3);
      g.fillCircle(b.exX, b.exY, R.fangRadius);
      g.lineStyle(3, 0xffffff, 0.8);
      g.strokeCircle(b.exX, b.exY, R.fangRadius);
      g.lineStyle(2, 0xff2244, 0.8);
      g.strokeCircle(b.exX, b.exY, R.fangRadius * (1 - k));
      e.setAlpha(1 - k * 0.8);
      if (b.exT <= 0) {
        e.setPosition(b.exX, b.exY + 40);
        e.setAlpha(1);
        if (Math.hypot(p.x - b.exX, p.y - 12 - b.exY) < R.fangRadius + p.def.hitRadius) this.hurt(R.fangDamage, now);
        for (let i = 0; i < R.fangBullets; i++) {
          this.fireEnemyBullet(b.exX, b.exY, (i / R.fangBullets) * Math.PI * 2, R.fangBulletSpeed, 4, R.fangBulletDamage, 0xff2244);
        }
        this.fxRing(b.exX, b.exY, R.fangRadius, 0xff2244, 10);
        this.cameras.main.shake(220, 0.008);
        AudioBus.play('se_slash_heavy', 0, 'se_slash');
        e.play(`anim_e_${e.def.id}_slash`, true);
        b.animLock = now + 400;
        finish();
      }
      return still;
    }

    if (b.ex === 'honoo') {
      // 赤騎士を中心に、3方向へ直線の予兆 → 一斉に走る → 通り道に炎が残る
      const k = 1 - Math.max(0, b.exT) / R.flameWindupSec;
      const spread = Phaser.Math.DegToRad(R.flameSpreadDeg);
      const lines: { x2: number; y2: number }[] = [];
      for (let i = 0; i < R.flameLines; i++) {
        const a = b.exAngle + i * spread;
        lines.push({ x2: cx + Math.cos(a) * R.flameLength, y2: cy + Math.sin(a) * R.flameLength });
      }
      if (b.exT > 0) {
        for (const l of lines) {
          g.lineStyle(R.flameHalfWidth * 2, 0xff2244, 0.12 + k * 0.24);
          g.lineBetween(cx, cy, l.x2, l.y2);
          g.lineStyle(3, 0xffffff, 0.75);
          g.lineBetween(cx, cy, l.x2, l.y2);
        }
        return still;
      }
      let hit = false;
      for (const l of lines) {
        if (this.distToSegment(p.x, p.y - 12, cx, cy, l.x2, l.y2) < R.flameHalfWidth + p.def.hitRadius) hit = true;
        this.hazards.push({ x1: cx, y1: cy, x2: l.x2, y2: l.y2, halfWidth: R.flameHalfWidth, until: now + R.flameSec * 1000, damage: R.flameDamage });
        const flash = this.add.graphics().setDepth(26);
        flash.lineStyle(R.flameHalfWidth * 2, 0xff2244, 0.6);
        flash.lineBetween(cx, cy, l.x2, l.y2);
        flash.lineStyle(6, 0xffffff, 0.9);
        flash.lineBetween(cx, cy, l.x2, l.y2);
        this.fadeOut(flash, 240);
      }
      if (hit) this.hurt(R.flameStrikeDamage, now);
      this.cameras.main.shake(180, 0.007);
      AudioBus.play('se_slash_heavy', 0, 'se_slash');
      e.play(`anim_e_${e.def.id}_slash`, true);
      b.animLock = now + 400;
      finish();
      return still;
    }

    // 『漆黒の檻』：騎兵が横と縦に同時に走る。波ごとに列の数を変えて、安全な場所をずらす
    if (b.exT <= 0) {
      const wave = R.cageWaves[b.exStage];
      this.queueCavalry(now, true, Math.random() < 0.5, wave[0], R.cageLeadSec * 1000);
      this.queueCavalry(now, false, Math.random() < 0.5, wave[1], R.cageLeadSec * 1000);
      e.play(`anim_e_${e.def.id}_summon`, true);
      b.animLock = now + 700;
      b.exStage++;
      if (b.exStage >= R.cageWaves.length) {
        b.cavalryTimer = Math.max(b.cavalryTimer, 4);
        finish();
      } else {
        b.exT = R.cageWaveGapSec;
      }
    }
    return still;
  }

  /** 地面に残る危険な帯（『闇の炎』）の描画と当たり判定 */
  private updateHazards(now: number): void {
    if (this.hazards.length === 0) return;
    const g = this.bossGfx;
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (now >= h.until) { this.hazards.splice(i, 1); continue; }
      const fade = Math.min(1, (h.until - now) / 500);
      const flick = 0.5 + Math.sin(now / 70 + i) * 0.12;
      if (h.circle) {
        // 燃えている円（城兵級の連続砲撃）
        g.fillStyle(0x3a1206, 0.5 * fade);
        g.fillCircle(h.x1, h.y1, h.halfWidth);
        g.fillStyle(0xff6a1a, flick * 0.45 * fade);
        g.fillCircle(h.x1, h.y1, h.halfWidth * 0.72);
        g.lineStyle(2, 0xff8844, 0.7 * fade);
        g.strokeCircle(h.x1, h.y1, h.halfWidth);
        if (Math.random() < 0.4) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * h.halfWidth;
          this.hitSpark(h.x1 + Math.cos(a) * d, h.y1 + Math.sin(a) * d - 8, 0xff8844, 1);
        }
        if (Math.hypot(p.x - h.x1, p.y - 12 - h.y1) < h.halfWidth) this.hurt(h.damage, now);
        continue;
      }
      g.lineStyle(h.halfWidth * 2, 0x2a0610, 0.55 * fade);
      g.lineBetween(h.x1, h.y1, h.x2, h.y2);
      g.lineStyle(h.halfWidth, 0xff2244, flick * 0.5 * fade);
      g.lineBetween(h.x1, h.y1, h.x2, h.y2);
      if (Math.random() < 0.5) {
        const t = Math.random();
        this.hitSpark(h.x1 + (h.x2 - h.x1) * t + (Math.random() - 0.5) * h.halfWidth, h.y1 + (h.y2 - h.y1) * t - 10, 0xff4422, 1);
      }
      // 当たり判定：足元の点と線分の距離
      const dx = h.x2 - h.x1;
      const dy = h.y2 - h.y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Phaser.Math.Clamp(((p.x - h.x1) * dx + (p.y - h.y1) * dy) / len2, 0, 1);
      if (Math.hypot(p.x - (h.x1 + dx * t), p.y - (h.y1 + dy * t)) < h.halfWidth) this.hurt(h.damage, now);
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
    this.hud.banner(`${e.def.name} —— 鉄騎、総突撃`, '#FF4D6D', 34);
    this.cameras.main.shake(250, 0.006);
    e.play(`anim_e_${e.def.id}_summon`, true);
    b.animLock = now + 700;
  }

  /** 黒騎士・後半：突進直後の追撃を選ぶ（ばらまき／二連斬／連射。直前と同じものは選ばない） */
  private startKnightFollow(e: Enemy, now: number): void {
    const b = e.bk;
    const K = CONFIG.blackKnight;
    const red = e.def.id === 'redknight';
    // 連撃（低確率）：すぐ斬撃 → 連射かばらまき
    if (b.forceCombo || Math.random() < (red ? CONFIG.redKnight.comboChance : K.comboChance)) {
      b.forceCombo = false;
      b.lastFollow = 'combo';
      b.follow = 'comboSlash';
      b.followT = K.comboSlashWindupSec;
      b.comboAngle = Math.atan2(this.player.y - 12 - (e.y - 40), this.player.x - e.x);
      this.fxText(e.x, e.y - 170, '連撃', '#FF4D6D');
      e.play(`anim_e_${e.def.id}_windup`, true);
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
      // 赤騎士は三連（右 → 左 → 右）
      b.cleaveLeft = red ? CONFIG.redKnight.cleaveSwings : 2;
      b.cleaveFirst = true;
      // 軸は突進直後のプレイヤー位置で固定（黒騎士 → プレイヤーの少し先）
      const ax = this.player.x - e.x;
      const ay = this.player.y - 12 - (e.y - 40);
      b.cleaveAngle = Math.atan2(ay, ax);
      b.cleaveLen = Phaser.Math.Clamp(Math.hypot(ax, ay) + K.cleaveBeyond, K.cleaveMinLen, K.cleaveMaxLen);
    }
    e.play(`anim_e_${e.def.id}_windup`, true);
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
    const red = e.def.id === 'redknight';
    const glow = red ? 0xff2244 : 0x9d4dff;
    const finish = () => {
      b.follow = '';
      e.bossState.chargeTimer = K.followChargeDelaySec / (red ? CONFIG.redKnight.tempoMul : 1);
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
        this.knightSlashSe(e, b.followT, Math.cos(b.comboAngle) >= 0);
        return still;
      }
      this.knightSlashSe(e, 0, Math.cos(b.comboAngle) >= 0);
      b.slashSePlayed = false;
      const rx = p.x - cx;
      const ry = p.y - 12 - cy;
      if (Math.hypot(rx, ry) < K.comboSlashRadius + p.def.hitRadius && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(ry, rx) - b.comboAngle)) <= half) this.hurt(K.comboSlashDamage, now);
      e.play(`anim_e_${e.def.id}_slash`, true);
      b.animLock = now + 300;
      this.fxSlash(cx, cy, K.comboSlashRadius, glow, b.comboAngle, K.comboSlashArcDeg, false);
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
        g.lineStyle(5, glow, 0.4 + k * 0.5);
        g.strokeCircle(cx, cy, 60 + k * 90);
        g.lineStyle(2, glow, 0.5);
        g.strokeCircle(cx, cy, 150);
        return still;
      }
      b.followTick -= dt;
      if (b.followTick <= 0) {
        b.followTick = K.scatterTickSec;
        for (let i = 0; i < K.scatterPerTick; i++) {
          this.fireEnemyBullet(cx, cy, Math.random() * Math.PI * 2, Phaser.Math.Between(K.scatterSpeedMin, K.scatterSpeedMax), 5, K.scatterDamage, glow);
        }
      }
      e.play(`anim_e_${e.def.id}_barrage`, true);
      b.animLock = now + 200;
      if (b.followT <= 0) finish();
      return still;
    }

    // 連射（従来のマシンガン）：予告線のあと、狙いを追いながら扇状3連を撃ち続ける
    if (b.follow === 'barrage') {
      const a = Math.atan2(p.y - 12 - cy, p.x - cx);
      if (b.followT > K.barrageBursts * K.barrageTickSec) {
        g.lineStyle(3, glow, 0.65);
        g.lineBetween(cx, cy, cx + Math.cos(a) * 700, cy + Math.sin(a) * 700);
        return still;
      }
      b.followTick -= dt;
      if (b.followTick <= 0) {
        b.followTick = K.barrageTickSec;
        for (const off of [-0.18, 0, 0.18]) {
          this.fireEnemyBullet(cx + Math.cos(a) * 40, cy, a + off + (Math.random() - 0.5) * 0.05, K.barrageSpeed, 5, K.barrageDamage, glow);
        }
      }
      e.play(`anim_e_${e.def.id}_barrage`, true);
      b.animLock = now + 200;
      if (b.followT <= 0) finish();
      return still;
    }

    // 二連斬：黒騎士を頂点にした三角形を、中心軸で右半分 → 左半分の順に斬る（左右は黒騎士から見た向き）
    const right = b.follow === 'cleaveR';
    const dx = Math.cos(b.cleaveAngle);
    const dy = Math.sin(b.cleaveAngle);
    // 進行方向に対して右手側の向き（画面は下が +y）
    const px = -dy;
    const py = dx;
    const L = b.cleaveLen;
    const side = right ? 1 : -1;
    const mx = cx + dx * L;
    const my = cy + dy * L;
    const bx = mx + px * K.cleaveHalfWidth * side;
    const by = my + py * K.cleaveHalfWidth * side;
    if (b.followT > 0) {
      const k = 1 - b.followT / (b.cleaveFirst ? K.cleaveWindupSec : K.cleaveSecondWindupSec);
      // 全体の輪郭（うっすら）＋これから斬る半分（赤）＋中心軸
      g.lineStyle(2, 0xff2244, 0.35);
      g.strokeTriangle(cx, cy, mx + px * K.cleaveHalfWidth, my + py * K.cleaveHalfWidth, mx - px * K.cleaveHalfWidth, my - py * K.cleaveHalfWidth);
      g.fillStyle(0xff2244, 0.16 + k * 0.26);
      g.fillTriangle(cx, cy, mx, my, bx, by);
      g.lineStyle(3, 0xffffff, 0.75);
      g.lineBetween(cx, cy, mx, my);
      this.knightSlashSe(e, b.followT, right);
      return still;
    }
    this.knightSlashSe(e, 0, right);
    b.slashSePlayed = false;
    // 当たり判定：軸に沿った距離（along）と、軸からの横ずれ（perp。右手側が＋）
    const rx = p.x - cx;
    const ry = p.y - 12 - cy;
    const along = rx * dx + ry * dy;
    const perp = (rx * px + ry * py) * side;
    const width = K.cleaveHalfWidth * Phaser.Math.Clamp(along / L, 0, 1);
    if (along > 0 && along < L && perp > -K.cleaveAxisMargin && perp < width + p.def.hitRadius) this.hurt(K.cleaveDamage, now);
    e.play(`anim_e_${e.def.id}_slash`, true);
    b.animLock = now + 400;
    // 斬った半分を紫の閃光で見せる
    const flash = this.add.graphics().setDepth(26);
    flash.fillStyle(glow, 0.55);
    flash.fillTriangle(cx, cy, mx, my, bx, by);
    flash.lineStyle(4, 0xffffff, 0.9);
    flash.lineBetween(cx, cy, bx, by);
    this.fadeOut(flash, 260);
    this.cameras.main.shake(100, 0.004);
    b.cleaveLeft--;
    b.cleaveFirst = false;
    if (b.cleaveLeft > 0) {
      b.follow = right ? 'cleaveL' : 'cleaveR';
      b.followT = K.cleaveSecondWindupSec;
    } else {
      finish();
    }
    return still;
  }

  private cavalryWarnings: { at: number; x1: number; y1: number; x2: number; y2: number }[] = [];
  private hazards: Hazard[] = [];

  // ─────────────────────────── 城兵級・女王級（追補パッチ⑪） ───────────────────────────

  /** 岩壁（城兵級）。線分＋半幅。敵もプレイヤーも通れない。攻撃は通る */
  private walls: { x1: number; y1: number; x2: number; y2: number; half: number; until: number; imgs: Phaser.GameObjects.Image[] }[] = [];
  /** 毒の粉（女王級の鱗粉）。from から効き始める */
  private pollens: { x: number; y: number; r: number; from: number; until: number }[] = [];
  /** 吹き飛ばされている速さ（城兵級の踏み鳴らし） */
  private pkx = 0;
  private pky = 0;
  /** 毒の粉の中にいる（足が遅くなる） */
  private inPollen = false;
  private pollenTick = 0;
  /** 動かないボスの方向の矢印を出している */
  private fixedArrow = false;
  /** エンドレス：字幕を出し終えた周（0から）と、その周の敵の攻撃力の倍率 */
  private cycleShown = 0;
  private cycleDamageMul = 1;
  /** 連続砲撃：砲弾の絵を出し終えた着弾点 */
  private shellsShown = new WeakSet<object>();


  /** 茨の檻（女王級）。from から通れなくなり、until に輪の中が突き上がる */
  private cage: { x: number; y: number; gap: number; shown: number; from: number; until: number } | null = null;

  /** 角度 a が、檻の開いている所に入っているか */
  private inCageGap(a: number): boolean {
    const c = this.cage;
    if (!c) return true;
    return Math.abs(Phaser.Math.Angle.Wrap(a - c.gap)) < CONFIG.queen.cageGapHalfRad;
  }

  /** 茨の檻：描画・通れない輪・突き上げ */
  private updateCage(now: number): void {
    const c = this.cage;
    if (!c) return;
    const Q = CONFIG.queen;
    const g = this.bossGfx;
    const p = this.player;
    const R = Q.cageRadius;
    const a0 = c.gap + Q.cageGapHalfRad;
    const a1 = c.gap - Q.cageGapHalfRad + Math.PI * 2;
    const arc = (r: number) => {
      g.beginPath();
      g.arc(c.x, c.y, r, a0, a1, false);
      g.strokePath();
    };
    if (now < c.from) {
      // 予告：輪の位置と、開いている所
      const k = 1 - (c.from - now) / (Q.cageWindupSec * 1000);
      g.lineStyle(Q.cageHalfWidth * 2, 0xff2244, 0.14 + k * 0.22);
      arc(R);
      g.lineStyle(2, 0xff2244, 0.85);
      arc(R);
    } else {
      // 茨の輪（通れない）と、輪の中の予告
      const k = Phaser.Math.Clamp((now - c.from) / (c.until - c.from), 0, 1);
      g.fillStyle(0xff2244, 0.08 + k * 0.24);
      g.fillCircle(c.x, c.y, R - Q.cageHalfWidth);
      g.lineStyle(3, 0xff2244, 0.4 + k * 0.5);
      g.strokeCircle(c.x, c.y, (R - Q.cageHalfWidth) * k);
      g.lineStyle(Q.cageHalfWidth * 2, 0x0a0612, 1);
      arc(R);
      g.lineStyle(3, 0x6a3a9a, 1);
      arc(R + Q.cageHalfWidth - 2);
      arc(R - Q.cageHalfWidth + 2);
      // 棘（輪の上に、上向きに生える）
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + now / 2400;
        if (this.inCageGap(a)) continue;
        const bx = c.x + Math.cos(a) * R;
        const by = c.y + Math.sin(a) * R + 6;
        g.fillStyle(0x0a0612, 1);
        g.fillTriangle(bx - 9, by, bx + 9, by, bx, by - 40);
        g.lineStyle(2, 0x9d4dff, 0.9);
        g.strokeTriangle(bx - 9, by, bx + 9, by, bx, by - 40);
      }
    }
    // 出口の目印（金色）
    const blink = 0.6 + Math.sin(now / 110) * 0.3;
    g.lineStyle(6, 0xffc83d, blink);
    g.beginPath();
    g.arc(c.x, c.y, R, c.gap - Q.cageGapHalfRad, c.gap + Q.cageGapHalfRad, false);
    g.strokePath();
    // 外向きの矢印を2つ
    g.fillStyle(0xffc83d, blink);
    for (const d of [R - 46, R + 8]) {
      const tipX = c.x + Math.cos(c.gap) * (d + 30);
      const tipY = c.y + Math.sin(c.gap) * (d + 30);
      const bx = c.x + Math.cos(c.gap) * d;
      const by = c.y + Math.sin(c.gap) * d;
      const sx = -Math.sin(c.gap) * 20;
      const sy = Math.cos(c.gap) * 20;
      g.fillTriangle(tipX, tipY, bx + sx, by + sy, bx - sx, by - sy);
    }

    if (now < c.until) return;
    // 突き上げ
    this.cage = null;
    AudioBus.play('se_queen_burrow', 80, 'se_slash_heavy');
    this.cameras.main.shake(220, 0.009);
    this.fxRing(c.x, c.y, R, 0x9d4dff, 8);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random();
      const d = i === 0 ? 0 : 50 + Math.random() * (R - 80);
      this.thornSpikes(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
    }
    if (Math.hypot(p.x - c.x, p.y - 12 - c.y) < R - Q.cageHalfWidth) this.hurt(Q.cageDamage, now);
  }

  /** 檻の輪にめり込んだプレイヤーを、来た側へ押し戻す（開いている所は通れる） */
  private pushOutOfCage(): void {
    const c = this.cage;
    if (!c || this.gameNow < c.from) return;
    const Q = CONFIG.queen;
    const p = this.player;
    const dx = p.x - c.x;
    const dy = p.y - 12 - c.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const min = Q.cageHalfWidth + 12;
    if (Math.abs(d - Q.cageRadius) >= min) return;
    if (this.inCageGap(Math.atan2(dy, dx))) return;
    const to = d < Q.cageRadius ? Q.cageRadius - min : Q.cageRadius + min;
    p.x = c.x + (dx / d) * to;
    p.y = c.y + 12 + (dy / d) * to;
  }

  /** 地面から突き出る触手（3本の黒い棘） */
  private thornSpikes(x: number, y: number): void {
    const sp = this.add.graphics({ x, y }).setDepth(26);
    for (const [ox, h] of [[-22, 70], [0, 100], [22, 64]] as const) {
      sp.fillStyle(0x0a0612, 1);
      sp.fillTriangle(ox - 12, 8, ox + 12, 8, ox * 1.3, -h);
      sp.lineStyle(2, 0x6a3a9a, 1);
      sp.strokeTriangle(ox - 12, 8, ox + 12, 8, ox * 1.3, -h);
    }
    sp.setScale(1, 0.1);
    this.tweens.add({ targets: sp, scaleY: 1, duration: 90, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sp, alpha: 0, delay: 260, duration: 220, onComplete: () => sp.destroy() });
  }

  /** 岩壁を1枚砕く（城兵級の突進）。破片が弾になって四方へ飛ぶ */
  private breakWall(i: number): void {
    const R = CONFIG.rook;
    const w = this.walls[i];
    const cx = (w.x1 + w.x2) / 2;
    const cy = (w.y1 + w.y2) / 2;
    const spin = Math.random() * Math.PI * 2;
    for (let k = 0; k < R.shardCount; k++) this.fireEnemyBullet(cx, cy - 10, spin + (k / R.shardCount) * Math.PI * 2, R.shardSpeed, R.shardLifeSec, R.shardDamage, 0x40e0ff);
    this.fxRing(cx, cy, 90, 0x40e0ff, 6);
    AudioBus.play('se_rook_wall_break', 120, 'se_break');
    this.cameras.main.shake(140, 0.007);
    w.until = 0;
    this.updateWalls(this.gameNow);
  }

  // ─────────────────────────── ボスラッシュ ───────────────────────────

  /** ボスの行動の間隔の倍率（ボスラッシュは周が進むと短い。それ以外は1） */
  private bossIdleMul(): number {
    return this.stage.rush ? rushTempo(this.rush.loop) : 1;
  }

  /** いまの周の、次のボスの組を出す（全部、最初から後半の行動） */
  private spawnRushWave(): void {
    const waves = rushWaves(this.rush.loop);
    if (this.rush.wave === 0) this.rush.loopStartSec = this.elapsed;
    const ids = waves[this.rush.wave];
    ids.forEach((id, i) => {
      const boss = this.spawner.spawnRushBoss(id);
      if (!boss) return;
      this.spawner.bossActive = true;
      this.onBossSpawn(boss, RUSH.hpMul[id] ?? 1, i, ids.length, true);
    });
    this.rush.nextAt = Infinity;
  }

  /** ボスラッシュ：ボスを倒した。報酬を積み、組を全部倒したら次へ。周の最後なら周クリア */
  private onRushBossDefeated(e: Enemy): void {
    this.rush.bossesDefeated++;
    this.rush.bossTimes.push({ name: e.def.name, sec: this.elapsed, loop: this.rush.loop });
    const reward = RUSH.reward[e.def.id];
    if (reward) this.rush.rewards.push(reward);
    if (!this.bosses.every((b) => !b.active)) return;
    const waves = rushWaves(this.rush.loop);
    this.rush.wave++;
    if (this.rush.wave >= waves.length) {
      const t = this.elapsed - this.rush.loopStartSec;
      this.rush.loopTimes.push(t);
      this.hud.banner(`${this.rush.loop}周目 クリア　${fmtTime(t)}`, '#FFD700', 36);
      this.rush.loop++;
      this.rush.wave = 0;
      // 4周目から、敵の攻撃力が周ごとに上がる
      this.cycleDamageMul = rushDamageMul(this.rush.loop);
    }
    this.rush.nextAt = this.gameNow + RUSH.gapSec * 1000;
  }

  /** HUD の時間帯の欄：周と、次のボスまでの秒数 */
  private rushLabel(now: number): string {
    const alive = this.bosses.filter((b) => b.active);
    if (alive.length > 0) return `${this.rush.loop}周目　${alive.map((b) => b.def.name).join('・')}`;
    const left = this.rush.nextAt === Infinity || this.rush.nextAt === 0 ? 0 : Math.max(0, Math.ceil((this.rush.nextAt - now) / 1000));
    return `${this.rush.loop}周目　次のボスまで ${left}秒`;
  }

  /** ボスラッシュの報酬：サポート（3択）／共鳴アーツ（3択・Lv8）／宝箱 */
  private openRushReward(kind: 'support' | 'art' | 'chest'): void {
    if (kind === 'chest') {
      this.openChest();
      return;
    }
    const pool = this.up.buildChoices(40).filter((c) => (kind === 'support' ? c.kind === 'passive' : c.kind === 'weapon' && c.tag === 'NEW'));
    const choices = pool.slice(0, 3);
    if (choices.length === 0) {
      // 選べるものが無い（枠が埋まっているなど）：代わりに宝箱
      this.openChest();
      return;
    }
    const data: LevelUpData = {
      level: this.xp.level,
      choices,
      onPick: (c: Choice) => {
        const r = this.up.apply(c);
        // 共鳴アーツは Lv8 で加わる
        if (r.newWeapon) while (!r.newWeapon.isMaxLevel) r.newWeapon.levelUp();
        const p = this.player;
        p.maxHp = Math.round(p.def.hp * p.def.traits.maxHpMul * this.up.stats.maxHpMul) + this.up.stats.maxHpBonus;
        if (r.maxHpDelta > 0) p.heal(r.maxHpDelta);
        if (c.kind === 'weapon' && r.newWeapon) this.cutIn.show({ owner: c.owner, title: c.title, tag: 'Lv 8', color: c.color });
        this.up.recompute();
      },
    };
    AudioBus.play('se_levelup');
    this.joystick.reset();
    this.haltFrame = true;
    this.guardOnResume = true;
    this.scene.pause();
    this.scene.launch('LevelUp', data);
  }

  /** 重み付きの乱数で行動を選ぶ（last と skip の行動は選ばない）。選べなければ空 */
  private pickAct(table: Readonly<Record<string, number>>, last: string, skip: string[] = []): string {
    let total = 0;
    for (const k in table) if (k !== last && !skip.includes(k)) total += table[k];
    if (total <= 0) return '';
    let r = Math.random() * total;
    for (const k in table) {
      if (k === last || skip.includes(k)) continue;
      r -= table[k];
      if (r <= 0) return k;
    }
    return '';
  }

  /** プレイヤーを (cx, cy) から遠ざかる向きに吹き飛ばす（ノックバック無効のキャラには効かない） */
  private knockPlayer(cx: number, cy: number, speed: number): void {
    const p = this.player;
    if (p.def.knockbackImmune) return;
    const a = Math.atan2(p.y - 12 - cy, p.x - cx);
    this.pkx = Math.cos(a) * speed;
    this.pky = Math.sin(a) * speed;
  }

  /** 岩壁にめり込んだものを、壁の外へ押し出す */
  private pushOutOfWalls(o: { x: number; y: number }, r: number, oy = 0): void {
    for (const w of this.walls) {
      const px = o.x;
      const py = o.y + oy;
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Phaser.Math.Clamp(((px - w.x1) * dx + (py - w.y1) * dy) / len2, 0, 1);
      let nx = px - (w.x1 + dx * t);
      let ny = py - (w.y1 + dy * t);
      const d = Math.hypot(nx, ny);
      const min = w.half + r;
      if (d >= min) continue;
      if (d < 0.01) {
        const l = Math.sqrt(len2);
        nx = -dy / l;
        ny = dx / l;
      } else {
        nx /= d;
        ny /= d;
      }
      o.x += nx * (min - d);
      o.y += ny * (min - d);
    }
  }

  /** 岩壁を1枚せり上げる。(x, y) が中心、a が壁の向き */
  private raiseWall(x: number, y: number, a: number, now: number): void {
    const R = CONFIG.rook;
    const ux = (Math.cos(a) * R.wallLength) / 2;
    const uy = (Math.sin(a) * R.wallLength) / 2;
    const n = 5;
    const imgs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * 2 - 1;
      const img = this.add.image(x + ux * t, y + uy * t + 10, 'fx_rock').setOrigin(0.5, 0.95).setDepth(12).setScale(1.15, 0).setFlipX(i % 2 === 1);
      this.tweens.add({ targets: img, scaleY: 1.15 + (i % 3) * 0.08, duration: 220, delay: i * 30, ease: 'Back.easeOut' });
      this.hitSpark(img.x, img.y - 10, 0x40e0ff, 3);
      imgs.push(img);
    }
    this.walls.push({ x1: x - ux, y1: y - uy, x2: x + ux, y2: y + uy, half: R.wallHalfWidth, until: now + R.wallSec * 1000, imgs });
  }

  /** 岩壁を崩す（all：残っている壁を全部） */
  private updateWalls(now: number, all = false): void {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      const left = w.until - now;
      if (!all && left > 0) {
        // 崩れる前は、点滅して知らせる
        if (left < 1000) for (const img of w.imgs) img.setAlpha(Math.floor(now / 90) % 2 === 0 ? 0.55 : 1);
        continue;
      }
      for (const img of w.imgs) {
        this.particles.setParticleTint(0x3d4256);
        this.particles.explode(5, img.x, img.y - 24);
        this.tweens.add({ targets: img, alpha: 0, scaleY: 0.3, duration: 220, onComplete: () => img.destroy() });
      }
      this.walls.splice(i, 1);
    }
  }

  /** 毒の粉：描画と、中にいるときの効果（足が遅くなり、少しずつ削られる） */
  private updatePollens(dt: number, now: number): void {
    this.inPollen = false;
    if (this.pollens.length === 0) return;
    const Q = CONFIG.queen;
    const g = this.bossGfx;
    const p = this.player;
    for (let i = this.pollens.length - 1; i >= 0; i--) {
      const z = this.pollens[i];
      if (now >= z.until) { this.pollens.splice(i, 1); continue; }
      if (now < z.from) {
        // 予告：輪が広がる
        const k = 1 - (z.from - now) / (Q.pollenWindupSec * 1000);
        g.lineStyle(2, 0xc77dff, 0.7);
        g.strokeCircle(z.x, z.y, z.r);
        g.fillStyle(0xc77dff, 0.06 + k * 0.08);
        g.fillCircle(z.x, z.y, z.r * k);
        continue;
      }
      const fade = Math.min(1, (z.until - now) / 600);
      g.fillStyle(0x6a2c91, (0.26 + Math.sin(now / 160 + i) * 0.05) * fade);
      g.fillCircle(z.x, z.y, z.r);
      g.lineStyle(2, 0xc77dff, 0.55 * fade);
      g.strokeCircle(z.x, z.y, z.r);
      if (Math.random() < 0.25) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * z.r;
        this.hitSpark(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 0xffc83d, 1);
      }
      if (Math.hypot(p.x - z.x, p.y - 12 - z.y) < z.r) this.inPollen = true;
    }
    if (!this.inPollen) return;
    // 盾が張られている間と無敵の設定中は、削られない。被弾の無敵時間は関係なく削る
    const shielded = now < p.shieldUntil || p.hitShield > 0;
    if (!this.debugInvincible && !shielded) {
      let mul = (this.stage.enemyDamageMul ?? 1) * this.cycleDamageMul * this.up.stats.damageTakenMul;
      if (now < this.soulUntil && p.def.special.id === 'aqua_lament') mul *= 0.3;
      p.hp = Math.max(0, p.hp - Q.pollenDps * mul * dt);
    }
    this.pollenTick -= dt;
    if (this.pollenTick <= 0) {
      this.pollenTick = 0.5;
      this.hitSpark(p.x, p.y - 40, 0xc77dff, 3);
      if (this.stage.scoreMode && !shielded) { this.combo = 0; this.comboMul = 1; this.scoreNoDamageBreak(); }
    }
  }

  /** 女王級の蕾が孵る：雑音級の群れか、狩人級1体 */
  private hatchBud(e: Enemy): void {
    const Q = CONFIG.queen;
    const x = e.x;
    const y = e.y;
    const hatch = e.def.hatch;
    e.despawn();
    this.hitSpark(x, y - 10, 0xffc83d, 6);
    AudioBus.play('se_queen_hatch', 120);
    if (hatch) {
      this.spawner.spawnOne(hatch, x, y, this.stage.enemyHpMul);
      return;
    }
    if (Math.random() < Q.budHunterChance) {
      this.spawner.spawnOne('hunter', x, y, this.stage.enemyHpMul);
      return;
    }
    for (let i = 0; i < Q.budGrunts; i++) {
      const a = (i / Q.budGrunts) * Math.PI * 2 + Math.random();
      this.spawner.spawnOne('grunt', x + Math.cos(a) * 22, y + Math.sin(a) * 22, this.stage.enemyHpMul);
    }
  }

  /** ボスが倒れたあとの片付け：岩壁・毒の粉・蕾 */
  private clearBossField(kind?: 'rook' | 'queen'): void {
    if (kind === 'rook') {
      this.updateWalls(this.gameNow, true);
      this.hazards = this.hazards.filter((h) => !h.circle);
    }
    if (kind === 'queen') {
      this.pollens.length = 0;
      this.cage = null;
      for (const o of this.enemies.getChildren() as Enemy[]) {
        if (!o.active || !o.def.bud) continue;
        this.hitSpark(o.x, o.y - 10, 0xffc83d, 4);
        o.despawn();
      }
    }
  }

  /**
   * 城兵級：とても遅く歩きながら、砲撃か岩壁を繰り出す。プレイヤーが近いと踏み鳴らし。
   * HP50%を切ると、砲撃の着弾点が増える。範囲攻撃はすべて予告を出してから当てる。
   * 返り値: このフレームの移動速度
   */
  private updateRook(e: Enemy, dt: number, now: number, dist: number, nx: number, ny: number): number {
    const b = e.bossState;
    const R = CONFIG.rook;
    const B = CONFIG.boss;
    const g = this.bossGfx;
    const p = this.player;
    e.tickPose(dt);
    if (b.phase === 1 && e.hp <= e.maxHp * R.phase2At) {
      b.phase = 2;
      if (!b.act) e.pose('hit', 0.7);
      AudioBus.play('se_boss_enrage', 0, 'se_boss');
      this.hud.banner(`${e.def.name} —— 激昂`, '#FF4D6D', 34);
      this.cameras.main.shake(400, 0.007);
      this.fxRing(e.x, e.y - 60, 240, 0x40e0ff, 10);
    }
    const p2 = b.phase === 2;
    b.chargeTimer -= dt; // 踏み鳴らしの待ち時間

    // 攻撃の前は、体のひび割れが強く光る
    const glow = (k: number) => {
      g.fillStyle(0x40e0ff, 0.1 + k * 0.16 + Math.sin(now / 70) * 0.04);
      g.fillCircle(e.x, e.y - 70, 125);
      if (!e.flashUntil) e.setTint(Math.floor(now / 90) % 2 === 0 ? 0xa8f4ff : 0xffffff);
    };
    const endAct = () => {
      b.act = '';
      if (!e.flashUntil) e.clearTint();
    };


    // 突進：予兆（前半は狙いを追う細い線 → 後半は向きを固定した帯）→ ダッシュ
    if (b.dashing > 0) {
      b.dashing -= dt;
      if (b.dashing <= 0) e.playLoop();
      // 自分の岩壁にぶつかると、砕く
      for (let i = this.walls.length - 1; i >= 0; i--) {
        const w = this.walls[i];
        if (w && this.distToSegment(e.x, e.y, w.x1, w.y1, w.x2, w.y2) < e.radius * 0.8 + w.half) this.breakWall(i);
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
      glow(1 - Math.max(0, b.windup) / (B.kingChargeTrackSec + B.kingChargeLockSec));
      if (b.windup <= 0) {
        b.dashing = B.chargeDurationSec;
        if (!e.flashUntil) e.clearTint();
        e.pose('stomp', B.chargeDurationSec);
        AudioBus.play('se_rook_charge', 200, 'se_knight_charge');
        this.cameras.main.shake(120, 0.005);
      }
      return 0;
    }

    // 連続砲撃：直線の上に円を順に出す → 順に着弾 → 着弾した所が燃える
    if (b.act === 'barrage') {
      b.actT += dt;
      const total = b.actLeft;
      let done = 0;
      for (let i = 0; i < e.aim.length; i++) {
        const t = e.aim[i];
        const shown = b.actT - i * R.barrageGapSec;
        if (shown < 0) continue;
        if (t.a === 1) { done++; continue; }
        if (shown >= R.barrageWindupSec) {
          // 着弾
          t.a = 1;
          done++;
          this.fxRing(t.x, t.y, R.barrageRadius, 0xff8844, 6);
          this.particles.setParticleTint(0xff8844);
          this.particles.explode(8, t.x, t.y - 6);
          AudioBus.play('se_rook_impact', 60, 'se_kill');
          this.cameras.main.shake(100, 0.006);
          if (Math.hypot(p.x - t.x, p.y - 12 - t.y) < R.barrageRadius) this.hurt(R.barrageDamage, now);
          this.hazards.push({ circle: true, x1: t.x, y1: t.y, x2: t.x, y2: t.y, halfWidth: R.barrageRadius, until: now + R.barrageFireSec * 1000, damage: R.barrageFireDamage });
          continue;
        }
        const k = shown / R.barrageWindupSec;
        g.fillStyle(0xff2244, 0.1 + k * 0.2);
        g.fillCircle(t.x, t.y, R.barrageRadius);
        g.lineStyle(2, 0xff2244, 0.85);
        g.strokeCircle(t.x, t.y, R.barrageRadius);
        g.lineStyle(3, 0xff2244, 0.5 + k * 0.4);
        g.strokeCircle(t.x, t.y, R.barrageRadius * k);
        // 着弾の少し前に、砲弾が降ってくる
        if (t.x !== 0 && shown >= R.barrageWindupSec - 0.35 && !this.shellsShown.has(t)) {
          this.shellsShown.add(t);
          const shell = this.add.image(t.x, t.y - 600, 'fx_shell').setDepth(27).setScale(2.4);
          this.tweens.add({ targets: shell, y: t.y - 10, angle: 360, duration: 350, ease: 'Quad.easeIn', onComplete: () => shell.destroy() });
        }
      }
      if (b.actT < 0.6) glow(b.actT / 0.6);
      else if (!e.flashUntil && e.isTinted) e.clearTint();
      if (done >= total) endAct();
      return 0;
    }

    // 砲撃：着弾点を赤い円で予告 → 発射 → 岩の砲弾が降る
    if (b.act === 'cannon') {
      b.actT -= dt;
      const k = 1 - Math.max(0, b.actT) / R.cannonWindupSec;
      for (const t of e.aim) {
        g.fillStyle(0xff2244, 0.1 + k * 0.2);
        g.fillCircle(t.x, t.y, R.cannonRadius);
        g.lineStyle(2, 0xff2244, 0.85);
        g.strokeCircle(t.x, t.y, R.cannonRadius);
        g.lineStyle(3, 0xff2244, 0.5 + k * 0.4);
        g.strokeCircle(t.x, t.y, R.cannonRadius * k);
      }
      if (b.actLeft > 0) {
        glow(k);
        if (b.actT <= R.cannonWindupSec - R.cannonFireAtSec) {
          // 発射：反動でのけぞる。砲弾は着弾点の真上から降る
          b.actLeft = 0;
          if (!e.flashUntil) e.clearTint();
          e.pose('fire', 0.5);
          AudioBus.play('se_rook_cannon', 120, 'se_break');
          this.cameras.main.shake(120, 0.005);
          const ms = Math.max(60, b.actT * 1000);
          for (const t of e.aim) {
            const shell = this.add.image(t.x, t.y - 700, 'fx_shell').setDepth(27).setScale(2.4);
            this.tweens.add({ targets: shell, y: t.y - 10, angle: 360, duration: ms, ease: 'Quad.easeIn', onComplete: () => shell.destroy() });
          }
        }
      }
      if (b.actT <= 0) {
        endAct();
        let hit = false;
        for (const t of e.aim) {
          this.fxRing(t.x, t.y, R.cannonRadius, 0xff4d6d, 6);
          this.particles.setParticleTint(0x3d4256);
          this.particles.explode(8, t.x, t.y - 6);
          if (Math.hypot(p.x - t.x, p.y - 12 - t.y) < R.cannonRadius) hit = true;
          // 激昂のあとは、着弾した所が燃える
          if (p2) this.hazards.push({ circle: true, x1: t.x, y1: t.y, x2: t.x, y2: t.y, halfWidth: R.cannonRadius, until: now + R.barrageFireSec * 1000, damage: R.barrageFireDamage });
        }
        AudioBus.play('se_rook_impact', 60, 'se_kill');
        this.cameras.main.shake(200, 0.008);
        if (hit) this.hurt(R.cannonDamage, now);
      }
      return 0;
    }

    // 岩壁：壁の位置を予告 → せり上がる
    if (b.act === 'wall') {
      b.actT -= dt;
      const k = 1 - Math.max(0, b.actT) / R.wallWindupSec;
      for (const w of e.aim) {
        const ux = (Math.cos(w.a) * R.wallLength) / 2;
        const uy = (Math.sin(w.a) * R.wallLength) / 2;
        g.lineStyle(R.wallHalfWidth * 2, 0x40e0ff, 0.12 + k * 0.22);
        g.lineBetween(w.x - ux, w.y - uy, w.x + ux, w.y + uy);
        g.lineStyle(2, 0x40e0ff, 0.85);
        g.lineBetween(w.x - ux, w.y - uy, w.x + ux, w.y + uy);
      }
      glow(k);
      if (b.actT <= 0) {
        endAct();
        for (const w of e.aim) this.raiseWall(w.x, w.y, w.a, now);
        AudioBus.play('se_rook_wall', 120, 'se_break');
        this.cameras.main.shake(160, 0.006);
      }
      return 0;
    }

    // 踏み鳴らし：予告の円 → 衝撃の輪。当たると大きく吹き飛ぶ
    if (b.act === 'stomp') {
      b.actT -= dt;
      const cx = e.x;
      const cy = e.y - 30;
      if (b.actT > 0) {
        const k = 1 - b.actT / R.stompWindupSec;
        g.fillStyle(0xff2244, 0.12 + k * 0.18);
        g.fillCircle(cx, cy, R.stompRadius);
        g.lineStyle(4, 0xff2244, 0.5 + k * 0.4);
        g.strokeCircle(cx, cy, R.stompRadius * k);
        glow(k);
        return 0;
      }
      endAct();
      b.chargeTimer = R.stompCooldownSec;
      e.pose('stomp', 0.5);
      AudioBus.play('se_rook_stomp', 120, 'se_break');
      this.cameras.main.shake(220, 0.009);
      this.fxRing(cx, cy, R.stompRadius, 0x40e0ff, 8);
      this.fxRing(cx, cy, R.stompRadius * 0.6, 0xffffff, 4);
      if (Math.hypot(p.x - cx, p.y - 12 - cy) < R.stompRadius) {
        this.hurt(R.stompDamage, now);
        this.knockPlayer(cx, cy, R.stompKnockback);
      }
      return 0;
    }

    // プレイヤーが近い：踏み鳴らし
    if (dist < R.stompTriggerDist && b.chargeTimer <= 0) {
      b.act = 'stomp';
      b.actT = R.stompWindupSec;
      e.pose('wall', R.stompWindupSec);
      return 0;
    }

    b.actTimer -= dt;
    if (b.actTimer <= 0) {
      // 岩壁・突進・連続砲撃は続けて出さない（砲撃は続いてよい）
      // デバッグで予約した技があれば、それを出す
      // 岩壁のあとは、必ず突進
      const act = e.bk.exForce || (b.lastAct === 'wall' ? 'charge' : '') || this.pickAct(R.weights, b.lastAct === 'cannon' ? '' : b.lastAct) || 'cannon';
      e.bk.exForce = '';
      b.lastAct = act;
      // 行動の途中は数えないので、岩壁のあとの待ち時間は「壁がせり上がってから」になる
      b.actTimer = (act === 'wall' ? R.wallChargeDelaySec : R.attackEverySec) * this.bossIdleMul();
      e.aim.length = 0;
      if (act === 'charge') {
        b.windup = B.kingChargeTrackSec + B.kingChargeLockSec;
        e.pose('wall', b.windup);
        this.fxText(e.x, e.y - 150, '!!', '#FF4D6D');
      } else if (act === 'barrage') {
        const n = p2 ? R.barrageCountPhase2 : R.barrageCount;
        const a = Math.atan2(p.y - 12 - e.y, p.x - e.x);
        for (let i = 0; i < n; i++) {
          const d = R.barrageStart + i * R.barrageStep;
          e.aim.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, a: 0 });
        }
        b.act = 'barrage';
        b.actT = 0;
        b.actLeft = n;
        e.pose('aim', 0.6);
        AudioBus.play('se_rook_cannon', 120, 'se_break');
      } else if (act === 'cannon') {
        const range = p2 ? R.cannonPointsPhase2 : R.cannonPoints;
        const n = Phaser.Math.Between(range[0], range[1]);
        // 1発目はプレイヤーの位置。残りは周りに散らす（近すぎる点は選び直す）
        e.aim.push({ x: p.x, y: p.y - 12, a: 0 });
        for (let i = 1; i < n; i++) {
          let x = p.x;
          let y = p.y;
          for (let tries = 0; tries < 8; tries++) {
            const a = Math.random() * Math.PI * 2;
            const d = Phaser.Math.Between(R.cannonSpreadMin, R.cannonSpreadMax);
            x = p.x + Math.cos(a) * d;
            y = p.y - 12 + Math.sin(a) * d;
            if (e.aim.every((t) => Math.hypot(t.x - x, t.y - y) > R.cannonRadius * 1.3)) break;
          }
          e.aim.push({ x, y, a: 0 });
        }
        b.act = 'cannon';
        b.actT = R.cannonWindupSec;
        b.actLeft = 1;
        e.pose('aim', R.cannonFireAtSec);
      } else {
        // プレイヤーの背中側（城兵級から見て奥）を塞ぐ。壁どうしの間は通れる
        const n = Phaser.Math.Between(R.wallCount[0], R.wallCount[1]);
        const away = Math.atan2(p.y - 12 - e.y, p.x - e.x);
        const offs = n >= 3 ? [0, 1.75, -1.75] : [0.87, -0.87];
        for (const off of offs) {
          const a = away + off + (Math.random() - 0.5) * 0.2;
          e.aim.push({ x: p.x + Math.cos(a) * R.wallDistance, y: p.y - 12 + Math.sin(a) * R.wallDistance, a: a + Math.PI / 2 });
        }
        b.act = 'wall';
        b.actT = R.wallWindupSec;
        e.pose('wall', R.wallWindupSec + 0.5);
      }
      return 0;
    }
    return e.def.speed;
  }

  /**
   * 女王級：出た場所から動かない。蕾を産み（召喚）、蔓の鞭と鱗粉で攻める。
   * HP50%で「開花」：しばらく無敵。以降は蕾が増え、召喚の間隔が短くなる。
   */
  private updateQueen(e: Enemy, dt: number, now: number, dist: number, nx: number, ny: number): void {
    const b = e.bossState;
    const Q = CONFIG.queen;
    const g = this.bossGfx;
    const p = this.player;
    e.tickPose(dt);

    // 姿を現す（この間は当たらない・攻撃しない）
    if (b.act === 'emerge') {
      b.actT -= dt;
      const k = 1 - Math.max(0, b.actT) / Q.emergeSec;
      e.setAlpha(0.15 + k * 0.85);
      g.fillStyle(0xffc83d, 0.08);
      g.fillCircle(e.x, e.y - 20, 140);
      g.lineStyle(3, 0xffc83d, 0.7);
      g.strokeCircle(e.x, e.y - 20, 140 * k);
      if (b.actT <= 0) {
        b.act = '';
        e.setAlpha(1);
        this.fxRing(e.x, e.y - 20, 160, 0xffc83d, 6);
      }
      return;
    }

    // 開花（50%を切った瞬間）
    if (b.phase === 1 && e.hp <= e.maxHp * Q.bloomAt) {
      b.phase = 2;
      b.act = 'bloom';
      b.actT = Q.bloomInvulnSec;
      e.bk.invulnUntil = now + Q.bloomInvulnSec * 1000;
      e.aim.length = 0;
      e.pose('bloom', Q.bloomInvulnSec);
      b.ringTimer = Math.min(b.ringTimer, 1);
      AudioBus.play('se_boss_enrage', 0, 'se_boss');
      this.hud.banner(`${e.def.name} —— 開花`, '#FFC83D', 34);
      this.cameras.main.shake(400, 0.007);
      this.fxRing(e.x, e.y - 60, 240, 0xffc83d, 10);
    }
    const p2 = b.phase === 2;
    if (p2) {
      g.fillStyle(0xffc83d, 0.1 + Math.sin(now / 120) * 0.04);
      g.fillCircle(e.x, e.y - 50, 125 + Math.sin(now / 95) * 8);
    }
    if (b.act === 'bloom' || b.act === 'cast') {
      b.actT -= dt;
      if (b.actT <= 0) b.act = '';
      return;
    }

    // 蔓の鞭：予告線 → 黒い茨が一直線に地面を薙ぐ
    if (b.act === 'whip') {
      b.actT -= dt;
      const ox = e.x;
      const oy = e.y - 40;
      if (b.actT > 0) {
        const k = 1 - b.actT / Q.whipWindupSec;
        for (const w of e.aim) {
          const tx = ox + Math.cos(w.a) * Q.whipLength;
          const ty = oy + Math.sin(w.a) * Q.whipLength;
          g.lineStyle(Q.whipHalfWidth * 2, 0xff2244, 0.14 + k * 0.22);
          g.lineBetween(ox, oy, tx, ty);
          g.lineStyle(3, 0xff2244, 0.8);
          g.lineBetween(ox, oy, tx, ty);
        }
        return;
      }
      b.act = '';
      e.pose('whip', 0.5);
      AudioBus.play('se_queen_whip', 80, 'se_slash_heavy');
      let hit = false;
      for (const w of e.aim) {
        const tx = ox + Math.cos(w.a) * Q.whipLength;
        const ty = oy + Math.sin(w.a) * Q.whipLength;
        this.fxBand(ox, oy, tx, ty, Q.whipHalfWidth * 2, 0x9d4dff);
        const vine = this.add.graphics().setDepth(26);
        vine.lineStyle(10, 0x0a0612, 1);
        vine.lineBetween(ox, oy, tx, ty);
        vine.lineStyle(3, 0x4a2a6a, 1);
        vine.lineBetween(ox, oy, tx, ty);
        this.fadeOut(vine, 260);
        if (this.distToSegment(p.x, p.y - 12, ox, oy, tx, ty) < Q.whipHalfWidth) hit = true;
      }
      this.cameras.main.shake(140, 0.006);
      if (hit) this.hurt(Q.whipDamage, now);
      return;
    }


    // 触手の突き（開花のあと）：プレイヤーの居た場所まで、一直線に伸びる。予兆は短い
    if (b.act === 'thrust') {
      b.actT -= dt;
      const ox = e.x;
      const oy = e.y - 40;
      const w = e.aim[0];
      const tx = ox + Math.cos(w.a) * w.x;
      const ty = oy + Math.sin(w.a) * w.x;
      if (b.actT > 0) {
        const k = 1 - b.actT / Q.thrustWindupSec;
        g.lineStyle(Q.thrustHalfWidth * 2, 0xff2244, 0.16 + k * 0.26);
        g.lineBetween(ox, oy, tx, ty);
        g.lineStyle(3, 0xff2244, 0.9);
        g.lineBetween(ox, oy, tx, ty);
        return;
      }
      b.act = '';
      e.pose('whip', 0.5);
      AudioBus.play('se_queen_thrust', 80, 'se_slash_heavy');
      this.fxBand(ox, oy, tx, ty, Q.thrustHalfWidth * 2, 0x9d4dff);
      const vine = this.add.graphics().setDepth(26);
      vine.lineStyle(14, 0x0a0612, 1);
      vine.lineBetween(ox, oy, tx, ty);
      vine.lineStyle(4, 0x6a3a9a, 1);
      vine.lineBetween(ox, oy, tx, ty);
      vine.fillStyle(0x0a0612, 1);
      vine.fillCircle(tx, ty, 12);
      this.fadeOut(vine, 300);
      this.cameras.main.shake(120, 0.006);
      if (this.distToSegment(p.x, p.y - 12, ox, oy, tx, ty) < Q.thrustHalfWidth) this.hurt(Q.thrustDamage, now);
      return;
    }

    // 地中の触手：床に刺す → プレイヤーの周りの円から突き出る
    if (b.act === 'burrow') {
      b.actT -= dt;
      if (b.actT > 0) {
        const k = 1 - b.actT / Q.burrowWindupSec;
        for (const t of e.aim) {
          g.fillStyle(0xff2244, 0.1 + k * 0.2);
          g.fillCircle(t.x, t.y, Q.burrowRadius);
          g.lineStyle(2, 0xff2244, 0.85);
          g.strokeCircle(t.x, t.y, Q.burrowRadius);
          g.lineStyle(3, 0xff2244, 0.5 + k * 0.4);
          g.strokeCircle(t.x, t.y, Q.burrowRadius * k);
          // 地面が揺れる
          if (Math.random() < 0.2) this.hitSpark(t.x + (Math.random() - 0.5) * Q.burrowRadius, t.y + (Math.random() - 0.5) * Q.burrowRadius, 0x4a2a6a, 1);
        }
        return;
      }
      b.act = '';
      AudioBus.play('se_queen_burrow', 80, 'se_slash_heavy');
      let hit = false;
      for (const t of e.aim) {
        this.thornSpikes(t.x, t.y);
        this.fxRing(t.x, t.y, Q.burrowRadius, 0x9d4dff, 5);
        if (Math.hypot(p.x - t.x, p.y - 12 - t.y) < Q.burrowRadius) hit = true;
      }
      this.cameras.main.shake(160, 0.007);
      if (hit) this.hurt(Q.burrowDamage, now);
      return;
    }

    // 茨の檻：突き上がるまで、女王級は次の行動をしない
    if (b.act === 'cage') {
      if (!this.cage) b.act = '';
      return;
    }

    // 召喚：体の周りに蕾を産み落とす（ほかの行動とは別の間隔）
    b.ringTimer -= dt;
    if (b.ringTimer <= 0) {
      b.ringTimer = (p2 ? Q.summonEverySecBloom : Q.summonEverySec) * this.bossIdleMul();
      let alive = 0;
      for (const o of this.enemies.getChildren() as Enemy[]) if (o.active && o.def.bud) alive++;
      const n = Math.min(p2 ? Q.budsBloom : Q.buds, Q.maxBuds - alive);
      if (n > 0) {
        const spin = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = spin + (i / n) * Math.PI * 2;
          const d = Phaser.Math.Between(Q.budRingMin, Q.budRingMax);
          // 開花のあとは、一部が金の蕾（孵ると司祭級）
          const bud = this.spawner.spawnOne(p2 && i < Q.goldBuds ? 'goldbud' : 'bud', e.x + Math.cos(a) * d, e.y - 10 + Math.sin(a) * d * 0.85, this.stage.enemyHpMul);
          if (!bud) continue;
          bud.shootTimer = Q.budHatchSec;
          this.hitSpark(bud.x, bud.y - 10, 0xffc83d, 4);
        }
        e.pose('summon', 0.8);
        AudioBus.play('se_queen_summon', 0);
        this.fxRing(e.x, e.y - 40, 190, 0xffc83d, 5);
        b.act = 'cast';
        b.actT = 0.8;
        return;
      }
    }

    // 蔓の鞭が届かない距離に居る時間を数える
    b.chargeTimer = dist > Q.whipMaxDist ? b.chargeTimer + dt : 0;

    // 次の行動（直前と同じ行動は選ばない。届かない距離なら鞭は使わない）
    b.actTimer -= dt;
    if (b.actTimer <= 0) {
      const skip = dist > Q.whipMaxDist ? ['whip'] : [];
      const table = p2 ? Q.weightsBloom : Q.weights;
      // 蔓の鞭が届かない距離に居続ける相手には、開花の前でも触手の突きを使う
      const far = !p2 && b.chargeTimer >= Q.thrustFarSec;
      if (far) b.chargeTimer = 0;
      const act = e.bk.exForce || (far ? 'thrust' : '') || this.pickAct(table, b.lastAct, skip) || this.pickAct(table, '', skip);
      e.bk.exForce = '';
      b.lastAct = act;
      b.actTimer = Q.attackEverySec * this.bossIdleMul();
      e.aim.length = 0;
      if (act === 'cage') {
        const from = now + Q.cageWindupSec * 1000;
        this.cage = { x: p.x, y: p.y - 12, gap: Math.random() * Math.PI * 2, shown: now, from, until: from + Q.cageCloseSec * 1000 };
        b.act = 'cage';
        e.pose('bloom', Q.cageWindupSec + 0.6);
        AudioBus.play('se_queen_cage', 0);
      } else if (act === 'thrust') {
        // x に届く長さを入れておく
        const len = Math.min(Q.thrustMaxLength, Math.hypot(p.x - e.x, p.y - 12 - (e.y - 40)) + Q.thrustOver);
        e.aim.push({ x: len, y: 0, a: Math.atan2(p.y - 12 - (e.y - 40), p.x - e.x) });
        b.act = 'thrust';
        b.actT = Q.thrustWindupSec;
        e.pose('summon', Q.thrustWindupSec);
      } else if (act === 'burrow') {
        const range = p2 ? Q.burrowCountBloom : Q.burrowCount;
        const n = Phaser.Math.Between(range[0], range[1]);
        e.aim.push({ x: p.x, y: p.y - 12, a: 0 });
        for (let i = 1; i < n; i++) {
          let x = p.x;
          let y = p.y;
          for (let tries = 0; tries < 8; tries++) {
            const a = Math.random() * Math.PI * 2;
            const d = Phaser.Math.Between(Q.burrowRadius, Q.burrowSpread);
            x = p.x + Math.cos(a) * d;
            y = p.y - 12 + Math.sin(a) * d;
            if (e.aim.every((t) => Math.hypot(t.x - x, t.y - y) > Q.burrowRadius * 1.2)) break;
          }
          e.aim.push({ x, y, a: 0 });
        }
        b.act = 'burrow';
        b.actT = Q.burrowWindupSec;
        e.pose('whip', Q.burrowWindupSec + 0.3);
      } else if (act === 'whip') {
        const n = Phaser.Math.Between(1, 3);
        const base = Math.atan2(ny, nx);
        const offs = n === 1 ? [0] : n === 2 ? [-0.5, 0.5] : [-1, 0, 1];
        for (const off of offs) e.aim.push({ x: 0, y: 0, a: base + off * Q.whipSpreadRad });
        b.act = 'whip';
        b.actT = Q.whipWindupSec;
        e.pose('summon', Q.whipWindupSec);
      } else if (act === 'pollen') {
        const n = Phaser.Math.Between(Q.pollenCount[0], Q.pollenCount[1]);
        const spin = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = spin + (i / n) * Math.PI * 2;
          const d = Phaser.Math.Between(30, Q.pollenSpread);
          const from = now + Q.pollenWindupSec * 1000;
          this.pollens.push({ x: p.x + Math.cos(a) * d, y: p.y - 12 + Math.sin(a) * d, r: Q.pollenRadius, from, until: from + Q.pollenSec * 1000 });
        }
        e.pose('pollen', 0.9);
        AudioBus.play('se_queen_pollen', 0);
        b.act = 'cast';
        b.actT = 0.9;
      }
    }
  }

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

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
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
      const band = z.shape === 'band';
      for (const e of this.tmp) {
        if (e.def.isObject) continue;
        if (band) {
          // 帯：体が帯に触れていれば「中」。受けるダメージの増加は重ねず、最大値だけ（ボスには半分）
          if (this.distToSegment(e.x, e.y, z.x1!, z.y1!, z.x2!, z.y2!) > z.halfWidth! + e.radius) continue;
          const v = (z.vuln ?? 0) * (e.def.vulnMul ?? (e.def.boss ? CONFIG.vulnBossMul : 1));
          e.vuln = now < e.vulnUntil ? Math.max(e.vuln, v) : v;
          e.bandDrop = now < e.vulnUntil ? Math.max(e.bandDrop, z.dropChance ?? 0) : (z.dropChance ?? 0);
          e.vulnUntil = now + 300;
        }
        if (z.stun) e.stun(0.3, now);
        else if (z.slow < 1) e.applySlow(z.slow, 0.3, now);
        if (doTick) this.damageEnemy(e, z.dps * 0.25 * (z.source === 'cage' && e.def.knight ? 0.5 : 1), 0, 0);
      }
      // 描画
      const fade = Math.min(1, (z.duration - z.elapsed) / 0.4, z.elapsed / 0.15);
      if (band) {
        // スパイスの帯：真っ赤な帯と、明るい芯
        const hw = Math.max(z.halfWidth!, 12);
        g.lineStyle(hw * 2, 0xff3b1f, 0.26 * fade);
        g.lineBetween(z.x1!, z.y1!, z.x2!, z.y2!);
        g.lineStyle(Math.max(4, hw * 0.5), 0xff8a3c, (0.45 + Math.sin(now / 120 + i) * 0.12) * fade);
        g.lineBetween(z.x1!, z.y1!, z.x2!, z.y2!);
        if (Math.random() < 0.25) {
          const t = Math.random();
          this.hitSpark(z.x1! + (z.x2! - z.x1!) * t, z.y1! + (z.y2! - z.y1!) * t, 0xff5a2a, 1);
        }
      } else if (z.shape === 'fence') {
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
        // 決まった狙いがあれば、それが倒れるまでそちらへ。無ければ最寄りの敵へ
        if (b.target && !b.target.active) b.target = null;
        const t = b.target ?? this.nearestEnemy(b.x, b.y, 520);
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
      // 氷の衝撃波：氷片が舞う
      if (b.freezeSec > 0 && Math.random() < 0.6) this.hitSpark(b.x + (Math.random() - 0.5) * 30, b.y + (Math.random() - 0.5) * 50, 0xbfefff, 1);

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
        if (e.active && b.burnDps > 0) e.burn(b.burnDps, b.burnSec, now);
        if (e.active && b.freezeSec > 0) this.iceHit(e, b.freezeSec, b.chillMul, now);
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

  /** 『氷狼牙』の衝撃波が当たった：雑魚（雑音級・狩人級・司祭級）は氷漬け、騎士級・ボス・騎兵は減速 */
  private iceHit(e: Enemy, sec: number, chillMul: number, now: number): void {
    const d = e.def;
    if (d.isObject) return;
    if (d.boss || d.charger) e.chill(chillMul, sec, now);
    else if (d.id === 'knight') e.applySlow(chillMul, sec, now);
    else {
      e.freeze(sec, now);
      AudioBus.play('se_freeze', 200);
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
    if ((e.def.knight || e.def.bossKind) && this.gameNow < e.bk.invulnUntil) return;
    // スパイスの帯（『貫通チャーハン』）の中の敵は、全ての攻撃で受けるダメージが増える
    if (this.gameNow < e.vulnUntil) dmg *= 1 + e.vuln;
    if (this.debug) this.dmgLog.push({ t: this.gameNow, d: Math.min(dmg, e.hp) });
    const dead = e.hit(dmg, this.ctx.now, kx, ky);
    if (this.showDamage && !e.def.isObject) {
      // 数が多いので、1体につき約0.3秒に1回、合計をまとめて出す。倒した瞬間は、残りをすぐ出す
      e.dmgShown += dmg;
      if (dead || this.gameNow >= e.dmgNextAt) {
        this.popDamage(e.x, e.y - (e.def.boss ? 150 : e.def.size * 0.9), e.dmgShown);
        e.dmgShown = 0;
        e.dmgNextAt = this.gameNow + 280;
      }
    }
    if (dead) this.killEnemy(e);
  }

  /** ダメージの数字を1つ出す（空きが無ければ出さない） */
  private popDamage(x: number, y: number, value: number): void {
    const v = Math.round(value);
    if (v < 1) return;
    const n = this.dmgNums.find((d) => d.life <= 0);
    if (!n) return;
    n.life = 0.55;
    const big = v >= 150;
    n.t.setText(String(v)).setPosition(x + (Math.random() - 0.5) * 24, y).setAlpha(1).setVisible(true)
      .setScale(big ? 1.25 : v >= 50 ? 1 : 0.85).setTint(big ? 0xffd700 : v >= 50 ? 0xffe680 : 0xffffff);
  }

  private updateDamageNumbers(dt: number): void {
    for (const n of this.dmgNums) {
      if (n.life <= 0) continue;
      n.life -= dt;
      if (n.life <= 0) { n.t.setVisible(false); continue; }
      n.t.y -= 60 * dt;
      n.t.setAlpha(Math.min(1, n.life / 0.25));
    }
  }

  /** ボスを倒した瞬間の演出：何度か続けて弾ける */
  private bossBurst(x: number, y: number, color: number, times: number): void {
    for (let i = 0; i < times; i++) {
      this.time.delayedCall(i * 110, () => {
        const bx = x + (Math.random() - 0.5) * 160;
        const by = y + (Math.random() - 0.5) * 160;
        this.particles.setParticleTint(i % 2 === 0 ? color : 0xffffff);
        this.particles.explode(22, bx, by);
        this.fxRing(bx, by, 90 + i * 22, i % 2 === 0 ? color : 0xffffff, 6);
      });
    }
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
    // 女王級の蕾は、撃破数・必殺ゲージ・落とし物に数えない（産まれ続けるので、稼げてしまう）
    if (def.bud) {
      AudioBus.play('se_kill', 40);
      return;
    }
    this.kills++;
    // 必殺技（その炎上も含む）で倒した分はゲージに数えない
    if (!this.specialDamage) this.soulGauge = Math.min(1, this.soulGauge + (this.up.stats.soulGainMul * (this.player.def.traits.soulGainMul ?? 1)) / CONFIG.soul.killsToFull);
    if (this.stage.scoreMode) {
      const now = this.ctx.now;
      if (now < this.comboUntil) this.combo++;
      else this.combo = 0;
      this.comboUntil = now + SCORE.comboWindowSec * 1000;
      this.comboMul = Math.min(SCORE.comboMax, 1 + this.combo * SCORE.comboStep);
      this.score += (SCORE.points[def.id] ?? 1) * this.comboMul;
    }
    // ボスラッシュは Lv 固定なので、欠片は落とさない
    if (!this.stage.rush) this.xp.drop(e.x, e.y, def.xp, this.ctx.now, this.up.stats.luckMul);
    // 『運命のチャーハン』：スパイスの帯の中で倒した敵が、まれにミニチャーハンを落とす
    if (e.bandDrop > 0 && this.gameNow < e.vulnUntil && Math.random() < e.bandDrop) this.xp.spawn(e.x, e.y, 'chahan', 1, this.ctx.now);
    if (!this.stage.rush && def.tier >= 2 && !def.boss && Math.random() < ITEMS.chest.dropChance * this.up.stats.luckMul) {
      this.xp.spawn(e.x, e.y, 'chest', 1, this.ctx.now);
    }
    AudioBus.play('se_kill', 40);
    if (def.boss) {
      // 撃破ボーナスのエール
      if (def.defeatYell) {
        const yell = Math.round(def.defeatYell * (this.stage.rush ? RUSH.yellMul : 1));
        this.xp.yell += yell;
        this.fxText(this.player.x, this.player.y - 140, `+${yell} ★`, '#FFD700');
      }
      if (this.stage.rush) this.onRushBossDefeated(e);
      this.bosses = this.bosses.filter((b) => b !== e);
      this.clearBossField(def.bossKind);
      if (this.bosses.every((b) => !b.active)) this.spawner.bossActive = false;
      // 最後のボスが決まっているステージ（スコアアタック・悪夢）は、それ以外のボスを倒しても続く
      const finalBoss = this.stage.finalBoss ?? (this.stage.scoreMode ? 'blackknight' : undefined);
      // エンドレスは、どのボスを倒しても続く
      if (this.stage.endless || this.stage.rush || (finalBoss && def.id !== finalBoss)) {
        // 一瞬止めてから弾ける
        this.hitStopMs = 140;
        this.bossBurst(e.x, e.y - 60, def.eyeColor, 3);
        this.cameras.main.shake(260, 0.008);
        this.hud.banner(this.stage.scoreMode ? `${def.name} 撃破　+${SCORE.points[def.id]}` : `${def.name} 撃破`, '#FFD700', 34);
        screenFlash(this, 300);
        // 撃破後も続くので、ボスが居なくなったら道中の曲に戻す
        this.resumeBgm();
        return;
      }
      this.bossGfx?.clear();
      this.cavalryWarnings.length = 0;
      this.hazards.length = 0;
      this.bossDefeated = true;
      this.bossBurst(e.x, e.y - 60, def.eyeColor, 7);
      this.cameras.main.shake(400, 0.01);
      screenFlash(this, 500);
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
    if (kind === 'chahan') {
      // 数が出るので、字幕と大きな音は出さない
      const heal = Math.round(ITEMS.chahan.heal * this.player.def.traits.healItemMul * 10) / 10;
      this.player.heal(heal);
      this.fxText(this.player.x, this.player.y - 110, `+${heal}`, '#F2C14E');
      AudioBus.play('se_gem', 60);
      return;
    }
    AudioBus.play('se_item');
    if (kind === 'magnet') {
      this.xp.magnetAllUntil = this.ctx.now + 1500;
      this.fxRing(x, y, 60, 0x87ceeb, 4);
    } else if (kind === 'cake') {
      // 30 か、最大HPの20% の大きいほう（キャラ特性の倍率はそのあと）
      const heal = Math.round(Math.max(ITEMS.cake.heal, this.player.maxHp * ITEMS.cake.healRatio) * this.player.def.traits.healItemMul);
      this.player.heal(heal);
      this.fxText(this.player.x, this.player.y - 110, `+${heal}`, '#F0E68C');
    } else if (kind === 'cross') {
      screenFlash(this, 400);
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
  /** contact：敵との接触によるもの（キャラ特性の接触ダメージ軽減が掛かる。弾・範囲攻撃は false） */
  private hurt(amount: number, now: number, contact = false): void {
    if (this.debugInvincible) return;
    const p = this.player;
    const def = p.def;
    if (now < p.invulnUntil) return;
    if (now >= p.shieldUntil && def.uniquePassive.id === 'kanpa' && Math.random() < 0.2) {
      // 完全看破：回避して1秒間攻撃力+30%
      p.invulnUntil = now + 150;
      this.kanpaUntil = now + CONFIG.kanpaBuffSec * 1000;
      this.fxText(p.x, p.y - 110, '看破', '#E8F4FF');
      return;
    }
    // 盾が割れるか（重い攻撃か）は、倍率を掛ける前の値で見る（悪夢の1.5倍で騎兵まで「重い攻撃」になっていた）
    const raw = amount;
    // ステージごとの敵の攻撃力（悪夢は1.5倍）
    amount *= (this.stage.enemyDamageMul ?? 1) * this.cycleDamageMul;
    if (contact) amount *= def.traits.contactDamageMul ?? 1;
    let mul = this.up.stats.damageTakenMul;
    if (now < this.soulUntil && def.special.id === 'aqua_lament') mul *= 0.3;
    if (p.takeDamage(amount * mul, now, raw)) {
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

  /** playSe：false なら音は鳴らさない（黒騎士の斬撃は knightSlashSe が先に鳴らす） */
  private fxSlash(x: number, y: number, r: number, color: number, angle: number, arcDeg: number, playSe = true): void {
    if (playSe) AudioBus.play('se_slash', 80);
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

  /** いまの状況に合うBGMへ：ボス生存中はボス曲（ボスごとに別）、満月中は満月曲、それ以外はキャラ曲 */
  private resumeBgm(): void {
    // カスタム（オプションで CUSTOM にして、ミュージックで割り当てた曲）があれば、それを先に試す
    const c = this.customBgm;
    const boss = this.bosses.find((b) => b.active);
    if (boss) {
      if (boss.def.id === 'redknight') {
        // 悪夢の黒騎士は専用の曲（前半・後半とも同じ。無ければ黒騎士の曲）
        AudioBus.playBgm(c.redknight ?? 'bgm_boss_redknight', 'bgm_boss_redknight', boss.bk.phase === 2 ? 'bgm_boss_blackknight2' : 'bgm_boss_blackknight', 'bgm_boss_blackknight', 'bgm_boss');
      } else if (boss.def.knight) {
        // 形態変化後は専用の曲（無ければ前半の曲のまま）。前半のうちに先読みしておく
        if (boss.bk.phase === 2) AudioBus.playBgm(c.bk2 ?? 'bgm_boss_blackknight2', 'bgm_boss_blackknight2', 'bgm_boss_blackknight', 'bgm_boss');
        else {
          AudioBus.playBgm(c.bk1 ?? 'bgm_boss_blackknight', 'bgm_boss_blackknight', 'bgm_boss');
          AudioBus.preloadBgm(c.bk2 ?? 'bgm_boss_blackknight2');
        }
      }
      // 城兵級・女王級は専用の曲（無ければ旧版のボス戦の曲）
      else if (boss.def.bossKind) AudioBus.playBgm(c[boss.def.bossKind] ?? `bgm_boss_${boss.def.bossKind}`, `bgm_boss_${boss.def.bossKind}`, 'bgm_boss', 'bgm_boss_blackknight');
      else AudioBus.playBgm('bgm_boss', 'bgm_boss_blackknight');
      return;
    }
    const chara = c.normal ?? `bgm_chara_${this.player.def.id}`;
    if (this.fullMoon) AudioBus.playBgm(c.fullmoon ?? 'bgm_fullmoon', 'bgm_fullmoon', chara, this.stage.bgm, 'bgm_stage');
    else AudioBus.playBgm(chara, `bgm_chara_${this.player.def.id}`, this.stage.bgm, 'bgm_stage');
  }

  /** ノーダメージ時間を確定させる（被弾で区切る） */
  private scoreNoDamageBreak(): void {
    this.score += this.noDamageSec * SCORE.noDamagePerSec;
    this.noDamageSec = 0;
  }

  private onBossSpawn(boss: Enemy, bandHpMul = 1, index = 0, total = 1, enraged = false): void {
    this.boss = boss;
    this.bosses.push(boss);
    // 最初から後半の行動で出る（赤騎士は常に）。王級は咆哮してから動き出す
    if (enraged || boss.def.id === 'redknight') {
      if (boss.def.knight) boss.bk.phase = 2;
      else if (boss.def.bossKind) boss.bossState.phase = 2;
      else {
        boss.bossState.phase = 2;
        boss.bossState.act = 'roar';
        boss.bossState.actT = 1.2;
      }
    }
    // 動かないボスは画面の中に出るので、姿を現すまでは当たらない・攻撃しない
    if (boss.def.fixed) {
      boss.bossState.act = 'emerge';
      boss.bossState.chargeTimer = 0;
      boss.bossState.actT = CONFIG.queen.emergeSec;
      boss.bk.invulnUntil = this.gameNow + CONFIG.queen.emergeSec * 1000;
      boss.setAlpha(0.15);
    }
    // プレイヤーの成長に合わせてHPを底上げ（固定HPだと10:00の火力で即落ちする）
    boss.maxHp = Math.round((boss.def.hp + this.xp.level * CONFIG.boss.hpPerPlayerLevel) * this.stage.bossHpMul * bandHpMul);
    boss.hp = boss.maxHp;
    // 複数同時に出るときも、字幕・揺れ・効果音は1回だけ
    if (index === 0) {
      this.hud.banner(total > 1 ? `${boss.def.name} ×${total} —— 出現` : `${boss.def.name} —— 出現`, '#FF4D6D', 40);
      this.cameras.main.shake(300, 0.006);
      if (boss.def.fixed) AudioBus.play('se_queen_emerge', 0, 'se_boss');
      else AudioBus.play('se_boss');
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
    // 『エンジェリック・ランブル』：発動のあと、しばらく攻撃力が上がる
    if (def.special.id === 'angelic_rumble') {
      this.rumbleUntil = this.ctx.now + CONFIG.rumble.buffSec * 1000;
      this.fxText(this.player.x, this.player.y - 130, `攻撃力 +${Math.round((CONFIG.rumble.buffMul - 1) * 100)}%`, '#FF4500');
    }
    this.hud.banner(def.special.name, Phaser.Display.Color.IntegerToColor(def.color).rgba, 36);
    screenFlash(this, 300, 135, 206, 235);
    AudioBus.play('se_special');
    this.vo('special');
  }

  private openLevelUp(): void {
    if (this.overlayActive()) {
      this.xp.pendingLevelUps++;
      return;
    }
    // 固有パッシブ『脚本』：選択肢が4つ
    const choiceCount = this.player.def.uniquePassive.id === 'scenario' ? 4 : 3;
    const choices = this.up.buildChoices(choiceCount);
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
      reroll: () => this.up.buildChoices(choiceCount),
      skip: () => this.player.heal(this.player.maxHp * 0.1),
      ban: (c: Choice) => {
        this.up.banned.add(`${c.kind}:${c.id}`);
        const keep = choices.filter((x) => x !== c);
        const extra = this.up.buildChoices(6).filter((x) => !keep.some((k) => k.id === x.id && k.kind === x.kind) && !(x.kind === c.kind && x.id === c.id));
        return [...keep, ...extra].slice(0, choiceCount);
      },
    };
    AudioBus.play('se_levelup');
    this.vo('levelup', 4000);
    this.joystick.reset();
    this.haltFrame = true;
    this.guardOnResume = true;
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
      this.xp.yell += ITEMS.chest.yellFallback;
      this.player.heal(10);
      this.fxText(this.player.x - 30, this.player.y - 110, `+${ITEMS.chest.yellFallback} ★`, '#FFD700');
      this.fxText(this.player.x + 40, this.player.y - 130, '+10', '#87CEFA');
      AudioBus.play('se_item');
      return;
    }
    const data: ChestData = {
      characterId: this.characterId,
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
    this.guardOnResume = true;
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
      main: { name: this.up.main.name, level: this.up.main.level, color: this.up.main.def.color },
      passives: [...this.up.passives].map(([id, lv]) => ({ name: PASSIVES[id].name, level: lv, color: PASSIVES[id].color })),
      debug: this.debugUsed,
      rush: this.stage.rush ? { loopTimes: this.rush.loopTimes, loop: this.rush.loop, bossTimes: this.rush.bossTimes, bossesDefeated: this.rush.bossesDefeated, arts: this.rushArts, supports: this.rushSupports } : undefined,
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
