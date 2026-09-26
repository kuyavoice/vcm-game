import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';

export interface LoadoutRow {
  name: string;
  level: number;
  max: number;
  color: number;
  owner: string;
  evolved?: boolean;
  fusion?: boolean;
}

export interface PauseData {
  character: string;
  stage: string;
  weapons: LoadoutRow[];
  passives: LoadoutRow[];
}

/** ポーズ（Esc／ボタン／タブ非表示・フォーカス喪失で自動）。所持アーツ・パッシブの一覧もここで見る */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(data: PauseData): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    this.add.rectangle(0, 0, W, H, 0x060913, 0.86).setOrigin(0);

    const top = Math.max(H * 0.07, 60);
    this.add.text(W / 2, top, 'PAUSED', {
      fontFamily: FONT_EN, fontSize: '64px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6,
    }).setOrigin(0.5);
    this.add.text(W / 2, top + 50, `${data?.character ?? ''}　${data?.stage ?? ''}`, {
      fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    // ── 所持一覧 ──
    const left = 36;
    const rowW = W - left * 2;
    let y = top + 100;
    const section = (label: string) => {
      this.add.text(left, y, label, { fontFamily: FONT_EN, fontSize: '18px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 3 });
      y += 30;
    };
    const row = (r: LoadoutRow) => {
      const h = 50;
      this.add.rectangle(left, y, rowW, h - 6, 0x111a3a, 0.9).setOrigin(0).setStrokeStyle(1, r.color, 0.6);
      this.add.rectangle(left + 3, y + 5, 6, h - 16, r.color, 1).setOrigin(0);
      this.add.text(left + 20, y + 6, r.name, { fontFamily: FONT_JP, fontSize: '20px', color: r.evolved || r.fusion ? COLOR_HEX.gold : COLOR_HEX.white, fontStyle: '700' });
      this.add.text(left + 20, y + 30, r.owner, { fontFamily: FONT_JP, fontSize: '12px', color: COLOR_HEX.dim });
      // Lvピップ
      const px = left + rowW - 14 - r.max * 18;
      for (let i = 0; i < r.max; i++) {
        this.add.rectangle(px + i * 18, y + (h - 6) / 2, 13, 12, i < r.level ? r.color : 0x000000, i < r.level ? 1 : 0.5).setOrigin(0, 0.5).setStrokeStyle(1, r.color, 0.5);
      }
      this.add.text(px - 10, y + (h - 6) / 2, r.fusion ? 'FUSION' : r.evolved ? 'EVO' : `Lv${r.level}`, { fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.white, fontStyle: '700' }).setOrigin(1, 0.5);
      y += h;
    };
    if (data?.weapons?.length) {
      section('WEAPONS / ARTS');
      data.weapons.forEach(row);
      y += 10;
    }
    if (data?.passives?.length) {
      section('SUPPORT');
      data.passives.forEach(row);
      y += 10;
    }

    const resume = () => {
      this.scene.stop();
      this.scene.resume('Game');
    };
    const by = Math.max(y + 60, H * 0.72);
    makeButton(this, W / 2, by, 'RESUME', resume, { primary: true });
    makeButton(this, W / 2, by + 92, 'STAGE SELECT', () => {
      this.scene.stop('Game');
      this.scene.stop();
      this.scene.start('StageSelect');
    });
    this.add.text(W / 2, by + 160, 'Esc でも再開', {
      fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', resume);
  }
}
