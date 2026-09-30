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

    // 切り替えの項目（4つ。縦に収めるため、1つ76px）
    type Setting = ReturnType<typeof loadSave>['settings'];
    let ty = top + 150 + ROWS.length * 170;
    const toggleRow = (title: string, sub: string, labels: string[], get: (st: Setting) => number, set: (st: Setting, i: number) => void) => {
      const h = 76;
      this.add.rectangle(left, ty, panelW, h, 0x111a3a, 0.95).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.5);
      this.add.text(left + 24, ty + 10, title, { fontFamily: FONT_EN, fontSize: '26px', color: COLOR_HEX.white, fontStyle: '700', letterSpacing: 3 });
      this.add.text(left + 24, ty + 44, sub, { fontFamily: FONT_JP, fontSize: '15px', color: COLOR_HEX.dim });
      let idx = get(save.settings);
      const btn = makeButton(this, left + panelW - 20 - 80, ty + h / 2, labels[idx], () => {
        idx = (idx + 1) % labels.length;
        const sv = loadSave();
        set(sv.settings, idx);
        writeSave(sv);
        (btn.list[2] as Phaser.GameObjects.Text).setText(labels[idx]);
        AudioBus.play('se_levelup', 120);
      }, { width: 160, height: 50, fontSize: 22, armDelayMs: 0 });
      ty += h + 10;
    };
    toggleRow('DAMAGE', 'ダメージの数字', ['ON', 'OFF'], (st) => (st.damageNumbers !== false ? 0 : 1), (st, i) => { st.damageNumbers = i === 0; });
    toggleRow('SPECIAL', '必殺ボタンの位置', ['RIGHT', 'LEFT'], (st) => (st.specialSide === 'left' ? 1 : 0), (st, i) => { st.specialSide = i === 1 ? 'left' : 'right'; });
    toggleRow('BATTLE BGM', '戦闘中の曲（CUSTOMの割り当てはMUSICで）', ['NORMAL', 'CUSTOM'], (st) => (st.bgmMode === 'custom' ? 1 : 0), (st, i) => { st.bgmMode = i === 1 ? 'custom' : 'normal'; });
    // 被弾の光：敵に当たったときの白い点滅。速い倍速だと画面全体がまぶしい、との声（2026-10-01）
    toggleRow('HIT FLASH', '敵に当たったときの光り方', ['STRONG', 'SOFT', 'OFF'], (st) => (st.hitFlash === 'soft' ? 1 : st.hitFlash === 'off' ? 2 : 0), (st, i) => { st.hitFlash = i === 1 ? 'soft' : i === 2 ? 'off' : 'strong'; });
    // 画面全体の光：必殺・ボス撃破・十字架・大当たり
    toggleRow('SCREEN FLASH', '必殺・撃破のときの画面の光', ['ON', 'SOFT', 'OFF'], (st) => (st.screenFlash === 'soft' ? 1 : st.screenFlash === 'off' ? 2 : 0), (st, i) => { st.screenFlash = i === 1 ? 'soft' : i === 2 ? 'off' : 'on'; });

    const close = () => {
      this.scene.stop();
      this.scene.resume(from);
    };
    makeButton(this, W / 2, ty + 46, 'CLOSE', close, { primary: true });
    this.input.keyboard?.on('keydown-ESC', close);
  }
}
