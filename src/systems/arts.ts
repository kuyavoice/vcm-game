import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { WEAPONS, computeStats, type ArtStats, type WeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import { Weapon, type ArtBehavior, type BattleContext } from './WeaponSystem';

const tmp: Enemy[] = [];
let hitStamp = 0;

/** 武器のダメージ（パッシブ倍率＋一時倍率＋アーツなら特性・必殺＋近接なら雪人の特性） */
const dmgOf = (ctx: BattleContext, s: ArtStats, def: WeaponDef) =>
  s.damage * ctx.stats.damageMul * ctx.bonusDamageMul *
  (def.kind === 'art' ? ctx.artDamageMul : 1) *
  (def.tags.includes('melee') ? ctx.meleeMul : 1);
const artDmg = (ctx: BattleContext, s: ArtStats, def: WeaponDef) => dmgOf(ctx, s, def);
const facingAngle = (ctx: BattleContext) => Math.atan2(ctx.player.facing.y, ctx.player.facing.x);
const chest = (ctx: BattleContext) => ({ x: ctx.player.x, y: ctx.player.y - 16 });
/** 投射物の数（魔術師の台本の加算込み） */
const projCount = (ctx: BattleContext, s: ArtStats, def: WeaponDef) =>
  s.count + (def.tags.includes('projectile') ? ctx.stats.projectileBonus : 0);
/** 効果時間（天宮座のアンコール込み） */
const dur = (ctx: BattleContext, s: ArtStats) => s.duration * ctx.stats.durationMul;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ───────────────────────── 初期武器『宵星』 ─────────────────────────

interface Burst { angle: number; left: number; timer: number }

const yoisei: ArtBehavior = {
  mimicable: false,
  update(dt, ctx, s, w) {
    const b = w.state.burst as Burst | undefined;
    if (!b) return;
    b.timer -= dt;
    if (b.timer <= 0 && b.left > 0) {
      b.left--;
      b.timer = 0.08;
      const spread = (Math.random() - 0.5) * 0.12;
      const c = chest(ctx);
      ctx.fireBullet({
        x: c.x, y: c.y, angle: b.angle + spread, speed: s.speed,
        damage: s.extra.shotDamage * ctx.stats.damageMul * ctx.bonusDamageMul,
        range: s.extra.shotRange * ctx.stats.areaMul, pierce: 0,
      });
    }
    if (b.left <= 0) w.state.burst = undefined;
  },
  fire(ctx, s, w) {
    const c = chest(ctx);
    const target = ctx.nearestEnemy(c.x, c.y, Infinity);
    if (!target) return;
    const dist = Phaser.Math.Distance.Between(c.x, c.y, target.x, target.y);
    const angle = Math.atan2(target.y - c.y, target.x - c.x);
    const range = s.area * ctx.stats.areaMul;
    const shots = projCount(ctx, s, w.def);

    // 斬撃の判定は敵の当たり半径の分だけ手前で切り替える
    if (dist - target.radius <= range) {
      const half = Phaser.Math.DegToRad(s.extra.slashArcDeg / 2);
      const dmg = dmgOf(ctx, s, w.def);
      const stamp = ++hitStamp;
      tmp.length = 0;
      ctx.enemiesInCircle(c.x, c.y, range, tmp);
      for (const e of tmp) {
        if (e.lastHitId === stamp) continue;
        const a = Math.atan2(e.y - c.y, e.x - c.x);
        const d = Phaser.Math.Distance.Between(c.x, c.y, e.x, e.y);
        if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > half && d > e.radius) continue;
        e.lastHitId = stamp;
        ctx.damage(e, dmg, Math.cos(a) * 160, Math.sin(a) * 160);
      }
      ctx.fx.slash(c.x, c.y, range, w.def.color, angle, s.extra.slashArcDeg);
      // 蒼天の連撃：斬撃のあと至近三連射
      if (s.evolved) w.state.burst = { angle, left: shots, timer: 0.1 } as Burst;
    } else {
      w.state.burst = { angle, left: shots, timer: 0 } as Burst;
    }
  },
};

// ───────────────────────── 初期武器（瑞穂・雪人・律花） ─────────────────────────

/** 『怜水閃』：最寄りの敵へ細く長い水圧の突き（連射は 0.08 秒間隔） */
const reisuisen: ArtBehavior = {
  mimicable: false,
  update(dt, ctx, s, w) {
    const b = w.state.burst as Burst | undefined;
    if (!b) return;
    b.timer -= dt;
    if (b.timer <= 0 && b.left > 0) {
      b.left--;
      b.timer = 0.08;
      const c = chest(ctx);
      ctx.fireBullet({
        x: c.x, y: c.y, angle: b.angle + (Math.random() - 0.5) * 0.06, speed: s.speed, damage: dmgOf(ctx, s, w.def),
        range: s.area * ctx.stats.areaMul, pierce: Infinity, texture: 'art_thrust', knockback: 30,
      });
    }
    if (b.left <= 0) w.state.burst = undefined;
  },
  fire(ctx, s, w) {
    const c = chest(ctx);
    const t = ctx.nearestEnemy(c.x, c.y, Infinity);
    if (!t) return;
    w.state.burst = { angle: Math.atan2(t.y - c.y, t.x - c.x), left: projCount(ctx, s, w.def), timer: 0 } as Burst;
  },
};

/** 大剣：進む方向へ180°の薙ぎ払い。進化『アクセル・レイド』：前方へ衝撃波 */
const greatsword: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const angle = facingAngle(ctx);
    const r = s.area * ctx.stats.areaMul;
    const half = Phaser.Math.DegToRad((s.extra.arcDeg ?? 180) / 2);
    const dmg = dmgOf(ctx, s, w.def);
    const stamp = ++hitStamp;
    tmp.length = 0;
    ctx.enemiesInCircle(c.x, c.y, r, tmp);
    for (const e of tmp) {
      if (e.lastHitId === stamp) continue;
      const a = Math.atan2(e.y - c.y, e.x - c.x);
      const d = Phaser.Math.Distance.Between(c.x, c.y, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > half && d > e.radius) continue;
      e.lastHitId = stamp;
      ctx.damage(e, dmg, Math.cos(a) * s.knockback, Math.sin(a) * s.knockback);
    }
    ctx.fx.slash(c.x, c.y, r, w.def.color, angle, s.extra.arcDeg ?? 180);
    ctx.scene.cameras.main.shake(60, 0.002);
    if (s.evolved) {
      ctx.fireBullet({
        x: c.x, y: c.y, angle, speed: 900, damage: s.extra.waveDamage * ctx.stats.damageMul * ctx.bonusDamageMul * ctx.meleeMul,
        range: s.extra.waveRange * ctx.stats.areaMul, pierce: Infinity, texture: 'art_wave', scale: 2, knockback: 120,
      });
    }
  },
};

/** 『焔の猟犬』：炎の玉が敵を追い、当たると小爆発。進化『焔の大狩猟』：倒すたび新しい猟犬 */
const flamehound: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      ctx.fireBullet({
        x: c.x, y: c.y, angle, speed: s.speed, damage: dmgOf(ctx, s, w.def), life: dur(ctx, s), pierce: 0,
        homing: true, turnRate: 4, texture: 'art_hound', scale: 1.1, spin: 5, rotateToVel: false, knockback: 40,
        explodeRadius: s.extra.blastRadius * ctx.stats.areaMul, explodeDamage: s.extra.blastDamage * ctx.stats.damageMul * ctx.bonusDamageMul,
        spawnOnKill: s.evolved, maxSpawned: s.extra.maxHounds,
      });
    }
  },
};

// ───────────────────────── 共鳴アーツ ─────────────────────────

/** 『紅蓮の矢』：向いている方向へ貫通する火矢 */
const guren: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const base = facingAngle(ctx);
    const spread = s.evolved ? 0.16 : 0.1;
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      ctx.fireBullet({
        x: c.x, y: c.y, angle: base + off, speed: s.speed, damage: artDmg(ctx, s, w.def),
        range: s.area * ctx.stats.areaMul, pierce: s.pierce, texture: 'art_arrow',
        scale: s.evolved ? 1.4 : 1, knockback: 90, tint: s.evolved ? 0xff8c00 : undefined,
      });
    }
  },
};

/** 『星屑の裁定』：追尾する星弾。進化『満天の裁定』：画面内の全敵を同時に狙う */
const hoshikuzu: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const life = (s.area * ctx.stats.areaMul) / s.speed + 1.2;
    const dmg = artDmg(ctx, s, w.def);
    if (s.evolved) {
      const targets = ctx.onScreenEnemies().slice(0, 40);
      const n = Math.max(targets.length, projCount(ctx, s, w.def));
      for (let i = 0; i < n; i++) {
        const t = targets[i];
        const angle = t ? Math.atan2(t.y - c.y, t.x - c.x) : Math.random() * Math.PI * 2;
        ctx.fireBullet({
          x: c.x, y: c.y, angle, speed: s.speed * 1.2, damage: dmg, life, pierce: s.pierce, homing: true,
          texture: 'art_star', spin: 8, rotateToVel: false, knockback: 40, tint: 0xfff3a0,
        });
      }
      ctx.fx.ring(c.x, c.y, 90, 0xc0c0ff, 3);
      return;
    }
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      ctx.fireBullet({
        x: c.x, y: c.y, angle, speed: s.speed, damage: dmg, life, pierce: s.pierce, homing: true,
        texture: 'art_star', spin: 6, rotateToVel: false, knockback: 40,
      });
    }
  },
};

/** 『乱れ雪月花』：画面内のランダムな敵の位置に斬撃。進化『雪月風花』：被弾時にも周囲へ斬撃 */
const setsugekka: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const targets = shuffle(ctx.onScreenEnemies().slice()).slice(0, s.count);
    const r = s.area * ctx.stats.areaMul;
    const dmg = artDmg(ctx, s, w.def);
    targets.forEach((t, i) => {
      ctx.scene.time.delayedCall(i * 70, () => {
        if (!t.active) return;
        tmp.length = 0;
        ctx.enemiesInCircle(t.x, t.y, r, tmp);
        for (const e of tmp) ctx.damage(e, dmg, 0, 0);
        ctx.fx.cross(t.x, t.y - 10, r, w.def.color);
      });
    });
  },
  onPlayerHit(ctx, s, w) {
    if (!s.evolved) return;
    const c = chest(ctx);
    const r = (s.extra.counterRadius ?? 150) * ctx.stats.areaMul;
    const dmg = artDmg(ctx, s, w.def);
    tmp.length = 0;
    ctx.enemiesInCircle(c.x, c.y, r, tmp);
    for (const e of tmp) {
      const a = Math.atan2(e.y - c.y, e.x - c.x);
      ctx.damage(e, dmg, Math.cos(a) * 200, Math.sin(a) * 200);
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.7;
      ctx.fx.cross(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, r * 0.5, w.def.color);
    }
  },
};

/** 『リフレッシュの弾丸』：画面端で跳ね返る貫通弾。鈍化 */
const refresh: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const t = ctx.nearestEnemy(c.x, c.y, 600);
      const angle = t ? Math.atan2(t.y - c.y, t.x - c.x) + (i - (n - 1) / 2) * 0.5 : Math.random() * Math.PI * 2;
      ctx.fireBullet({
        x: c.x, y: c.y, angle, speed: s.speed, damage: artDmg(ctx, s, w.def), life: dur(ctx, s),
        pierce: Infinity, bounce: true, slow: s.slow, slowSec: 2.5, texture: 'art_refresh',
        scale: s.evolved ? 1.7 : 1.2, spin: 4, rotateToVel: false, knockback: 30,
      });
    }
  },
};

/** 『強制・修羅場進行』：足元付近に鉄柵（進化『完徹』：数×2・持続×3・鈍化強） */
const shuraba: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    for (let i = 0; i < s.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 40 + Math.random() * 150;
      ctx.addZone({
        x: ctx.player.x + Math.cos(a) * d, y: ctx.player.y + Math.sin(a) * d,
        radius: s.area * ctx.stats.areaMul, duration: dur(ctx, s), dps: artDmg(ctx, s, w.def),
        slow: s.slow, stun: false, color: w.def.color, shape: 'fence',
      });
    }
  },
};

/** 『アクアシールド』：一定時間ダメージを防ぐ盾（進化で回復） */
const aqua: ArtBehavior = {
  mimicable: true,
  update(dt, ctx, s, w) {
    if (w.def.id !== 'aqua') return;
    if (s.evolved && ctx.now < ctx.player.shieldUntil) ctx.player.heal(s.extra.heal * dt);
  },
  fire(ctx, s, w) {
    // 常時無敵の防止：持続は「実効発動間隔 × maxUptime」を上限にする
    const effInterval = s.intervalSec * ctx.stats.intervalMul * ctx.artIntervalMul;
    const duration = Math.min(dur(ctx, s), effInterval * (s.extra.maxUptime ?? 0.6));
    ctx.player.shieldUntil = Math.max(ctx.player.shieldUntil, ctx.now + duration * 1000);
    ctx.fx.ring(ctx.player.x, ctx.player.y - 40, 70, w.def.color, 4);
  },
};

/** 『狐火の御札』：周囲を回り続ける御札（常駐）。進化『九尾の狐火』：9つの狐火・炎上 */
const ofuda: ArtBehavior = {
  mimicable: false,
  fire() {
    /* 常駐型：update で処理 */
  },
  update(dt, ctx, s, w) {
    let orbs = w.state.orbs as Phaser.GameObjects.Image[] | undefined;
    if (!orbs) {
      orbs = [];
      w.state.orbs = orbs;
      w.state.angle = 0;
    }
    const tex = s.evolved ? 'art_foxfire' : 'art_ofuda';
    while (orbs.length < s.count) orbs.push(ctx.scene.add.image(0, 0, tex).setDepth(23));
    if (w.state.tex !== tex) {
      w.state.tex = tex;
      for (const o of orbs) o.setTexture(tex);
    }
    const angle = ((w.state.angle as number) + s.speed * dt) % (Math.PI * 2);
    w.state.angle = angle;
    const radius = s.area * ctx.stats.areaMul;
    const size = CONFIG.spriteScale * s.extra.size;
    const hitR = 12 * s.extra.size;
    const dmg = artDmg(ctx, s, w.def);
    const c = chest(ctx);
    for (let i = 0; i < orbs.length; i++) {
      const a = angle + (i * Math.PI * 2) / orbs.length;
      const o = orbs[i];
      o.setPosition(c.x + Math.cos(a) * radius, c.y + Math.sin(a) * radius).setScale(size).setRotation(s.evolved ? 0 : a + Math.PI / 2);
      o.setAlpha(0.8 + Math.sin(ctx.now / 90 + i) * 0.2);
      tmp.length = 0;
      ctx.enemiesInCircle(o.x, o.y, hitR, tmp);
      for (const e of tmp) {
        if (ctx.now < e.orbitHitUntil) continue;
        e.orbitHitUntil = ctx.now + s.intervalSec * 1000;
        ctx.damage(e, dmg, Math.cos(a + Math.PI / 2) * 80, Math.sin(a + Math.PI / 2) * 80);
        if (s.evolved && s.extra.burnDps) e.burn(s.extra.burnDps * ctx.stats.damageMul * ctx.artDamageMul, s.extra.burnSec ?? 3, ctx.now);
      }
    }
  },
};

/** 『岩牙』：移動方向へ短い直線状の地割れ */
function gangaWave(ctx: BattleContext, s: ArtStats, def: WeaponDef, offset: number, color: number): void {
  const c = chest(ctx);
  const a = facingAngle(ctx);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const len = s.area * ctx.stats.areaMul;
  const halfW = (s.extra.width * ctx.stats.areaMul) / 2;
  const sx = c.x + dx * offset;
  const sy = c.y + dy * offset;
  const dmg = artDmg(ctx, s, def);
  tmp.length = 0;
  ctx.enemiesInCircle(sx + dx * len * 0.5, sy + dy * len * 0.5, len * 0.6 + halfW, tmp);
  for (const e of tmp) {
    const ex = e.x - sx;
    const ey = e.y - sy;
    const along = ex * dx + ey * dy;
    const perp = Math.abs(-ex * dy + ey * dx);
    if (along < -e.radius || along > len + e.radius || perp > halfW + e.radius) continue;
    ctx.damage(e, dmg, dx * s.knockback, dy * s.knockback);
  }
  ctx.fx.line(sx, sy, sx + dx * len, sy + dy * len, halfW * 2, color);
}

const ganga: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const color = s.evolved ? 0xd2691e : w.def.color;
    for (let i = 0; i < s.count; i++) {
      const off = i * s.area * 0.55;
      if (i === 0) gangaWave(ctx, s, w.def, 0, color);
      else ctx.scene.time.delayedCall(i * 140, () => gangaWave(ctx, s, w.def, off, color));
    }
    ctx.scene.cameras.main.shake(80, 0.003);
  },
};

/** 『円』：周囲360°を一閃（進化で波紋） */
function enSlash(ctx: BattleContext, radius: number, dmg: number, kb: number, color: number): void {
  const c = chest(ctx);
  tmp.length = 0;
  ctx.enemiesInCircle(c.x, c.y, radius, tmp);
  for (const e of tmp) {
    const a = Math.atan2(e.y - c.y, e.x - c.x);
    ctx.damage(e, dmg, Math.cos(a) * kb, Math.sin(a) * kb);
  }
  ctx.fx.ring(c.x, c.y, radius, color, 6);
}

const en: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const r = s.area * ctx.stats.areaMul;
    enSlash(ctx, r, artDmg(ctx, s, w.def), s.knockback, w.def.color);
    if (s.evolved) {
      const ripple = s.extra.ripple ?? 1.9;
      ctx.scene.time.delayedCall(220, () => enSlash(ctx, r * ripple, artDmg(ctx, s, w.def) * 0.7, s.knockback * 1.5, 0xff9aa2));
    }
  },
};

/** 『重圧の檻』：最も密集した地点に重力場 */
const cage: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const r = s.area * ctx.stats.areaMul;
    const cands = shuffle(ctx.onScreenEnemies().slice()).slice(0, 60);
    const scored = cands.map((e) => {
      tmp.length = 0;
      return { e, n: ctx.enemiesInCircle(e.x, e.y, r, tmp).length };
    });
    scored.sort((a, b) => b.n - a.n);
    const picked: Enemy[] = [];
    for (const sc of scored) {
      if (picked.length >= s.count) break;
      if (picked.some((p) => Phaser.Math.Distance.Between(p.x, p.y, sc.e.x, sc.e.y) < r)) continue;
      picked.push(sc.e);
    }
    const c = chest(ctx);
    if (picked.length === 0) picked.push({ x: c.x + (Math.random() - 0.5) * 200, y: c.y + (Math.random() - 0.5) * 200 } as Enemy);
    for (const p of picked) {
      ctx.addZone({
        x: p.x, y: p.y, radius: r, duration: dur(ctx, s), dps: artDmg(ctx, s, w.def),
        slow: 0, stun: true, color: w.def.color, shape: 'circle',
      });
    }
  },
};

/** 『物理演算バグ』：最寄りの敵を蹴り飛ばす */
const bug: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const list = ctx.onScreenEnemies().filter((e) => !e.def.boss && !e.fly);
    list.sort((a, b) => Phaser.Math.Distance.Between(c.x, c.y, a.x, a.y) - Phaser.Math.Distance.Between(c.x, c.y, b.x, b.y));
    const dmg = artDmg(ctx, s, w.def);
    for (const e of list.slice(0, s.count)) {
      const a = Math.atan2(e.y - c.y, e.x - c.x);
      ctx.kick(e, a, s.speed, s.duration, dmg);
      ctx.fx.text(e.x, e.y - 40, s.evolved ? 'BV!' : 'BUG!', '#00CED1');
    }
  },
};

/** 『天宮流・舞闘術』：傘のブーメラン（往復で2回当たる）。進化『花傘乱舞』：3本・戻る前に周囲を舞う */
const butou: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const t = ctx.nearestEnemy(c.x, c.y, 700);
    const base = t ? Math.atan2(t.y - c.y, t.x - c.x) : facingAngle(ctx);
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const angle = base + (i - (n - 1) / 2) * 0.55;
      ctx.fireBullet({
        x: c.x, y: c.y, angle, speed: s.speed, damage: artDmg(ctx, s, w.def), pierce: Infinity,
        texture: 'art_umbrella', spin: 12, rotateToVel: false, knockback: 50,
        // 往復：GameScene 側が boomerangDist を見て折り返し・帰還を処理
        life: 8, boomerangDist: s.area * ctx.stats.areaMul,
        orbitSec: s.evolved ? (s.extra.orbitSec ?? 1.2) * ctx.stats.durationMul : 0,
        tint: s.evolved ? 0xffb7c5 : undefined,
      });
    }
  },
};

/** 『物語の具現化』：他のアーツをランダムに再現（操作キャラ自身のアーツは除く） */
const monogatari: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const pool = Object.values(WEAPONS).filter(
      (d) => d.kind === 'art' && d.id !== 'monogatari' && ARTS[d.id].mimicable && !ctx.excludedArts.has(d.id),
    );
    for (let i = 0; i < s.count; i++) {
      const def = pool[Math.floor(Math.random() * pool.length)];
      const st = computeStats(def, w.level, false);
      st.damage *= s.damage;
      ARTS[def.id].fire(ctx, st, w);
      ctx.fx.text(ctx.player.x, ctx.player.y - 110 - i * 26, `『${def.name}』`, '#20B2AA');
    }
  },
};

export const ARTS: Record<string, ArtBehavior> = {
  yoisei,
  reisuisen,
  greatsword,
  flamehound,
  guren,
  hoshikuzu,
  setsugekka,
  refresh,
  shuraba,
  aqua,
  ofuda,
  ganga,
  en,
  cage,
  bug,
  butou,
  monogatari,
};

/** 武器インスタンス生成 */
export function createWeapon(id: string): Weapon {
  const def = WEAPONS[id];
  const behavior = ARTS[id];
  if (!def || !behavior) throw new Error(`unknown weapon: ${id}`);
  return new Weapon(def, behavior);
}
