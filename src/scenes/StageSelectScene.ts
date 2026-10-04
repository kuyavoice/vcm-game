import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { resolveCharacter } from '../utils/unlock';
import { STAGES, type StageDef } from '../data/stages';
import { SCORE_STAGE } from '../data/score';
import { NIGHTMARE_STAGE, NIGHTMARE_AVAILABLE } from '../data/nightmare';
import { ENDLESS_STAGE, isEndlessShown, endlessLoop } from '../data/endless';
import { RUSH_STAGE } from '../data/rush';
import { unlockSecret } from '../utils/unlock';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, isStageUnlocked } from '../utils/storage';
import { SelectGuard } from '../ui/SelectGuard';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel } from '../ui/theme';
import { AudioBus } from '../utils/audio';

/** ステージ選択（タイトル → ここ → ゲーム）。前ステージのクリアで解放 */
export class StageSelectScene extends Phaser.Scene {
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
    this.add.text(W / 2, H * 0.11 + 48, 'どの夜に、声を取り戻しに行く？', {
      fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    // スコアアタックをクリア済みなのに隠し要素が未解放のセーブ（古い版でクリアした場合）を、ここで揃える
    if (loadSave().cleared.includes(SCORE_STAGE.id)) unlockSecret('shion');
    const save = loadSave();
    const characterId = resolveCharacter(save);
    const guard = new SelectGuard(this);
    const cardW = Math.min(640, W - 40);
    const allStages = [...STAGES, SCORE_STAGE, ...(NIGHTMARE_AVAILABLE ? [NIGHTMARE_STAGE] : []), ...(isEndlessShown() ? [ENDLESS_STAGE] : []), RUSH_STAGE];
    // 解放の条件：スコアアタックは全ステージのクリア。ほかは、決まったステージのクリア
    // `?debug` のときは、エンドレスを解放済みとして扱う（本当に解放していなければ、記録は保存しない。GameScene 側）
    const debug = /[?&]debug(?:[&=]|$)/.test(location.search);
    const isOpen = (st: StageDef) => (st.endless && debug) || (st.scoreMode && !st.endless ? STAGES.every((x) => save.cleared.includes(x.id)) : isStageUnlocked(save, st.unlockAfter));
    // 5枚のときは、見出しと下のボタンの間に収まる高さに詰める
    const compact = allStages.length > 4;
    const gap = allStages.length >= 7 ? 10 : compact ? 12 : 16;
    const areaTop = H * 0.11 + 104;
    const areaBottom = H - Math.max(90, H * 0.08) - 44;
    const cardH = compact ? Math.min(176, Math.floor((areaBottom - areaTop - gap * (allStages.length - 1)) / allStages.length)) : 176;
    const total = allStages.length * cardH + (allStages.length - 1) * gap;
    let y = compact ? (areaTop + areaBottom) / 2 - total / 2 + cardH / 2 : H / 2 - total / 2 + cardH / 2 - 10;

    allStages.forEach((st, i) => {
      const unlocked = isOpen(st);
      const top = save.endlessRanking[0];
      const rb = save.rushRanking[0];
      const best = st.rush ? (rb ? { kills: 0, timeSec: rb.timeSec, cleared: true, loop: rb.loops, rush: true } : undefined) : st.endless ? (top ? { kills: top.kills, timeSec: top.timeSec, cleared: true, loop: endlessLoop(top.timeSec) } : undefined) : st.scoreMode ? (save.scoreRanking[0] ? { kills: save.scoreRanking[0].kills, timeSec: save.scoreRanking[0].timeSec, cleared: save.scoreRanking[0].cleared, score: save.scoreRanking[0].score } : undefined) : save.bests[String(st.id)];
      const cont = this.buildCard(st, unlocked, best, cardW, cardH);
      cont.setPosition(W / 2 + 40, y).setAlpha(0);
      this.tweens.add({ targets: cont, alpha: 1, x: W / 2, duration: 220, delay: 60 * i, ease: 'Cubic.out' });

      if (unlocked) {
        const hit = cont.getByName('hit') as Phaser.GameObjects.Rectangle;
        hit.on('pointerdown', () => { guard.press(hit); if (guard.armed) cont.setScale(0.98); });
        hit.on('pointerup', () => {
          cont.setScale(1);
          if (!guard.release(hit)) return;
          // ボスラッシュは、アーツを選ぶ画面を挟む
          if (st.rush) go(this, 'RushSetup', { characterId });
          else go(this, 'Game', { characterId, stageId: st.id });
        });
      }
      y += cardH + gap;
    });

    makeButton(this, W / 2, H - Math.max(90, H * 0.08), 'CHARACTER', () => go(this, 'CharaSelect'), { width: 260, height: 60, fontSize: 24 });
    this.add.text(W / 2, H * 0.11 + 78, `${CHARACTERS[characterId].name}`, { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.accent, fontStyle: '700' }).setOrigin(0.5);

    // PC：1〜3キー
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = parseInt(ev.key, 10);
      const st = allStages[n - 1];
      const ok = st && isOpen(st);
      if (!ok || !guard.confirm()) return;
      if (st.rush) go(this, 'RushSetup', { characterId });
      else go(this, 'Game', { characterId, stageId: st.id });
    });
  }

  private buildCard(st: StageDef, unlocked: boolean, best: { kills: number; timeSec: number; cleared: boolean; score?: number; loop?: number; rush?: boolean } | undefined, cardW: number, cardH: number): Phaser.GameObjects.Container {
    // 6枚のときは、さらに詰める
    const tight = cardH < 150;
    const cont = this.add.container(0, 0);
    const card = panel(this, -cardW / 2, -cardH / 2, cardW, cardH, { color: unlocked ? st.color : 0x3a4a8a, alpha: 1, strokeAlpha: unlocked ? 0.9 : 0.5, stripe: 10, shadow: true }).gfx;
    const nameEn = this.add.text(-cardW / 2 + 32, -cardH / 2 + (tight ? 10 : 18), st.nameEn, {
      fontFamily: FONT_EN, fontSize: tight ? '17px' : '20px', color: unlocked ? Phaser.Display.Color.IntegerToColor(st.color).rgba : COLOR_HEX.dim, fontStyle: '700', letterSpacing: 4,
    });
    const name = this.add.text(-cardW / 2 + 32, -cardH / 2 + (tight ? 32 : 44), st.name, {
      fontFamily: FONT_JP, fontSize: tight ? '28px' : '34px', color: unlocked ? COLOR_HEX.white : '#5A6488', fontStyle: '700',
    });
    cont.add([card, nameEn, name]);

    if (unlocked) {
      const desc = this.add.text(-cardW / 2 + 32, -cardH / 2 + (tight ? 72 : 96), st.desc, {
        fontFamily: FONT_JP, fontSize: tight ? '17px' : '19px', color: COLOR_HEX.white, wordWrap: { width: cardW - 64, useAdvancedWrap: true },
      });
      const mods = this.add.text(cardW / 2 - 20, -cardH / 2 + (tight ? 10 : 18), `HP ×${st.enemyHpMul}　SPD ×${st.enemySpeedMul}　NUM ×${st.spawnMul}${st.enemyDamageMul ? `　ATK ×${st.enemyDamageMul}` : ''}`, {
        fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.dim, fontStyle: '700',
      }).setOrigin(1, 0);
      cont.add([desc, mods]);
      if (best) {
        const mm = Math.floor(best.timeSec / 60).toString().padStart(2, '0');
        const ss = Math.floor(best.timeSec % 60).toString().padStart(2, '0');
        const bestText = this.add.text(cardW / 2 - 20, cardH / 2 - (tight ? 8 : 16), best.rush ? `BEST  ${mm}:${ss}  ×${best.loop} LOOP` : best.loop !== undefined ? `BEST  ${mm}:${ss}  LOOP ${best.loop}` : best.score !== undefined ? `BEST  ${best.score.toLocaleString()} pt  ${mm}:${ss}` : `BEST  ✕ ${best.kills}  ${mm}:${ss}${best.cleared ? '  CLEAR' : ''}`, {
          fontFamily: FONT_EN, fontSize: '16px', color: best.cleared ? COLOR_HEX.gold : COLOR_HEX.accent, fontStyle: '700',
        }).setOrigin(1, 1);
        cont.add(bestText);
      }
    } else {
      const lock = this.add.text(-cardW / 2 + 32, -cardH / 2 + (tight ? 82 : 100), st.scoreMode && !st.endless ? '全ステージをクリアで解放' : st.unlockAfter === SCORE_STAGE.id ? 'スコアアタックをクリアで解放' : `STAGE ${st.unlockAfter} をクリアで解放`, {
        fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.dim,
      });
      const icon = this.add.text(cardW / 2 - 24, -cardH / 2 + 14, 'LOCKED', {
        fontFamily: FONT_EN, fontSize: '18px', color: '#5A6488', fontStyle: '700', letterSpacing: 3,
      }).setOrigin(1, 0);
      cont.add([lock, icon]);
      cont.setAlpha(0.75);
    }

    const hit = this.add.rectangle(0, 0, cardW, cardH, 0xffffff, 0.001).setName('hit');
    if (unlocked) hit.setInteractive({ useHandCursor: true });
    cont.add(hit);
    return cont;
  }
}
