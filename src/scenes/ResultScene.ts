import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';
import { loadSave, writeSave } from '../utils/storage';
import { AudioBus } from '../utils/audio';

export interface RunResult {
  characterId: string;
  cleared: boolean;
  kills: number;
  timeSec: number;
  level: number;
  yell: number;
  /** プレイ時のゲーム速度（表示のみ。記録はゲーム内時間基準なので倍率に依存しない） */
  speed: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(r: RunResult): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(300, 6, 9, 19);
    AudioBus.playBgm('bgm_result');

    // ベスト更新・エール累計
    const save = loadSave();
    const score = (x: { kills: number; timeSec: number }) => x.timeSec * 10 + x.kills;
    const isBest = !save.best || score(r) > score(save.best);
    if (isBest) save.best = { kills: r.kills, timeSec: r.timeSec, level: r.level, yell: r.yell, cleared: r.cleared };
    save.totalYell += r.yell;
    writeSave(save);

    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);

    // 立ち絵（あれば）
    const chara = CHARACTERS[r.characterId];
    const stKey = `standing_${r.characterId}`;
    if (this.textures.exists(stKey)) {
      // ボタン帯（H*0.78〜）の上に足元が来るように収める
      const img = this.add.image(W * 0.30, H * 0.79, stKey).setOrigin(0.5, 1);
      const scale = (H * 0.60) / img.height;
      img.setScale(scale).setAlpha(0.95);
    }

    // 見出し（「死」を使わない）
    const title = r.cleared ? 'SIGNAL CLEAR' : 'SIGNAL LOST';
    const sub = r.cleared ? '声は、届いた。' : '声が、途切れた……';
    this.add.text(W / 2, H * 0.10, title, {
      fontFamily: FONT_EN, fontSize: '76px', color: r.cleared ? COLOR_HEX.accent : COLOR_HEX.danger, fontStyle: '700', letterSpacing: 4,
      stroke: '#060913', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.10 + 62, sub, {
      fontFamily: FONT_JP, fontSize: '26px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 6,
    }).setOrigin(0.5);

    // スタッツ（右寄せのパネル）
    const px = W * 0.58;
    const py = H * 0.27;
    const panel = this.add.rectangle(px, py, W * 0.40, 390, 0x0b1026, 0.88).setOrigin(0, 0).setStrokeStyle(2, 0x87ceeb, 0.6);
    const mm = Math.floor(r.timeSec / 60).toString().padStart(2, '0');
    const ss = Math.floor(r.timeSec % 60).toString().padStart(2, '0');
    const rows: [string, string][] = [
      ['CHARACTER', chara?.name ?? r.characterId],
      ['TIME', `${mm}:${ss}`],
      ['DEFEATED', `${r.kills}`],
      ['LEVEL', `${r.level}`],
      ['YELL', `★ ${r.yell}`],
      ['SPEED', `×${r.speed ?? 1}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 24 + i * 60;
      this.add.text(px + 18, y, k, { fontFamily: FONT_EN, fontSize: '18px', color: COLOR_HEX.dim, fontStyle: '700' });
      this.add.text(px + 18, y + 20, v, { fontFamily: k === 'CHARACTER' ? FONT_JP : FONT_EN, fontSize: '30px', color: COLOR_HEX.white, fontStyle: '700' });
    });
    if (isBest) {
      this.add.text(panel.x + panel.width - 14, py - 14, 'NEW BEST', {
        fontFamily: FONT_EN, fontSize: '20px', color: '#060913', backgroundColor: '#FFD700', fontStyle: '700', padding: { x: 8, y: 2 },
      }).setOrigin(1, 1).setAngle(-4);
    }

    makeButton(this, W / 2, H * 0.84, 'RETRY', () => {
      this.scene.start('Game', { characterId: r.characterId });
    }, { primary: true });
    makeButton(this, W / 2, H * 0.84 + 92, 'TITLE', () => this.scene.start('Title'));
  }
}
