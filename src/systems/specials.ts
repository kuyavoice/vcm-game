import Phaser from 'phaser';
import { AudioBus } from '../utils/audio';
import type { SpecialId } from '../data/characters';
import type { Enemy } from '../entities/Enemy';
import type { BattleContext } from './WeaponSystem';

/** 必殺の挙動。GameScene が activate → 毎ステップ update → 終了時 end を呼ぶ */
export interface SpecialBehavior {
  durationSec: number;
  activate: (ctx: BattleContext, host: SpecialHost) => void;
  update?: (dt: number, ctx: BattleContext, host: SpecialHost) => void;
  end?: (ctx: BattleContext, host: SpecialHost) => void;
}

export interface SpecialHost {
  state: Record<string, unknown>;
}

const tmp: Enemy[] = [];

/** 『魂の共鳴』（空夜）：倍率は GameScene 側が ctx.artDamageMul / artIntervalMul に反映 */
const soulConnect: SpecialBehavior = {
  durationSec: 10,
  activate(ctx) {
    ctx.fx.ring(ctx.player.x, ctx.player.y - 40, 260, 0x87ceeb, 8);
  },
};

/** 『流麗なる水衣』（瑞穂）：2本の水流が自律して周囲の敵を迎撃。被ダメージ−70%（GameScene 側） */
const aquaLament: SpecialBehavior = {
  durationSec: 10,
  activate(ctx, host) {
    const streams: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 2; i++) streams.push(ctx.scene.add.image(ctx.player.x, ctx.player.y - 16, 'art_stream').setDepth(27).setScale(3));
    host.state.streams = streams;
    host.state.angle = 0;
    ctx.fx.ring(ctx.player.x, ctx.player.y - 40, 200, 0x87cefa, 6);
  },
  update(dt, ctx, host) {
    const streams = host.state.streams as Phaser.GameObjects.Image[];
    const p = ctx.player;
    const base = ((host.state.angle as number) + dt * 2.2) % (Math.PI * 2);
    host.state.angle = base;
    streams.forEach((st, i) => {
      // 近くの敵を追う。いなければプレイヤーの周りを回る
      const t = ctx.nearestEnemy(st.x, st.y, 260);
      let tx: number;
      let ty: number;
      if (t) {
        tx = t.x;
        ty = t.y;
      } else {
        const a = base + i * Math.PI;
        tx = p.x + Math.cos(a) * 120;
        ty = p.y - 16 + Math.sin(a) * 120;
      }
      const d = Math.hypot(tx - st.x, ty - st.y) || 1;
      const spd = 520;
      st.x += ((tx - st.x) / d) * Math.min(spd * dt, d);
      st.y += ((ty - st.y) / d) * Math.min(spd * dt, d);
      // プレイヤーから離れすぎない
      const pd = Math.hypot(st.x - p.x, st.y - (p.y - 16));
      if (pd > 320) {
        st.x = p.x + ((st.x - p.x) / pd) * 320;
        st.y = p.y - 16 + ((st.y - (p.y - 16)) / pd) * 320;
      }
      st.setRotation(Math.atan2(ty - st.y, tx - st.x)).setAlpha(0.8 + Math.sin(ctx.now / 70 + i) * 0.2);
      tmp.length = 0;
      ctx.enemiesInCircle(st.x, st.y, 34, tmp);
      for (const e of tmp) {
        if (ctx.now < e.orbitHitUntil) continue;
        e.orbitHitUntil = ctx.now + 300;
        ctx.damage(e, 20 * ctx.stats.damageMul, 0, 0);
      }
    });
  },
  end(_ctx, host) {
    for (const st of (host.state.streams as Phaser.GameObjects.Image[]) ?? []) st.destroy();
    host.state.streams = [];
  },
};

/** 『乱れ雪月花』（雪人）：3秒間、画面内のランダムな敵に斬撃が計30回 */
const setsugekkaUlt: SpecialBehavior = {
  durationSec: 3,
  activate(_ctx, host) {
    host.state.timer = 0;
    host.state.left = 30;
  },
  update(dt, ctx, host) {
    let timer = (host.state.timer as number) + dt;
    let left = host.state.left as number;
    while (timer >= 0.1 && left > 0) {
      timer -= 0.1;
      left--;
      const list = ctx.onScreenEnemies();
      if (list.length === 0) continue;
      const t = list[Math.floor(Math.random() * list.length)];
      tmp.length = 0;
      ctx.enemiesInCircle(t.x, t.y, 70, tmp);
      for (const e of tmp) ctx.damage(e, 40 * ctx.stats.damageMul * ctx.meleeMul, 0, 0);
      ctx.fx.cross(t.x, t.y - 10, 70, 0xe8f4ff);
      AudioBus.play('se_yukihito_slash', 250, 'se_slash');
    }
    host.state.timer = timer;
    host.state.left = left;
  },
};

/** 『エンジェリック・ランブル』（律花）：画面内の全ての敵にダメージ80＋炎上（5秒・毎秒5） */
const angelicRumble: SpecialBehavior = {
  durationSec: 0.6,
  activate(ctx) {
    ctx.scene.cameras.main.flash(400, 255, 200, 160);
    ctx.scene.cameras.main.shake(250, 0.008);
    for (const e of ctx.onScreenEnemies()) {
      ctx.damage(e, 80 * ctx.stats.damageMul, 0, 0);
      if (e.active) e.burn(5 * ctx.stats.damageMul, 5, ctx.now, true);
    }
    ctx.fx.ring(ctx.player.x, ctx.player.y - 40, 420, 0xff4500, 10);
  },
};

/** 『星海の祝詞』（詩音）：発動時にHP全回復。3秒間、星の雨が画面内の全ての敵に降る（25×10回） */
const starPrayer: SpecialBehavior = {
  durationSec: 3,
  activate(ctx, host) {
    const p = ctx.player;
    p.heal(p.maxHp);
    host.state.timer = 0;
    host.state.left = 10;
    ctx.fx.ring(p.x, p.y - 40, 300, 0xc0c0ff, 8);
  },
  update(dt, ctx, host) {
    let timer = (host.state.timer as number) + dt;
    let left = host.state.left as number;
    const view = ctx.scene.cameras.main.worldView;
    // 見た目の星の雨（当たり判定はなし）
    for (let i = 0; i < 3; i++) {
      const x = view.left + Math.random() * view.width;
      const y = view.top + Math.random() * view.height;
      const star = ctx.scene.add.image(x + 60, y - 260, 'art_star').setDepth(27).setScale(1.4 + Math.random() * 1.4).setTint(0xfff3a0).setAlpha(1);
      ctx.scene.tweens.add({ targets: star, x, y, alpha: 0.45, duration: 380, ease: 'Quad.in', onComplete: () => star.destroy() });
    }
    while (timer >= 0.3 && left > 0) {
      timer -= 0.3;
      left--;
      for (const e of ctx.onScreenEnemies()) {
        ctx.damage(e, 25 * ctx.stats.damageMul, 0, 0);
        if (Math.random() < 0.35) ctx.fx.cross(e.x, e.y - 10, 26, 0xfff3a0);
      }
    }
    host.state.timer = timer;
    host.state.left = left;
  },
};

export const SPECIALS: Record<SpecialId, SpecialBehavior> = {
  soul_connect: soulConnect,
  aqua_lament: aquaLament,
  setsugekka_ult: setsugekkaUlt,
  angelic_rumble: angelicRumble,
  star_prayer: starPrayer,
};
