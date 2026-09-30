import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';
import { loadSave, writeSave } from '../utils/storage';
import { AudioBus } from '../utils/audio';

export interface OptionData {
  /** 呼び出し元のシーン（開いている間は止めて、閉じたら再開する） */
  from: string;
}

type VolumeKey = 'bgm' | 'se';

const ROWS: { key: VolumeKey; label: string; sub: string }[] = [
  { key: 'bgm', label: 'BGM', sub: '音楽' },
  { key: 'se', label: 'SE', sub: '効果音' },
];
const STEPS = 10;

/** オプション（音量・ダメージの数字）。タイトル画面とポーズ画面から開く。設定はセーブに保存され、すぐ反映される */
export class OptionScene extends Phaser.Scene {
  constructor() {
    super('Option');
  }

  create(data: OptionData): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const from = data?.from ?? 'Title';
    this.scene.pause(from);
    this.scene.bringToTop();

    // 下の画面のボタンを押せないように、全面で入力を受ける
    this.add.rectangle(0, 0, W, H, 0x060913, 0.92).setOrigin(0).setInteractive();

    const top = Math.max(H * 0.16, 120);
    this.add.text(W / 2, top, 'OPTION', { fontFamily: FONT_EN, fontSize: '56px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6 }).setOrigin(0.5);
    this.add.text(W / 2, top + 48, '音量と表示', { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.dim }).setOrigin(0.5);

    const panelW = Math.min(620, W - 40);
    const left = (W - panelW) / 2;
    const save = loadSave();

    ROWS.forEach((row, i) => {
      const y = top + 150 + i * 170;
      this.add.rectangle(left, y, panelW, 140, 0x111a3a, 0.95).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.5);
      this.add.text(left + 24, y + 16, row.label, { fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 3 });
      this.add.text(left + 24 + (row.label.length * 24 + 16), y + 28, row.sub, { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim });
      const pct = this.add.text(left + panelW - 24, y + 16, '', { fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.accent, fontStyle: '700' }).setOrigin(1, 0);

      // 目盛り（10段階）
      const btnW = 84;
      const barLeft = left + 24 + btnW + 16;
      const barW = panelW - 48 - (btnW + 16) * 2;
      const segGap = 6;
      const segW = (barW - segGap * (STEPS - 1)) / STEPS;
      const segs: Phaser.GameObjects.Rectangle[] = [];
      for (let k = 0; k < STEPS; k++) {
        segs.push(this.add.rectangle(barLeft + k * (segW + segGap), y + 96, segW, 30, 0x87ceeb, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x87ceeb, 0.6));
      }

      let level = Math.round(Phaser.Math.Clamp(save.settings[row.key], 0, 1) * STEPS);
      const draw = () => {
        segs.forEach((s, k) => s.setFillStyle(k < level ? 0x87ceeb : 0x060913, k < level ? 1 : 0.6));
        pct.setText(level === 0 ? 'OFF' : `${level * 10}%`);
      };
      const change = (d: number) => {
        const next = Phaser.Math.Clamp(level + d, 0, STEPS);
        if (next === level) return;
        level = next;
        const v = level / STEPS;
        AudioBus.setVolume(row.key, v);
        const sv = loadSave();
        sv.settings[row.key] = v;
        writeSave(sv);
        draw();
        // 効果音は、変えた音量で試しに鳴らす
        if (row.key === 'se') AudioBus.play('se_levelup', 120);
      };
      makeButton(this, left + 24 + btnW / 2, y + 96, '−', () => change(-1), { width: btnW, height: 56, fontSize: 34, armDelayMs: 0 });
      makeButton(this, left + panelW - 24 - btnW / 2, y + 96, '＋', () => change(1), { width: btnW, height: 56, fontSize: 30, armDelayMs: 0 });
      // 目盛りを直接タップしても変えられる
      segs.forEach((s, k) => {
        s.setInteractive({ useHandCursor: true });
        s.on('pointerup', () => change(k + 1 - level));
      });
      draw();
    });

    // ダメージの数字（出す／出さない）
    const ty = top + 150 + ROWS.length * 170;
    this.add.rectangle(left, ty, panelW, 100, 0x111a3a, 0.95).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.5);
    this.add.text(left + 24, ty + 16, 'DAMAGE', { fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 3 });
    this.add.text(left + 24, ty + 62, 'ダメージの数字', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim });
    let dmgOn = save.settings.damageNumbers !== false;
    const toggle = makeButton(this, left + panelW - 24 - 80, ty + 50, dmgOn ? 'ON' : 'OFF', () => {
      dmgOn = !dmgOn;
      const sv = loadSave();
      sv.settings.damageNumbers = dmgOn;
      writeSave(sv);
      (toggle.list[2] as Phaser.GameObjects.Text).setText(dmgOn ? 'ON' : 'OFF');
      AudioBus.play('se_levelup', 120);
    }, { width: 160, height: 56, fontSize: 26, armDelayMs: 0 });

    // 必殺ボタンの位置（右下／左下）
    const sy = ty + 100 + 16;
    this.add.rectangle(left, sy, panelW, 100, 0x111a3a, 0.95).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.5);
    this.add.text(left + 24, sy + 16, 'SPECIAL', { fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 3 });
    this.add.text(left + 24, sy + 62, '必殺ボタンの位置', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim });
    let side: 'right' | 'left' = save.settings.specialSide === 'left' ? 'left' : 'right';
    const sideToggle = makeButton(this, left + panelW - 24 - 80, sy + 50, side === 'left' ? 'LEFT' : 'RIGHT', () => {
      side = side === 'left' ? 'right' : 'left';
      const sv = loadSave();
      sv.settings.specialSide = side;
      writeSave(sv);
      (sideToggle.list[2] as Phaser.GameObjects.Text).setText(side === 'left' ? 'LEFT' : 'RIGHT');
      AudioBus.play('se_levelup', 120);
    }, { width: 160, height: 56, fontSize: 26, armDelayMs: 0 });

    // 戦闘中の曲（NORMAL／CUSTOM。CUSTOM の割り当てはミュージックで）
    const by2 = sy + 100 + 16;
    this.add.rectangle(left, by2, panelW, 100, 0x111a3a, 0.95).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.5);
    this.add.text(left + 24, by2 + 16, 'BATTLE BGM', { fontFamily: FONT_EN, fontSize: '32px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 3 });
    this.add.text(left + 24, by2 + 62, '戦闘中の曲（CUSTOMの割り当てはMUSICで）', { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim });
    let mode: 'normal' | 'custom' = save.settings.bgmMode === 'custom' ? 'custom' : 'normal';
    const modeToggle = makeButton(this, left + panelW - 24 - 80, by2 + 50, mode === 'custom' ? 'CUSTOM' : 'NORMAL', () => {
      mode = mode === 'custom' ? 'normal' : 'custom';
      const sv = loadSave();
      sv.settings.bgmMode = mode;
      writeSave(sv);
      (modeToggle.list[2] as Phaser.GameObjects.Text).setText(mode === 'custom' ? 'CUSTOM' : 'NORMAL');
      AudioBus.play('se_levelup', 120);
    }, { width: 160, height: 56, fontSize: 24, armDelayMs: 0 });

    const close = () => {
      this.scene.stop();
      this.scene.resume(from);
    };
    makeButton(this, W / 2, by2 + 100 + 70, 'CLOSE', close, { primary: true });
    this.input.keyboard?.on('keydown-ESC', close);
  }
}
