import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { resolveCharacter } from '../utils/unlock';
import { STAGES, type StageDef } from '../data/stages';
import { SCORE_STAGE } from '../data/score';
import { NIGHTMARE_STAGE, NIGHTMARE_AVAILABLE } from '../data/nightmare';
import { ENDLESS_STAGE, isEndlessShown, endlessLoop } from '../data/endless';
import { RUSH_STAGE } from '../data/rush';
import { ARENA_STAGE, ARENA } from '../data/arena';
import { unlockSecret } from '../utils/unlock';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, isStageUnlocked } from '../utils/storage';
import { rankName, rankImageKey, type RankName } from '../data/ranks';
import { SelectGuard } from '../ui/SelectGuard';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel } from '../ui/theme';
import { t } from '../utils/lang';
import { isJudge } from '../utils/unlock';
import { AudioBus } from '../utils/audio';

/** 1枚のカード（アコーディオン）。gfx は高さが変わるたびに描き直す */
interface StageCard {
  cont: Phaser.GameObjects.Container;
  st: StageDef;
  unlocked: boolean;
  gfx: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
  desc?: Phaser.GameObjects.Text;
  hint?: Phaser.GameObjects.Text;
  best?: Phaser.GameObjects.Text;
  emblem?: Phaser.GameObjects.Image;
  lock?: Phaser.GameObjects.Text;
  /** 闘技場の直近の記録（広げたときだけ） */
  history?: Phaser.GameObjects.Text;
}

/** ステージ選択（タイトル → ここ → ゲーム）。前ステージのクリアで解放 */
export class StageSelectScene extends Phaser.Scene {
  /** 前回選んだカード（同じ起動の間だけ覚える） */
  static lastIndex = 0;

  constructor() {
    super('StageSelect');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    wipeIn(this, { cascade: false });
    AudioBus.leaveGameOver();

    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);
    const onResize = () => bg.setSize(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', onResize));
    this.events.on('update', () => { bg.tilePositionY -= 0.15; });

    this.add.text(W / 2, H * 0.11, 'SELECT STAGE', {
      fontFamily: FONT_EN, fontSize: '56px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.11 + 48, t('どの夜に、声を取り戻しに行く？', 'Which night will you go to, to bring the voice back?'), {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    // スコアアタックをクリア済みなのに隠し要素が未解放のセーブ（古い版でクリアした場合）を、ここで揃える
    if (loadSave().cleared.includes(SCORE_STAGE.id)) unlockSecret('shion');
    const save = loadSave();
    const characterId = resolveCharacter(save);
    const guard = new SelectGuard(this);
    const cardW = Math.min(640, W - 40);
    const allStages = [...STAGES, SCORE_STAGE, ...(NIGHTMARE_AVAILABLE ? [NIGHTMARE_STAGE] : []), ...(isEndlessShown() ? [ENDLESS_STAGE] : []), RUSH_STAGE, ARENA_STAGE];
    // 解放の条件：スコアアタックは全ステージのクリア。ほかは、決まったステージのクリア
    // `?debug` のときは、エンドレスを解放済みとして扱う（本当に解放していなければ、記録は保存しない。GameScene 側）
    const debug = /[?&]debug(?:[&=]|$)/.test(location.search);
    // 審査モード（?judge）は全部開く（記録は保存しない。GameScene 側）
    const isOpen = (st: StageDef) => isJudge() || (st.endless && debug) || (st.scoreMode && !st.endless ? STAGES.every((x) => save.cleared.includes(x.id)) : isStageUnlocked(save, st.unlockAfter));
    // アコーディオン（2026-10-21 ユーザー承認）：8枚になって説明文が入らなくなったので、選んだ1枚だけ広がって説明と記録を見せる。もう一度タップで出撃
    const n = allStages.length;
    const gap = 8;
    const areaTop = H * 0.11 + 104;
    const areaBottom = H - Math.max(90, H * 0.08) - 40;
    const extra = 100;
    const hC = Phaser.Math.Clamp(Math.floor((areaBottom - areaTop - gap * (n - 1) - extra) / n), 64, 96);
    const hE = hC + extra;
    const cards: StageCard[] = [];
    let selected = -1;
    const bestOf = (st: StageDef) => {
      const top = save.endlessRanking[0];
      const rb = save.rushRanking[0];
      const ar = save.arena;
      const best = st.arena ? (ar.history.length > 0 ? { kills: 0, timeSec: ar.bestTimeSec ?? 0, cleared: ar.bestTimeSec !== null, arena: true, reached: ar.reached } : undefined) : st.rush ? (rb ? { kills: 0, timeSec: rb.timeSec, cleared: true, loop: save.rushMaxLoops?.loops ?? rb.loops, rush: true } : undefined) : st.endless ? (top ? { kills: top.kills, timeSec: top.timeSec, cleared: true, loop: endlessLoop(top.timeSec) } : undefined) : st.scoreMode ? (save.scoreRanking[0] ? { kills: save.scoreRanking[0].kills, timeSec: save.scoreRanking[0].timeSec, cleared: save.scoreRanking[0].cleared, score: save.scoreRanking[0].score } : undefined) : save.bests[String(st.id)];
      // 最高ランク（2026-10-19）
      const rk = rankName(save.ranks[String(st.id)]);
      return best ? { ...best, rank: rk } : undefined;
    };
    const start = (st: StageDef) => {
      // ボスラッシュと闘技場は、アーツを選ぶ画面を挟む
      if (st.rush) go(this, 'RushSetup', { characterId });
      else if (st.arena) go(this, 'RushSetup', { characterId, arena: true });
      else go(this, 'Game', { characterId, stageId: st.id });
    };
    const layout = (animate: boolean) => {
      const total = hC * (n - 1) + hE + gap * (n - 1);
      let y = areaTop + Math.max(0, (areaBottom - areaTop - total) / 2);
      cards.forEach((c, i) => {
        const h = i === selected ? hE : hC;
        this.redrawCard(c, h, i === selected, cardW);
        if (animate) this.tweens.add({ targets: c.cont, y, duration: 180, ease: 'Cubic.out' });
        else c.cont.y = y;
        y += h + gap;
      });
    };
    const select = (i: number) => {
      if (selected === i || !cards[i]?.unlocked) return;
      selected = i;
      StageSelectScene.lastIndex = i;
      layout(true);
    };
    allStages.forEach((st, i) => {
      const unlocked = isOpen(st);
      const c = this.buildCard(st, unlocked, bestOf(st), cardW, hC);
      c.cont.setPosition(W / 2 + 40, 0).setAlpha(0);
      cards.push(c);
      if (unlocked) {
        c.hit.on('pointerdown', () => { guard.press(c.hit); if (guard.armed) c.cont.setScale(0.98); });
        c.hit.on('pointerup', () => {
          c.cont.setScale(1);
          if (!guard.release(c.hit)) return;
          // 1回目のタップは選ぶだけ。release() は一度きりなので reset で次のタップを受け付ける（キャラ選択と同じ）
          if (selected !== i) { AudioBus.play('se_item', 60); select(i); guard.reset(); }
          else start(st);
        });
      }
    });
    // 最初に開くのは、前回選んだもの（解放済みに限る）
    const remembered = cards[StageSelectScene.lastIndex]?.unlocked ? StageSelectScene.lastIndex : Math.max(0, cards.findIndex((c) => c.unlocked));
    selected = remembered;
    layout(false);
    cards.forEach((c, i) => this.tweens.add({ targets: c.cont, alpha: 1, x: W / 2, duration: 220, delay: 50 * i, ease: 'Cubic.out' }));

    makeButton(this, W / 2, H - Math.max(90, H * 0.08), 'CHARACTER', () => go(this, 'CharaSelect'), { width: 260, height: 60, fontSize: 24 });
    this.add.text(W / 2, H * 0.11 + 78, `${CHARACTERS[characterId].name}`, { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.accent, fontStyle: '700' }).setOrigin(0.5);

    // PC：数字キー（1回目で選択、もう一度で出撃）
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const k = parseInt(ev.key, 10);
      const st = allStages[k - 1];
      const ok = st && isOpen(st);
      if (!ok || !guard.confirm()) return;
      if (selected !== k - 1) { select(k - 1); guard.reset(); }
      else start(st);
    });
  }

  /** カードの枠を今の高さで描き直し、広げた中身（説明・案内）の表示を切り替える */
  private redrawCard(c: StageCard, h: number, selected: boolean, cardW: number): void {
    c.gfx.destroy();
    c.gfx = panel(this, -cardW / 2, 0, cardW, h, {
      color: c.unlocked ? c.st.color : 0x3a4a8a, alpha: 1, stroke: selected ? 0xffd700 : undefined, strokeAlpha: selected ? 1 : c.unlocked ? 0.6 : 0.4, stripe: 10, shadow: true,
    }).gfx;
    c.cont.addAt(c.gfx, 0);
    c.hit.setSize(cardW, h).setPosition(0, h / 2);
    c.hit.input?.hitArea.setSize(cardW, h);
    if (c.desc) {
      c.desc.setVisible(selected);
      if (selected) { c.desc.setAlpha(0); this.tweens.add({ targets: c.desc, alpha: 1, duration: 200, delay: 80 }); }
    }
    if (c.history) {
      c.history.setVisible(selected);
      if (selected) { c.history.setAlpha(0); this.tweens.add({ targets: c.history, alpha: 1, duration: 200, delay: 100 }); }
    }
    if (c.hint) {
      c.hint.setVisible(selected).setY(h - 26);
      if (selected) { c.hint.setAlpha(0); this.tweens.add({ targets: c.hint, alpha: 1, duration: 200, delay: 120 }); }
    }
    if (c.best) c.best.setY(h - 9);
    if (c.emblem && c.best) c.emblem.setPosition(c.best.x - c.best.width - 10, c.best.y + 3);
    if (c.lock) c.lock.setY(h - 9);
  }

  private buildCard(st: StageDef, unlocked: boolean, best: { kills: number; timeSec: number; cleared: boolean; score?: number; loop?: number; rush?: boolean; arena?: boolean; reached?: number; rank?: string | null } | undefined, cardW: number, h: number): StageCard {
    const cont = this.add.container(0, 0);
    const gfx = panel(this, -cardW / 2, 0, cardW, h, { color: unlocked ? st.color : 0x3a4a8a, alpha: 1, strokeAlpha: unlocked ? 0.6 : 0.4, stripe: 10, shadow: true }).gfx;
    const nameEn = this.add.text(-cardW / 2 + 30, 9, st.nameEn, {
      fontFamily: FONT_EN, fontSize: '15px', color: unlocked ? Phaser.Display.Color.IntegerToColor(st.color).rgba : COLOR_HEX.dim, fontStyle: '700', letterSpacing: 3,
    });
    const name = this.add.text(-cardW / 2 + 30, 30, st.name, {
      fontFamily: FONT_JP, fontSize: '26px', color: unlocked ? COLOR_HEX.white : '#5A6488', fontStyle: '700',
    });
    cont.add([gfx, nameEn, name]);
    const c: StageCard = { cont, st, unlocked, gfx, hit: this.add.rectangle(0, h / 2, cardW, h, 0xffffff, 0.001).setName('hit') };

    if (unlocked) {
      const mods = this.add.text(cardW / 2 - 18, 9, st.arena ? `${ARENA.bosses.length} BOSSES` : `HP ×${st.enemyHpMul}　SPD ×${st.enemySpeedMul}　NUM ×${st.spawnMul}${st.enemyDamageMul ? `　ATK ×${st.enemyDamageMul}` : ''}`, {
        fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.dim, fontStyle: '700',
      }).setOrigin(1, 0);
      c.desc = this.add.text(-cardW / 2 + 30, 70, st.desc, {
        fontFamily: FONT_JP, fontSize: '17px', color: COLOR_HEX.white, lineSpacing: 4, wordWrap: { width: cardW - 60, useAdvancedWrap: true },
      }).setVisible(false);
      c.hint = this.add.text(-cardW / 2 + 30, h - 26, t('もう一度タップで出撃', 'TAP AGAIN TO START'), {
        fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.accent, fontStyle: '700',
      }).setVisible(false);
      cont.add([mods, c.desc, c.hint]);
      // 闘技場：直近の記録を1行（広げたときだけ）
      if (st.arena) {
        const hs = loadSave().arena.history.slice(0, 3).map((e) => (e.cleared ? `${Math.floor(e.timeSec / 60).toString().padStart(2, '0')}:${Math.floor(e.timeSec % 60).toString().padStart(2, '0')}` : `到達 ${e.reached}/${ARENA.bosses.length}`));
        if (hs.length > 0) {
          c.history = this.add.text(-cardW / 2 + 30, 122, `直近　${hs.join('　／　')}`, { fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.dim }).setVisible(false);
          cont.add(c.history);
        }
      }
      if (best) {
        const mm = Math.floor(best.timeSec / 60).toString().padStart(2, '0');
        const ss = Math.floor(best.timeSec % 60).toString().padStart(2, '0');
        const rkKey = best.rank ? rankImageKey(best.rank as RankName) : '';
        const useImg = !!rkKey && this.textures.exists(rkKey);
        c.best = this.add.text(cardW / 2 - 18, h - 9, (best.rank && !useImg ? `RANK ${best.rank}   ` : '') + (best.arena ? (best.cleared ? `BEST  ${mm}:${ss}  CLEAR` : `REACHED  ${best.reached ?? 0} / ${ARENA.bosses.length}`) : best.rush ? `BEST  ${mm}:${ss}   MAX  ${best.loop} LOOP` : best.loop !== undefined ? `BEST  ${mm}:${ss}  LOOP ${best.loop}` : best.score !== undefined ? `BEST  ${best.score.toLocaleString()} pt  ${mm}:${ss}` : `BEST  ✕ ${best.kills}  ${mm}:${ss}${best.cleared ? '  CLEAR' : ''}`), {
          fontFamily: FONT_EN, fontSize: '15px', color: best.cleared ? COLOR_HEX.gold : COLOR_HEX.accent, fontStyle: '700',
        }).setOrigin(1, 1);
        cont.add(c.best);
        if (useImg) {
          // ランクのエンブレム（2026-10-20）：BEST の左に小さく
          c.emblem = this.add.image(c.best.x - c.best.width - 10, c.best.y + 3, rkKey).setOrigin(1, 1);
          c.emblem.setScale(22 / c.emblem.height);
          cont.add(c.emblem);
        }
      }
      c.hit.setInteractive({ useHandCursor: true });
    } else {
      c.lock = this.add.text(cardW / 2 - 18, h - 9, st.scoreMode && !st.endless ? '全ステージをクリアで解放' : st.unlockAfter === SCORE_STAGE.id ? 'スコアアタックをクリアで解放' : `STAGE ${st.unlockAfter} をクリアで解放`, {
        fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.dim,
      }).setOrigin(1, 1);
      const icon = this.add.text(cardW / 2 - 18, 9, 'LOCKED', {
        fontFamily: FONT_EN, fontSize: '14px', color: '#5A6488', fontStyle: '700', letterSpacing: 3,
      }).setOrigin(1, 0);
      cont.add([c.lock, icon]);
      cont.setAlpha(0.75);
    }
    cont.add(c.hit);
    return c;
  }
}
