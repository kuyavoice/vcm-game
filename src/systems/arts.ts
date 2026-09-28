import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { WEAPONS, computeStats, type ArtStats, type WeaponDef } from '../data/weapons';
import type { Enemy } from '../entities/Enemy';
import { Weapon, type ArtBehavior, type BattleContext } from './WeaponSystem';
import { AudioBus } from '../utils/audio';

/** 雪人の斬撃音（大剣・『乱れ雪月花』）。短い間隔で重ねすぎない */
const yukihitoSlashSe = (volumeMul = 1) => AudioBus.play('se_yukihito_slash', 250, 'se_slash', volumeMul);
/** 大剣は鳴る回数が多いので、少し小さく鳴らす（約 −3dB。2026-09-28 ユーザー指定） */
const GREATSWORD_SE_VOLUME = 0.7;

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

interface SecondStrike { timer: number; angle: number; targets: Enemy[] }

/**
 * 大剣の1振り。返り値：当たった敵。
 * sure：範囲の外へ押し出されていても必ず当てる敵（1撃目が当たった敵）。reverse：返し斬り（逆向きに振り抜く見た目）
 */
function swingGreatsword(ctx: BattleContext, s: ArtStats, w: Weapon, angle: number, knockback: number, sure: Enemy[], reverse: boolean): Enemy[] {
  const c = chest(ctx);
  const r = s.area * ctx.stats.areaMul;
  const arc = s.extra.arcDeg ?? 180;
  const half = Phaser.Math.DegToRad(arc / 2);
  const dmg = dmgOf(ctx, s, w.def);
  const stamp = ++hitStamp;
  const hit: Enemy[] = [];
  tmp.length = 0;
  ctx.enemiesInCircle(c.x, c.y, r, tmp);
  for (const e of tmp) {
    if (e.lastHitId === stamp) continue;
    const a = Math.atan2(e.y - c.y, e.x - c.x);
    const d = Phaser.Math.Distance.Between(c.x, c.y, e.x, e.y);
    if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > half && d > e.radius) continue;
    e.lastHitId = stamp;
    hit.push(e);
  }
  // 1撃目で押し出された敵にも届かせる（離れすぎた敵・入れ替わった敵は除く）
  for (const e of sure) {
    if (!e.active || e.lastHitId === stamp) continue;
    if (Phaser.Math.Distance.Between(c.x, c.y, e.x, e.y) > r + e.radius + 80) continue;
    e.lastHitId = stamp;
    hit.push(e);
  }
  for (const e of hit) {
    const a = Math.atan2(e.y - c.y, e.x - c.x);
    ctx.damage(e, dmg, Math.cos(a) * knockback, Math.sin(a) * knockback);
  }
  // 振り抜いた側の縁に白い線を引いて、振りの向き（行き／返し）を見せる
  // 音は1回の攻撃につき1度（1撃目で鳴らし始めると、音の山が返し斬りに重なる）
  if (!reverse) yukihitoSlashSe(GREATSWORD_SE_VOLUME);
  ctx.fx.slash(c.x, c.y, r, reverse ? 0xffffff : w.def.color, angle, arc, false);
  const edge = angle + (reverse ? -half : half);
  ctx.fx.line(c.x, c.y, c.x + Math.cos(edge) * r, c.y + Math.sin(edge) * r, 4, 0xffffff);
  ctx.scene.cameras.main.shake(60, 0.002);
  return hit;
}

/** 大剣：進む方向へ180°の薙ぎ払い → 返し斬りの2連撃。進化『氷狼牙』：2連撃の後、前方へ氷の衝撃波 */
const greatsword: ArtBehavior = {
  mimicable: false,
  update(dt, ctx, s, w) {
    const st = w.state.second as SecondStrike | undefined;
    if (!st) return;
    st.timer -= dt;
    if (st.timer > 0) return;
    w.state.second = undefined;
    swingGreatsword(ctx, s, w, st.angle, 0, st.targets, true);
    if (s.evolved) {
      const c = chest(ctx);
      ctx.fireBullet({
        x: c.x, y: c.y, angle: st.angle, speed: 900, damage: s.extra.waveDamage * ctx.stats.damageMul * ctx.bonusDamageMul * ctx.meleeMul,
        range: s.extra.waveRange * ctx.stats.areaMul, pierce: Infinity, texture: 'art_icewave', scale: 2, knockback: 120,
        freezeSec: s.extra.freezeSec ?? 0.5, chillMul: s.extra.chillMul ?? 0.5,
      });
    }
  },
  fire(ctx, s, w) {
    const angle = facingAngle(ctx);
    const hit = swingGreatsword(ctx, s, w, angle, s.knockback, [], false);
    w.state.second = { timer: s.extra.secondDelaySec ?? 0.2, angle, targets: hit } as SecondStrike;
  },
};

/** 『焔の猟犬』：炎の玉が敵を追い、当たると小爆発＋炎上。進化『焔の大狩猟』：倒すたび新しい猟犬 */
const flamehound: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      ctx.fireBullet({
        x: c.x, y: c.y, angle, speed: s.speed, damage: dmgOf(ctx, s, w.def), life: dur(ctx, s), pierce: 0,
        homing: true, turnRate: s.extra.turnRate ?? 4, texture: 'art_hound', scale: 1.1, spin: 5, rotateToVel: false, knockback: 40,
        burnDps: (s.extra.burnDps ?? 0) * ctx.stats.damageMul * ctx.bonusDamageMul, burnSec: s.extra.burnSec ?? 0,
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
      const targets = ctx.onScreenEnemies().slice(0, CONFIG.hoshikuzuMaxTargets);
      const n = Math.max(targets.length, projCount(ctx, s, w.def));
      for (let i = 0; i < n; i++) {
        const t = targets[i];
        const angle = t ? Math.atan2(t.y - c.y, t.x - c.x) : Math.random() * Math.PI * 2;
        // 進化後は星を大きく・濃い金色にする（淡い色のままだと、まっすぐ飛び去って見失いやすい）
        ctx.fireBullet({
          x: c.x, y: c.y, angle, speed: s.speed * 1.2, damage: dmg, life, pierce: s.pierce, homing: true,
          texture: 'art_star', scale: 1.5, spin: 8, rotateToVel: false, knockback: 40, tint: 0xffd54a,
        });
      }
      // 狙いの光：撃った瞬間、それぞれの敵へ細い光の筋が走る（どこを狙ったかが分かるように）
      if (targets.length > 0) {
        const rays = ctx.scene.add.graphics().setDepth(24);
        rays.lineStyle(2, 0xffe89a, 0.5);
        for (const t of targets) rays.lineBetween(c.x, c.y, t.x, t.y - 10);
        ctx.scene.tweens.add({ targets: rays, alpha: 0, duration: 200, onComplete: () => rays.destroy() });
      }
      ctx.fx.ring(c.x, c.y, 90, 0xffd54a, 3);
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
    if (targets.length > 0) yukihitoSlashSe();
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
    yukihitoSlashSe();
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
        slow: s.slow, stun: false, color: w.def.color, shape: 'fence', source: 'shuraba',
      });
    }
  },
};

/** 『アクアシールド』：一定時間ダメージを防ぐ盾（進化で回復） */
const aqua: ArtBehavior = {
  mimicable: true,
  update(dt, ctx, s, w) {
    if (w.def.id !== 'aqua') return;
    const p = ctx.player;
    const active = ctx.now < p.shieldUntil;
    if (s.evolved && active) p.heal(s.extra.heal * dt);
    // 盾が消えた（時間切れ・割れた）瞬間：周囲へ水のしぶき（Lv6〜）
    if (w.state.wasActive && !active) {
      const broken = p.shieldBrokenAt >= 0 && ctx.now - p.shieldBrokenAt < 200;
      if (broken) ctx.fx.text(p.x, p.y - 110, 'BREAK', '#87CEFA');
      if ((s.extra.burstDamage ?? 0) > 0) {
        const c = chest(ctx);
        const r = (s.extra.burstRadius ?? 140) * ctx.stats.areaMul;
        const dmg = artDmg(ctx, { ...s, damage: s.extra.burstDamage }, w.def);
        tmp.length = 0;
        ctx.enemiesInCircle(c.x, c.y, r, tmp);
        for (const e of tmp) {
          const a = Math.atan2(e.y - c.y, e.x - c.x);
          ctx.damage(e, dmg, Math.cos(a) * s.knockback, Math.sin(a) * s.knockback);
        }
        ctx.fx.ring(c.x, c.y, r, w.def.color, 6);
      }
    }
    w.state.wasActive = active;
  },
  fire(ctx, s, w) {
    // 常時無敵の防止：持続は「実効発動間隔 × maxUptime」を上限にする
    const effInterval = s.intervalSec * ctx.stats.intervalMul * ctx.artIntervalMul;
    const duration = Math.min(dur(ctx, s), effInterval * (s.extra.maxUptime ?? 0.6));
    ctx.player.shieldUntil = Math.max(ctx.player.shieldUntil, ctx.now + duration * 1000);
    ctx.player.shieldHeavyLeft = s.extra.heavyHits ?? 1;
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
        slow: 0, stun: true, color: w.def.color, shape: 'circle', source: 'cage',
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

/** 『換装・散弾』：移動方向の前後へ扇状に散弾 */
const sandan: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const base = facingAngle(ctx);
    const n = projCount(ctx, s, w.def);
    const arc = Phaser.Math.DegToRad(s.extra.arcDeg ?? 30);
    const dmg = artDmg(ctx, s, w.def);
    for (const dir of [base, base + Math.PI]) {
      for (let i = 0; i < n; i++) {
        const off = n > 1 ? (i / (n - 1) - 0.5) * arc : 0;
        ctx.fireBullet({
          x: c.x, y: c.y, angle: dir + off, speed: s.speed * (0.9 + Math.random() * 0.2), damage: dmg,
          range: s.area * ctx.stats.areaMul, pierce: 0, knockback: s.knockback, scale: 0.9, tint: w.def.color,
        });
      }
    }
    ctx.fx.ring(c.x, c.y, 40, w.def.color, 3);
  },
};

/** 『宵星（援護射撃）』：画面内でHPの高い敵へ連射。進化『蒼天の号令』：上位3体を同時に */
const engo: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const targets = ctx.onScreenEnemies().sort((a, b) => b.hp - a.hp).slice(0, s.extra.targets ?? 1);
    if (targets.length === 0) return;
    const shots = projCount(ctx, s, w.def);
    const dmg = artDmg(ctx, s, w.def);
    for (const t of targets) {
      for (let i = 0; i < shots; i++) {
        ctx.scene.time.delayedCall(i * 80, () => {
          if (!t.active) return;
          const angle = Math.atan2(t.y - c.y, t.x - c.x) + (Math.random() - 0.5) * 0.05;
          ctx.fireBullet({ x: ctx.player.x, y: ctx.player.y - 16, angle, speed: s.speed, damage: dmg, range: s.area * ctx.stats.areaMul, pierce: 0, knockback: 60 });
        });
      }
    }
  },
};

// ───────────────────────── 合体アーツ（v2 §5.5） ─────────────────────────

/** 点が三角形の内側か */
/** 『瞬影』：影がプレイヤーの位置に現れ、近くの敵を次々と斬り抜ける。進化『瞬影・双』：影が2体、斬られた敵は鈍る */
const shunei: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const dmg = artDmg(ctx, s, w.def);
    const used = new Set<Enemy>();
    const shadows = s.extra.shadows ?? 1;
    for (let k = 0; k < shadows; k++) {
      // 経路：いまの位置からいちばん近い、まだ斬っていない敵へ順に飛ぶ
      const path: Enemy[] = [];
      let x = c.x;
      let y = c.y;
      let range = s.area * ctx.stats.areaMul;
      for (let i = 0; i < s.count; i++) {
        tmp.length = 0;
        ctx.enemiesInCircle(x, y, range, tmp);
        let best: Enemy | null = null;
        let bd = Infinity;
        for (const e of tmp) {
          if (used.has(e)) continue;
          const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) break;
        used.add(best);
        path.push(best);
        x = best.x;
        y = best.y;
        range = (s.extra.hop ?? 260) * ctx.stats.areaMul;
      }
      if (path.length === 0) continue;

      const step = (s.duration * 1000) / path.length;
      const shade = ctx.scene.add.image(c.x + (k === 0 ? -14 : 14), c.y, 'art_shadow').setDepth(27).setScale(CONFIG.spriteScale).setAlpha(0.75);
      const points = path.map((e) => ({ x: e.x, y: e.y - 10 }));
      ctx.scene.tweens.chain({
        targets: shade,
        tweens: [
          ...points.map((p) => ({ x: p.x, y: p.y, duration: step, ease: 'Cubic.out' })),
          { alpha: 0, duration: 140 },
        ],
        onComplete: () => shade.destroy(),
      });
      path.forEach((e, i) => {
        ctx.scene.time.delayedCall(step * (i + 0.7), () => {
          const from = i === 0 ? { x: c.x, y: c.y } : points[i - 1];
          const to = points[i];
          // 斬撃の軌跡（短く光って消える）
          const g = ctx.scene.add.graphics().setDepth(26);
          g.lineStyle(5, w.def.color, 0.55);
          g.lineBetween(from.x, from.y, to.x, to.y);
          g.lineStyle(2, 0xffffff, 0.95);
          g.lineBetween(from.x, from.y, to.x, to.y);
          ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
          if (!e.active) return;
          const a = Math.atan2(to.y - from.y, to.x - from.x);
          ctx.damage(e, dmg, Math.cos(a) * 60, Math.sin(a) * 60);
          ctx.fx.cross(to.x, to.y, 22, 0xffffff);
          if (e.active && s.slow < 1) e.applySlow(s.slow, s.extra.blindSec ?? 1, ctx.now);
        });
      });
    }
  },
};

/** 『制圧射撃』：進む方向の前方を連射で左右に掃射（1回ごとに向きを変える）。進化『全弾制圧』：150°・貫通 */
const seiatsu: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const n = projCount(ctx, s, w.def);
    const arc = Phaser.Math.DegToRad(s.extra.arcDeg ?? 90);
    const dmg = artDmg(ctx, s, w.def);
    const flip = (w.state.sweep as number | undefined) === 1 ? -1 : 1;
    w.state.sweep = flip;
    for (let i = 0; i < n; i++) {
      ctx.scene.time.delayedCall((i / n) * s.duration * 1000, () => {
        const c = chest(ctx);
        const base = facingAngle(ctx);
        const t = n > 1 ? i / (n - 1) : 0.5;
        const a = base + (t - 0.5) * arc * flip;
        ctx.fireBullet({
          x: c.x + Math.cos(a) * 18, y: c.y + Math.sin(a) * 18, angle: a, speed: s.speed, damage: dmg,
          range: s.area * ctx.stats.areaMul, pierce: s.pierce, texture: 'art_tracer', scale: 1, knockback: 20,
        });
      });
    }
  },
};

function inTriangle(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): boolean {
  const s1 = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
  const s2 = (c.x - b.x) * (py - b.y) - (c.y - b.y) * (px - b.x);
  const s3 = (a.x - c.x) * (py - c.y) - (a.y - c.y) * (px - c.x);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

/** 『トライスター』：白銀の斬撃＋星弾。triangleEvery 回ごとに 空夜・斬撃・星弾 を結ぶ三角の光 */
const tristar: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const list = ctx.onScreenEnemies();
    const dmg = artDmg(ctx, s, w.def);
    // 斬撃（白銀）：extra.slashes か所。三角形の頂点には最初の1か所を使う
    const slashTargets = shuffle(list.slice()).slice(0, s.extra.slashes ?? 1);
    for (const t of slashTargets) {
      tmp.length = 0;
      ctx.enemiesInCircle(t.x, t.y, s.area * ctx.stats.areaMul, tmp);
      for (const e of tmp) ctx.damage(e, dmg, 0, 0);
      ctx.fx.cross(t.x, t.y - 10, s.area * ctx.stats.areaMul, 0xe8f4ff);
    }
    if (slashTargets.length) w.state.slashAt = { x: slashTargets[0].x, y: slashTargets[0].y };
    // 星弾（追尾）
    const star = ctx.nearestEnemy(c.x, c.y, 600);
    for (let i = 0; i < s.count; i++) {
      ctx.fireBullet({ x: c.x, y: c.y, angle: Math.random() * Math.PI * 2, speed: s.speed, damage: dmg * (s.extra.starMul ?? 0.6), life: 2.5, pierce: 1, homing: true, texture: 'art_star', spin: 6, rotateToVel: false, knockback: 40, tint: 0xc0c0ff });
    }
    if (star) w.state.starAt = { x: star.x, y: star.y };
    // 三角形の光
    const n = ((w.state.n as number) ?? 0) + 1;
    w.state.n = n;
    const every = s.extra.triangleEvery ?? 3;
    const A = w.state.slashAt as { x: number; y: number } | undefined;
    const B = w.state.starAt as { x: number; y: number } | undefined;
    if (n % every === 0 && A && B) {
      const P = { x: c.x, y: c.y };
      const tri = artDmg(ctx, { ...s, damage: s.extra.triangleDamage ?? 80 }, w.def);
      for (const e of ctx.onScreenEnemies()) if (inTriangle(e.x, e.y, P, A, B)) ctx.damage(e, tri, 0, 0);
      const g = ctx.scene.add.graphics().setDepth(27);
      g.fillStyle(0x87ceeb, 0.18);
      g.fillTriangle(P.x, P.y, A.x, A.y, B.x, B.y);
      g.lineStyle(5, 0xffd700, 0.95);
      g.strokeTriangle(P.x, P.y, A.x, A.y, B.x, B.y);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeTriangle(P.x, P.y, A.x, A.y, B.x, B.y);
      ctx.scene.tweens.add({ targets: g, alpha: 0, duration: 420, onComplete: () => g.destroy() });
      ctx.fx.text(P.x, P.y - 120, 'トライスター', '#FFD700');
    }
  },
};

/** 『夢見る猫箱』：1回分の被弾を防ぐ盾（割れて shieldRegenSec 秒で再生）＋前方180°へ大きな炎の矢 */
const nekobako: ArtBehavior = {
  mimicable: false,
  update(dt, ctx, s, w) {
    const p = ctx.player;
    if (p.hitShield > 0) {
      w.state.brokenAt = undefined;
      w.state.hadShield = true;
      return;
    }
    // 盾が攻撃を防いで割れた瞬間：アクア・メディックを引き継いでいれば回復
    if (w.state.hadShield) {
      w.state.hadShield = false;
      if (w.state.medic) {
        const heal = s.extra.medicHeal ?? 15;
        p.heal(heal);
        ctx.fx.text(p.x, p.y - 110, `+${heal}`, '#87CEFA');
      }
    }
    if (w.state.brokenAt === undefined) w.state.brokenAt = ctx.now;
    else if (ctx.now - (w.state.brokenAt as number) >= (s.extra.shieldRegenSec ?? 5) * 1000 * (1 / ctx.stats.durationMul)) {
      p.hitShield = 1;
      w.state.brokenAt = undefined;
      ctx.fx.ring(p.x, p.y - 40, 70, 0x87cefa, 4);
    }
  },
  fire(ctx, s, w) {
    const c = chest(ctx);
    const base = facingAngle(ctx);
    const n = projCount(ctx, s, w.def);
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - 0.5) * Math.PI : 0;
      ctx.fireBullet({ x: c.x, y: c.y, angle: base + off, speed: s.speed, damage: artDmg(ctx, s, w.def), range: s.area * ctx.stats.areaMul, pierce: Infinity, texture: 'art_arrow', scale: 2, knockback: 120, tint: 0xff8c69 });
    }
  },
};

/** 『星墜の檻』：前方の半円に星が降り注ぎ、着弾範囲にダメージ＋縫い止め */
const meteocage: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const base = facingAngle(ctx);
    const r = s.area * ctx.stats.areaMul;
    const blast = (s.extra.blastRadius ?? 60) * ctx.stats.areaMul;
    const dmg = artDmg(ctx, s, w.def);
    for (let i = 0; i < s.count; i++) {
      const a = base + (Math.random() - 0.5) * Phaser.Math.DegToRad(s.extra.arcDeg ?? 180);
      const d = 40 + Math.random() * r;
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d;
      const star = ctx.scene.add.image(x, y - 320, 'art_star').setDepth(27).setScale(CONFIG.spriteScale * 1.6).setTint(0xc0c0ff);
      ctx.scene.tweens.add({
        targets: star, y, duration: 450, delay: i * 60, ease: 'Quad.in',
        onComplete: () => {
          star.destroy();
          tmp.length = 0;
          ctx.enemiesInCircle(x, y, blast, tmp);
          for (const e of tmp) {
            ctx.damage(e, dmg, 0, 0);
            e.stun(dur(ctx, s), ctx.now);
            // ディレイ：縫い止めが解けたあとも、しばらく動きが鈍る
            if (s.slow < 1) e.applySlow(s.slow, dur(ctx, s) + (s.extra.slowSec ?? 0), ctx.now);
          }
          ctx.fx.ring(x, y, blast, w.def.color, 4);
        },
      });
    }
  },
};

/** 『本陣の咆哮』：周囲に円形の逆茂木（足止め＋継続ダメージ）＋岩の衝撃波（強ノックバック） */
const honjin: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    ctx.addZone({
      x: ctx.player.x, y: ctx.player.y, radius: (s.extra.fenceRadius ?? 150) * ctx.stats.areaMul, duration: dur(ctx, s),
      dps: (s.extra.fenceDps ?? 15) * ctx.stats.damageMul * ctx.artDamageMul, slow: s.slow, stun: false, color: w.def.color, shape: 'fence', source: 'honjin',
    });
    const r = s.area * ctx.stats.areaMul;
    const dmg = artDmg(ctx, s, w.def);
    tmp.length = 0;
    ctx.enemiesInCircle(c.x, c.y, r, tmp);
    const stunSec = s.extra.stunSec ?? 0;
    for (const e of tmp) {
      const a = Math.atan2(e.y - c.y, e.x - c.x);
      ctx.damage(e, dmg, Math.cos(a) * s.knockback, Math.sin(a) * s.knockback);
      if (stunSec > 0 && e.active) e.stun(stunSec, ctx.now);
    }
    ctx.fx.ring(c.x, c.y, r, w.def.color, 8);
    ctx.scene.cameras.main.shake(90, 0.004);
  },
};

/** 『跳弾バグ』：蹴り飛ばした敵が画面端で最大 bounces 回跳ね返り、ぶつかった敵にダメージ */
const ricochet: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const list = ctx.onScreenEnemies().filter((e) => !e.def.boss && !e.fly);
    list.sort((a, b) => Phaser.Math.Distance.Between(c.x, c.y, a.x, a.y) - Phaser.Math.Distance.Between(c.x, c.y, b.x, b.y));
    const dmg = artDmg(ctx, s, w.def);
    for (const e of list.slice(0, s.count)) {
      const a = Math.atan2(e.y - c.y, e.x - c.x);
      ctx.kick(e, a, s.speed, s.duration, dmg);
      if (e.fly) e.fly.bounces = s.extra.bounces ?? 5;
      ctx.fx.text(e.x, e.y - 40, 'GLITCH', '#00CED1');
    }
    // 響の跳ね返る弾（飛んでいる敵に当たると加速させる）
    const t = ctx.nearestEnemy(c.x, c.y, 600);
    const aim = t ? Math.atan2(t.y - c.y, t.x - c.x) : Math.random() * Math.PI * 2;
    const shots = s.extra.shots ?? 1;
    for (let i = 0; i < shots; i++) {
      ctx.fireBullet({
        x: c.x, y: c.y, angle: aim + (i - (shots - 1) / 2) * 0.5,
        speed: s.extra.shotSpeed ?? 420, damage: artDmg(ctx, { ...s, damage: s.extra.shotDamage ?? 14 }, w.def), life: (s.extra.shotLife ?? 6) * ctx.stats.durationMul,
        pierce: Infinity, bounce: true, slow: s.slow, slowSec: 2.5, texture: 'art_refresh',
        scale: 1.2, spin: 4, rotateToVel: false, knockback: 30,
      });
    }
  },
};

/** 点と線分の距離 */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/** 『貫通チャーハン』：移動方向へ一直線。通り道にスパイスの帯（受けるダメージ増加）。進化『運命のチャーハン』：三方向 */
const chahan: ArtBehavior = {
  mimicable: true,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const base = facingAngle(ctx);
    const n = projCount(ctx, s, w.def);
    const len = s.area * ctx.stats.areaMul;
    const half = (s.extra.width * ctx.stats.areaMul) / 2;
    const dmg = artDmg(ctx, s, w.def);
    const spread = Phaser.Math.DegToRad(s.extra.spreadDeg ?? 28);
    const touched: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const x2 = c.x + Math.cos(a) * len;
      const y2 = c.y + Math.sin(a) * len;
      tmp.length = 0;
      ctx.enemiesInCircle((c.x + x2) / 2, (c.y + y2) / 2, len / 2 + half, tmp);
      for (const e of tmp) {
        if (distToSegment(e.x, e.y, c.x, c.y, x2, y2) > half + e.radius) continue;
        ctx.damage(e, dmg, Math.cos(a) * 60, Math.sin(a) * 60);
        if (e.active && !touched.includes(e)) touched.push(e);
      }
      ctx.fx.line(c.x, c.y, x2, y2, Math.max(18, half * 2), 0xf2c14e);
      ctx.addZone({
        x: (c.x + x2) / 2, y: (c.y + y2) / 2, radius: len / 2 + half, duration: dur(ctx, s),
        dps: (s.extra.bandDps ?? 2) * ctx.stats.damageMul * ctx.artDamageMul, slow: 1, stun: false, color: w.def.color,
        shape: 'band', source: 'chahan', x1: c.x, y1: c.y, x2, y2, halfWidth: half,
        vuln: s.extra.vuln ?? 0.25, dropChance: s.evolved ? (s.extra.dropChance ?? 0) : 0,
      });
    }
    // 包丁（Lv4〜）：帯の中の敵へ飛ぶ。いま放った直線上の敵と、残っている帯の中の敵が対象
    const knives = s.extra.knives ?? 0;
    if (knives > 0) {
      for (const e of ctx.onScreenEnemies()) if (ctx.now < e.vulnUntil && !touched.includes(e)) touched.push(e);
      touched.sort((a, b) => Phaser.Math.Distance.Between(c.x, c.y, a.x, a.y) - Phaser.Math.Distance.Between(c.x, c.y, b.x, b.y));
      const kd = artDmg(ctx, { ...s, damage: s.extra.knifeDamage ?? 15 }, w.def);
      touched.slice(0, knives).forEach((t, i) => {
        ctx.scene.time.delayedCall(120 + i * 90, () => {
          if (!t.active) return;
          const p = chest(ctx);
          ctx.fireBullet({ x: p.x, y: p.y, angle: Math.atan2(t.y - p.y, t.x - p.x), speed: 760, damage: kd, range: 700, pierce: 0, homing: true, turnRate: 5, texture: 'art_knife', scale: 1.2, spin: 14, rotateToVel: false, knockback: 50 });
        });
      });
    }
    ctx.scene.cameras.main.shake(50, 0.002);
  },
};

/** 『白銀の残響』（雪人専用）：最も強い敵へ空夜の弾 → 着弾点に白銀の斬撃が続けて走る → 周りへ星の光弾 */
const hakugin: ArtBehavior = {
  mimicable: false,
  fire(ctx, s, w) {
    const c = chest(ctx);
    const target = ctx.onScreenEnemies().sort((a, b) => b.hp - a.hp)[0];
    if (!target) return;
    const x = s.extra;
    const shotDmg = artDmg(ctx, { ...s, damage: x.shotDamage ?? 20 }, w.def);
    const slashDmg = artDmg(ctx, s, w.def);
    const starDmg = artDmg(ctx, { ...s, damage: x.starDamage ?? 15 }, w.def);
    const r = s.area * ctx.stats.areaMul;
    // 着弾点：狙った敵の今の位置（途中で倒れたら、最後に居た場所）
    const at = { x: target.x, y: target.y };
    const track = () => { if (target.active) { at.x = target.x; at.y = target.y; } };
    // ① 空夜の弾（スカイブルー）
    for (let i = 0; i < (x.shots ?? 3); i++) {
      ctx.scene.time.delayedCall(i * 80, () => {
        track();
        const p = chest(ctx);
        ctx.fireBullet({ x: p.x, y: p.y, angle: Math.atan2(at.y - p.y, at.x - p.x), speed: s.speed, damage: shotDmg, range: 1400, pierce: 0, knockback: 60, tint: 0x87ceeb, scale: 1.3 });
      });
    }
    const hitMs = Math.min(600, (Phaser.Math.Distance.Between(c.x, c.y, target.x, target.y) / s.speed) * 1000);
    // ② 白銀の斬撃が、残響のように続けて走る（1回ごとに少し大きく広がる見た目）
    for (let i = 0; i < (x.slashes ?? 3); i++) {
      ctx.scene.time.delayedCall(hitMs + i * (x.echoMs ?? 180), () => {
        track();
        tmp.length = 0;
        ctx.enemiesInCircle(at.x, at.y, r, tmp);
        for (const e of tmp) ctx.damage(e, slashDmg, 0, 0);
        ctx.fx.cross(at.x, at.y - 10, r * (1 + i * 0.15), 0xe8f4ff);
        ctx.fx.ring(at.x, at.y - 10, r * (0.7 + i * 0.25), 0xe8f4ff, 3);
        if (i === 0) yukihitoSlashSe();
      });
    }
    // ③ 星の光弾（金色）が、着弾点の周りへ降る
    ctx.scene.time.delayedCall(hitMs, () => {
      track();
      const n = x.stars ?? 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.fireBullet({
          x: at.x + Math.cos(a) * 150, y: at.y + Math.sin(a) * 150 - 60, angle: a + Math.PI, speed: 420, damage: starDmg, life: 2.2, pierce: 1,
          homing: true, texture: 'art_star', scale: 1.2, spin: 6, rotateToVel: false, knockback: 40, tint: 0xffd54a,
        });
      }
    });
  },
};

interface Beam { angle: number; left: number; tick: number; gfx: Phaser.GameObjects.Graphics }

/** 『シャイニング・レイ』（詩音専用）：敵が最も多い方向へ、画面の端まで貫く光線。3色の光が螺旋状に混ざる */
const shiningray: ArtBehavior = {
  mimicable: false,
  update(dt, ctx, s, w) {
    const b = w.state.beam as Beam | undefined;
    if (!b) return;
    const g = b.gfx;
    g.clear();
    if (b.left <= 0) return;
    const total = dur(ctx, s);
    b.left -= dt;
    const c = chest(ctx);
    const dx = Math.cos(b.angle);
    const dy = Math.sin(b.angle);
    const len = s.area;
    const half = ((s.extra.width ?? 120) * ctx.stats.areaMul) / 2;
    b.tick -= dt;
    if (b.tick <= 0) {
      b.tick += s.extra.tickSec ?? 0.25;
      const dmg = artDmg(ctx, s, w.def);
      for (const e of ctx.onScreenEnemies()) {
        const ex = e.x - c.x;
        const ey = e.y - c.y;
        const along = ex * dx + ey * dy;
        if (along < -e.radius || along > len) continue;
        if (Math.abs(-ex * dy + ey * dx) > half + e.radius) continue;
        ctx.damage(e, dmg, dx * 40, dy * 40);
      }
    }
    // 見た目：白い芯＋3色（スカイブルー・白銀・金）の波が螺旋のように絡む
    const k = Math.max(0, Math.min(1, b.left / 0.25, (total - b.left) / 0.12));
    const ex = c.x + dx * len;
    const ey = c.y + dy * len;
    g.lineStyle(half * 2, 0xffffff, 0.14 * k);
    g.lineBetween(c.x, c.y, ex, ey);
    g.lineStyle(half * 1.1, 0xfff6c8, 0.32 * k);
    g.lineBetween(c.x, c.y, ex, ey);
    g.lineStyle(half * 0.35, 0xffffff, 0.85 * k);
    g.lineBetween(c.x, c.y, ex, ey);
    const colors = [0x87ceeb, 0xe8f4ff, 0xffd54a];
    const t = ctx.now / 1000;
    for (let ci = 0; ci < colors.length; ci++) {
      g.lineStyle(5, colors[ci], 0.9 * k);
      g.beginPath();
      for (let d = 0; d <= len; d += 26) {
        const off = Math.sin(d / 75 - t * 10 + ci * 2.094) * half * 0.8;
        const px = c.x + dx * d - dy * off;
        const py = c.y + dy * d + dx * off;
        if (d === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
  },
  fire(ctx, s, w) {
    const c = chest(ctx);
    const half = ((s.extra.width ?? 120) * ctx.stats.areaMul) / 2;
    // 敵が最も多い方向（ボスは3体分に数える）。敵が居なければ、向いている方向
    const list = ctx.onScreenEnemies();
    let best = facingAngle(ctx);
    let bestScore = 0;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let score = 0;
      for (const e of list) {
        const ex = e.x - c.x;
        const ey = e.y - c.y;
        if (ex * dx + ey * dy < 0) continue;
        if (Math.abs(-ex * dy + ey * dx) > half + e.radius) continue;
        score += e.def.boss ? 3 : 1;
      }
      if (score > bestScore) { bestScore = score; best = a; }
    }
    let b = w.state.beam as Beam | undefined;
    if (!b) {
      b = { angle: best, left: 0, tick: 0, gfx: ctx.scene.add.graphics().setDepth(26) };
      w.state.beam = b;
    }
    b.angle = best;
    b.left = dur(ctx, s);
    b.tick = 0;
    ctx.scene.cameras.main.shake(140, 0.004);
    ctx.fx.text(c.x, c.y - 110, 'シャイニング・レイ', '#FFD54A');
    AudioBus.play('se_special', 400);
  },
};

/** 『星屑の裁定』（詩音の初期武器）：挙動は共鳴アーツ版と同じ */
const hoshikuzuMain: ArtBehavior = { mimicable: false, fire: (ctx, s, w) => hoshikuzu.fire(ctx, s, w) };

export const ARTS: Record<string, ArtBehavior> = {
  yoisei,
  reisuisen,
  greatsword,
  flamehound,
  hoshikuzu_main: hoshikuzuMain,
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
  sandan,
  engo,
  shunei,
  seiatsu,
  chahan,
  tristar,
  hakugin,
  shiningray,
  nekobako,
  meteocage,
  honjin,
  ricochet,
};

/** 武器インスタンス生成 */
export function createWeapon(id: string): Weapon {
  const def = WEAPONS[id];
  const behavior = ARTS[id];
  if (!def || !behavior) throw new Error(`unknown weapon: ${id}`);
  return new Weapon(def, behavior);
}
