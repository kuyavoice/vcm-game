import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { getSafeInsets } from '../utils/safeArea';

export interface HudState {
  hp: number; maxHp: number; xp: number; xpToNext: number; level: number;
  time: number; kills: number; yell: number; band: string;
  /** 必殺ゲージ 0〜1 と発動中か */
  soul: number; soulActive: boolean;
  boss?: { name: string; hp: number; maxHp: number } | null;
}

/** 上部HUD：HPバー／経験値バー（全幅）／経過時間／撃破数／エール／Lv。右下：必殺ボタン */
export class Hud {
  private container: Phaser.GameObjects.Container;
  private bars: Phaser.GameObjects.Graphics;
  private timeText: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;
  private yellText: Phaser.GameObjects.Text;
  private lvText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;
  private bandText: Phaser.GameObjects.Text;
  private bossText: Phaser.GameObjects.Text;
  private pauseBtn: Phaser.GameObjects.Container;
  private speedBtn: Phaser.GameObjects.Container;
  private speedText: Phaser.GameObjects.Text;
  private soulBtn: Phaser.GameObjects.Container;
  private soulGfx: Phaser.GameObjects.Graphics;
  private soulLabel: Phaser.GameObjects.Text;
  private arrows: Phaser.GameObjects.Graphics;
  private top = 0;
  private bottom = 0;
  private w = 720;
  private h = 1280;
  readonly soulRadius = 58;

  constructor(private scene: Phaser.Scene, onPause: () => void, onSoul: () => void, onSpeed: () => void) {
    this.container = scene.add.container(0, 0).setDepth(100);
    this.bars = scene.add.graphics();
    this.arrows = scene.add.graphics().setDepth(99).setScrollFactor(0);

    const en = (size: number, color: string = COLOR_HEX.white) => ({ fontFamily: FONT_EN, fontSize: `${size}px`, color, fontStyle: '700' });
    this.timeText = scene.add.text(0, 0, '00:00', en(44)).setOrigin(0.5, 0);
    this.killText = scene.add.text(0, 0, '0', en(26)).setOrigin(1, 0);
    this.yellText = scene.add.text(0, 0, '0', en(22, COLOR_HEX.gold)).setOrigin(1, 0);
    this.lvText = scene.add.text(0, 0, 'Lv 1', en(24, COLOR_HEX.accent)).setOrigin(0, 0);
    this.hpText = scene.add.text(0, 0, '100 / 100', en(18)).setOrigin(0, 0.5);
    this.bandText = scene.add.text(0, 0, '', { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.dim }).setOrigin(0.5, 0);
    this.bossText = scene.add.text(0, 0, '', { fontFamily: FONT_JP, fontSize: '18px', color: '#FF4D6D', fontStyle: '700' }).setOrigin(0.5, 0).setVisible(false);

    // ポーズボタン
    const pbg = scene.add.rectangle(0, 0, 56, 44, 0x111a3a, 0.9).setStrokeStyle(2, 0x87ceeb, 0.6);
    const pt = scene.add.text(0, 0, 'II', en(22)).setOrigin(0.5);
    this.pauseBtn = scene.add.container(0, 0, [pbg, pt]);
    pbg.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      onPause();
    });

    // ゲーム速度ボタン（×1 → ×1.5 → ×2 を巡回）
    const sbg = scene.add.rectangle(0, 0, 72, 44, 0x111a3a, 0.9).setStrokeStyle(2, 0x87ceeb, 0.6);
    this.speedText = scene.add.text(0, 0, '×1', en(22)).setOrigin(0.5);
    this.speedBtn = scene.add.container(0, 0, [sbg, this.speedText]);
    sbg.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      onSpeed();
    });

    // 必殺ボタン『魂の共鳴』（右下・親指の届く位置）
    this.soulGfx = scene.add.graphics();
    this.soulLabel = scene.add.text(0, 0, '共鳴', { fontFamily: FONT_JP, fontSize: '22px', color: COLOR_HEX.white, fontStyle: '700' }).setOrigin(0.5);
    const hit = scene.add.circle(0, 0, this.soulRadius + 6, 0xffffff, 0.001);
    this.soulBtn = scene.add.container(0, 0, [this.soulGfx, this.soulLabel, hit]);
    hit.setInteractive(new Phaser.Geom.Circle(this.soulRadius + 6, this.soulRadius + 6, this.soulRadius + 6), Phaser.Geom.Circle.Contains);
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      onSoul();
    });

    this.container.add([this.bars, this.timeText, this.killText, this.yellText, this.lvText, this.hpText, this.bandText, this.bossText, this.pauseBtn, this.speedBtn, this.soulBtn]);
    // 入力の当たり判定は子要素自身の scrollFactor を見るので、入れ子の末端まで 0 を設定する
    const fix = (obj: Phaser.GameObjects.GameObject) => {
      (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
      if (obj instanceof Phaser.GameObjects.Container) obj.each(fix);
    };
    fix(this.container);
    this.layout();
    scene.scale.on('resize', this.layout, this);
  }

  layout(): void {
    const cam = this.scene.cameras.main;
    this.w = cam.width;
    this.h = cam.height;
    const safe = getSafeInsets(this.scene.scale);
    this.top = Math.max(safe.top, 16) + 8;
    this.bottom = Math.max(safe.bottom, 16) + 16;
    const t = this.top;
    this.timeText.setPosition(this.w / 2, t);
    this.killText.setPosition(this.w - 24, t + 4);
    this.yellText.setPosition(this.w - 24, t + 38);
    this.lvText.setPosition(24, t + 2);
    this.hpText.setPosition(24 + 10, t + 50);
    this.bandText.setPosition(this.w / 2, t + 54);
    this.bossText.setPosition(this.w / 2, t + 118);
    this.pauseBtn.setPosition(this.w - 24 - 28, t + 100);
    this.speedBtn.setPosition(this.w - 24 - 56 - 10 - 36, t + 100);
    this.soulBtn.setPosition(this.w - 24 - this.soulRadius, this.h - this.bottom - this.soulRadius);
  }

  update(d: HudState): void {
    const g = this.bars;
    const t = this.top;
    g.clear();

    // HPバー（左）
    const hpW = 300;
    const hpY = t + 40;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(24, hpY, hpW, 20);
    const ratio = Phaser.Math.Clamp(d.hp / d.maxHp, 0, 1);
    g.fillStyle(ratio > 0.3 ? 0x87ceeb : 0xff4d6d, 1);
    g.fillRect(24, hpY, hpW * ratio, 20);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeRect(24, hpY, hpW, 20);
    this.hpText.setText(`${Math.ceil(d.hp)} / ${d.maxHp}`).setPosition(34, hpY + 10);

    // 経験値バー（全幅）
    const xpY = t + 82;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(0, xpY, this.w, 10);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(0, xpY, this.w * Phaser.Math.Clamp(d.xp / d.xpToNext, 0, 1), 10);

    // ボスHPバー
    if (d.boss) {
      const by = t + 142;
      const bw = this.w - 48;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(24, by, bw, 14);
      g.fillStyle(0xff4d6d, 1);
      g.fillRect(24, by, bw * Phaser.Math.Clamp(d.boss.hp / d.boss.maxHp, 0, 1), 14);
      g.lineStyle(2, 0xffffff, 0.6);
      g.strokeRect(24, by, bw, 14);
      this.bossText.setText(d.boss.name).setVisible(true);
    } else {
      this.bossText.setVisible(false);
    }

    const mm = Math.floor(d.time / 60);
    const ss = Math.floor(d.time % 60);
    this.timeText.setText(`${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);
    this.killText.setText(`✕ ${d.kills}`);
    this.yellText.setText(`★ ${d.yell}`);
    this.lvText.setText(`Lv ${d.level}`);
    this.bandText.setText(d.boss ? '' : d.band).setPosition(this.w / 2, xpY + 14);

    // 必殺ボタン
    const sg = this.soulGfx;
    sg.clear();
    const r = this.soulRadius;
    sg.fillStyle(0x060913, 0.75);
    sg.fillCircle(0, 0, r);
    sg.lineStyle(3, d.soul >= 1 || d.soulActive ? 0xffffff : 0x3a4a8a, 1);
    sg.strokeCircle(0, 0, r);
    // ゲージ（弧）
    sg.lineStyle(8, 0x87ceeb, d.soul >= 1 ? 1 : 0.7);
    sg.beginPath();
    sg.arc(0, 0, r - 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Phaser.Math.Clamp(d.soulActive ? 1 : d.soul, 0, 1), false);
    sg.strokePath();
    if (d.soul >= 1 && !d.soulActive) {
      const pulse = 0.5 + Math.sin(this.scene.time.now / 160) * 0.3;
      sg.fillStyle(0x87ceeb, pulse * 0.5);
      sg.fillCircle(0, 0, r - 14);
      this.soulLabel.setColor('#060913');
    } else if (d.soulActive) {
      sg.fillStyle(0x87ceeb, 0.9);
      sg.fillCircle(0, 0, r - 14);
      this.soulLabel.setColor('#060913');
    } else {
      this.soulLabel.setColor('#8A94B8');
    }
    this.soulLabel.setText(d.soulActive ? `${this.specialLabel}中` : this.specialLabel).setFontSize(this.specialLabel.length >= 4 ? 18 : 22);
  }

  private specialLabel = '共鳴';

  /** 必殺ボタンの短い表示名（キャラごと） */
  setSpecialLabel(label: string): void {
    this.specialLabel = label;
  }

  setSpeed(mul: number): void {
    this.speedText.setText(`×${mul}`).setColor(mul === 1 ? '#FFFFFF' : '#87CEEB');
  }

  /** 情報統制システム：画面外の強敵の方向を矢印で示す */
  drawArrows(targets: { x: number; y: number; color: number }[]): void {
    const g = this.arrows;
    g.clear();
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const margin = 28;
    for (const tg of targets) {
      const dx = tg.x - cx;
      const dy = tg.y - cy;
      if (Math.abs(dx) < cam.width / 2 - margin && Math.abs(dy) < cam.height / 2 - margin) continue;
      const a = Math.atan2(dy, dx);
      const sx = Phaser.Math.Clamp(cam.width / 2 + Math.cos(a) * 9999, margin, cam.width - margin);
      const sy = Phaser.Math.Clamp(cam.height / 2 + Math.sin(a) * 9999, this.top + 170, cam.height - margin - this.bottom);
      g.fillStyle(tg.color, 0.9);
      g.fillTriangle(
        sx + Math.cos(a) * 14, sy + Math.sin(a) * 14,
        sx + Math.cos(a + 2.4) * 12, sy + Math.sin(a + 2.4) * 12,
        sx + Math.cos(a - 2.4) * 12, sy + Math.sin(a - 2.4) * 12,
      );
    }
  }

  /** 中央に一瞬出すバナー（時間帯の切り替わりなど） */
  banner(text: string, color: string = COLOR_HEX.accent, size = 34): void {
    const t = this.scene.add
      .text(this.w / 2, this.h * 0.36, text, {
        fontFamily: FONT_JP, fontSize: `${size}px`, color, fontStyle: '700',
        stroke: '#060913', strokeThickness: 6,
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0);
    this.scene.tweens.add({
      targets: t, alpha: 1, y: t.y - 16, duration: 250, yoyo: true, hold: 1100,
      onComplete: () => t.destroy(),
    });
  }

  destroy(): void {
    this.scene.scale.off('resize', this.layout, this);
    this.container.destroy();
    this.arrows.destroy();
  }
}
