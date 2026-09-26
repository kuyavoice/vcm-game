import Phaser from 'phaser';
import { CHARACTERS, DEFAULT_CHARACTER } from '../data/characters';
import { STAGES, type StageDef } from '../data/stages';
import { SCORE_STAGE } from '../data/score';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, isStageUnlocked } from '../utils/storage';
import { SelectGuard } from '../ui/SelectGuard';
import { makeButton } from '../ui/Button';

/** ステージ選択（タイトル → ここ → ゲーム）。前ステージのクリアで解放 */
export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(250, 6, 9, 19);

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

    const save = loadSave();
    const characterId = CHARACTERS[save.settings.character] ? save.settings.character : DEFAULT_CHARACTER;
    const guard = new SelectGuard(this);
    const cardW = Math.min(640, W - 40);
    const cardH = 176;
    const gap = 16;
    const allStages = [...STAGES, SCORE_STAGE];
    const total = allStages.length * cardH + (allStages.length - 1) * gap;
    let y = H / 2 - total / 2 + cardH / 2 - 10;

    allStages.forEach((st, i) => {
      const unlocked = st.scoreMode ? STAGES.every((x) => save.cleared.includes(x.id)) : isStageUnlocked(save, st.unlockAfter);
      const best = st.scoreMode ? (save.scoreRanking[0] ? { kills: save.scoreRanking[0].kills, timeSec: save.scoreRanking[0].timeSec, cleared: save.scoreRanking[0].cleared, score: save.scoreRanking[0].score } : undefined) : save.bests[String(st.id)];
      const cont = this.buildCard(st, unlocked, best, cardW, cardH);
      cont.setPosition(W / 2 + 40, y).setAlpha(0);
      this.tweens.add({ targets: cont, alpha: 1, x: W / 2, duration: 220, delay: 60 * i, ease: 'Cubic.out' });

      if (unlocked) {
        const hit = cont.getByName('hit') as Phaser.GameObjects.Rectangle;
        hit.on('pointerdown', () => { guard.press(hit); if (guard.armed) cont.setScale(0.98); });
        hit.on('pointerup', () => {
          cont.setScale(1);
          if (!guard.release(hit)) return;
          this.cameras.main.fadeOut(250, 6, 9, 19);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Game', { characterId, stageId: st.id });
          });
        });
      }
      y += cardH + gap;
    });

    makeButton(this, W / 2, H - Math.max(90, H * 0.08), 'CHARACTER', () => this.scene.start('CharaSelect'), { width: 260, height: 60, fontSize: 24 });
    this.add.text(W / 2, H * 0.11 + 78, `${CHARACTERS[characterId].name}`, { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.accent, fontStyle: '700' }).setOrigin(0.5);

    // PC：1〜3キー
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = parseInt(ev.key, 10);
      const st = [...STAGES, SCORE_STAGE][n - 1];
      const ok = st && (st.scoreMode ? STAGES.every((x) => save.cleared.includes(x.id)) : isStageUnlocked(save, st.unlockAfter));
      if (!ok || !guard.confirm()) return;
      this.scene.start('Game', { characterId, stageId: st.id });
    });
  }

  private buildCard(st: StageDef, unlocked: boolean, best: { kills: number; timeSec: number; cleared: boolean; score?: number } | undefined, cardW: number, cardH: number): Phaser.GameObjects.Container {
    const cont = this.add.container(0, 0);
    const shadow = this.add.rectangle(6, 6, cardW, cardH, 0x000000, 0.5);
    const bg = this.add.rectangle(0, 0, cardW, cardH, 0x111a3a, 1).setStrokeStyle(2, unlocked ? st.color : 0x3a4a8a, unlocked ? 0.9 : 0.5);
    const stripe = this.add.rectangle(-cardW / 2 + 8, 0, 10, cardH - 24, unlocked ? st.color : 0x3a4a8a, 1);
    const nameEn = this.add.text(-cardW / 2 + 32, -cardH / 2 + 18, st.nameEn, {
      fontFamily: FONT_EN, fontSize: '20px', color: unlocked ? Phaser.Display.Color.IntegerToColor(st.color).rgba : COLOR_HEX.dim, fontStyle: '700', letterSpacing: 4,
    });
    const name = this.add.text(-cardW / 2 + 32, -cardH / 2 + 44, st.name, {
      fontFamily: FONT_JP, fontSize: '34px', color: unlocked ? COLOR_HEX.white : '#5A6488', fontStyle: '700',
    });
    cont.add([shadow, bg, stripe, nameEn, name]);

    if (unlocked) {
      const desc = this.add.text(-cardW / 2 + 32, -cardH / 2 + 96, st.desc, {
        fontFamily: FONT_JP, fontSize: '19px', color: COLOR_HEX.white, wordWrap: { width: cardW - 64, useAdvancedWrap: true },
      });
      const mods = this.add.text(cardW / 2 - 20, -cardH / 2 + 18, `HP ×${st.enemyHpMul}　SPD ×${st.enemySpeedMul}　NUM ×${st.spawnMul}`, {
        fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.dim, fontStyle: '700',
      }).setOrigin(1, 0);
      cont.add([desc, mods]);
      if (best) {
        const mm = Math.floor(best.timeSec / 60).toString().padStart(2, '0');
        const ss = Math.floor(best.timeSec % 60).toString().padStart(2, '0');
        const bestText = this.add.text(cardW / 2 - 20, cardH / 2 - 16, best.score !== undefined ? `BEST  ${best.score.toLocaleString()} pt  ${mm}:${ss}` : `BEST  ✕ ${best.kills}  ${mm}:${ss}${best.cleared ? '  CLEAR' : ''}`, {
          fontFamily: FONT_EN, fontSize: '16px', color: best.cleared ? COLOR_HEX.gold : COLOR_HEX.accent, fontStyle: '700',
        }).setOrigin(1, 1);
        cont.add(bestText);
      }
    } else {
      const lock = this.add.text(-cardW / 2 + 32, -cardH / 2 + 100, st.scoreMode ? '全ステージをクリアで解放' : `STAGE ${st.unlockAfter} をクリアで解放`, {
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
