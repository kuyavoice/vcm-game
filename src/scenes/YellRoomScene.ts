import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { CODEX_CHARACTERS } from '../data/codex';
import { BOND_UNIT, BOND_TIERS, BOND_MAX, BOND_RELAX_LEVEL, bondLevel, bondNext } from '../data/bond';
import { voiceFiles } from '../data/voice';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { OPTIONAL_IMAGES, hasOptionalImage } from '../utils/optionalAssets';
import { AudioBus } from '../utils/audio';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel as uiPanel, UI } from '../ui/theme';
import { t } from '../utils/lang';

/** 絆の段階が上がったときの演出の長さ */
const LEVELUP_MS = 1400;

/**
 * 作戦室：好きなキャラにエールを贈る（2026-10-12 ユーザー承認「C案」）。
 * 作戦室の一枚絵（room / room_wide）の上に立ち絵と UI。100 ずつ贈るとお礼のボイス（笑顔の差分に切り替わる）。
 * 累計で絆が上がり、絆3でくつろぎの立ち絵、絆5でタイトルコールが推しの声になる（data/bond.ts）。
 * 図鑑のキャラ画面から来て、CLOSE で図鑑の同じページへ戻る。
 */
export class YellRoomScene extends Phaser.Scene {
  private id = 'kuya';
  private page = 0;
  private chara!: Phaser.GameObjects.Image;
  private ui!: Phaser.GameObjects.Container;
  private smileKey: string | null = null;
  private normalKey = '';
  private smiling = false;
  private busy = false;

  constructor() {
    super('YellRoom');
  }

  create(data?: { id?: string; page?: number }): void {
    this.id = data?.id ?? 'kuya';
    this.page = data?.page ?? 0;
    this.smiling = false;
    this.busy = false;
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const def = CHARACTERS[this.id];
    const color = def?.color ?? 0x87ceeb;
    const save = loadSave();
    const total = save.bond[this.id] ?? 0;
    const lv = bondLevel(total);

    // 背景：横長の画面なら room_wide。無ければ縦の絵を cover で
    const wide = W / H > 1.0;
    const bgKey = wide && hasOptionalImage('room_wide') ? 'room_wide' : 'room';
    const charKey = lv >= BOND_RELAX_LEVEL && hasOptionalImage(`relax_${this.id}`) ? `relax_${this.id}` : `standing_${this.id}`;
    this.normalKey = charKey;
    this.smileKey = charKey.startsWith('relax_') && hasOptionalImage(`${charKey}_smile`) ? `${charKey}_smile` : null;
    const need = [bgKey, charKey, this.smileKey].filter((k): k is string => !!k && !this.textures.exists(k) && hasOptionalImage(k));
    for (const k of need) this.load.image(k, OPTIONAL_IMAGES[k]);
    // create() の最中はまだ RUNNING ではないので、読み込み待ちのときだけ isActive で見る
    if (need.length) {
      this.load.once('complete', () => { if (this.scene.isActive()) this.build(W, H, color, save.totalYell, total); });
      this.load.start();
    } else {
      this.build(W, H, color, save.totalYell, total);
    }
  }

  private build(W: number, H: number, color: number, wallet: number, total: number): void {
    const wide = W / H > 1.0;
    const bgKey = wide && this.textures.exists('room_wide') ? 'room_wide' : 'room';
    // 作戦室
    if (this.textures.exists(bgKey)) {
      this.textures.get(bgKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const tex = this.textures.get(bgKey).getSourceImage() as HTMLImageElement;
      const cover = Math.max(W / tex.width, H / tex.height);
      this.add.image(W / 2, H / 2, bgKey).setScale(cover).setDepth(-10);
    } else {
      this.add.rectangle(0, 0, W, H, 0x0b1026).setOrigin(0).setDepth(-10);
    }
    // 下の帯（操作）と上の帯（見出し）を少し暗く
    const bandH = Math.min(340, Math.round(H * 0.3));
    const bandY = H - bandH;
    this.add.rectangle(0, bandY, W, bandH, 0x060913, 0.82).setOrigin(0).setDepth(-5);

    // 立ち絵：下端を帯の少し下に。顔が上の見せ場（地図台）に重ならないよう、頭は画面の上端近く
    const charKey = this.normalKey;
    const cx = wide ? W * 0.5 : W * 0.62;
    const bottom = bandY + 40;
    const targetH = bottom - 10;
    // 立ち絵の後ろに暗いぼかし（顔と地図台の光を分ける）
    const glow = this.glowTexture();
    this.add.image(cx, targetH * 0.42, glow).setDisplaySize(Math.min(W * 0.95, targetH * 0.9), targetH * 0.9).setAlpha(0.45).setDepth(-8);
    if (this.textures.exists(charKey)) {
      this.textures.get(charKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (this.smileKey && this.textures.exists(this.smileKey)) this.textures.get(this.smileKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.chara = this.add.image(cx, bottom, charKey).setOrigin(0.5, 1).setDepth(-6);
      const s = Math.min(targetH / this.chara.height, (W * 0.9) / this.chara.width);
      this.chara.setScale(s);
      // ふわっと出る
      this.chara.setAlpha(0).setY(bottom + 24);
      this.tweens.add({ targets: this.chara, alpha: 1, y: bottom, duration: 420, ease: 'Cubic.out' });
    }

    this.ui = this.add.container(0, 0);
    this.drawUI(W, H, color, wallet, total, bandY, bandH);
    wipeIn(this, { cascade: false });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  /** 見出し・絆の枠・解放の一覧・操作。贈るたびに描き直す */
  private drawUI(W: number, H: number, color: number, wallet: number, total: number, bandY: number, bandH: number): void {
    this.ui.removeAll(true);
    const ui = this.ui;
    const def = CHARACTERS[this.id];
    const name = CODEX_CHARACTERS.find((c) => c.id === this.id)?.name ?? def?.name ?? this.id;
    const lv = bondLevel(total);
    const next = bondNext(total);
    const wide = W / H > 1.0;
    const left = 20;
    // 立ち絵の顔（x≈0.62W）に被らない幅
    const colW = Math.min(wide ? 460 : W * 0.46, W - 40);

    // 見出し（左上）
    ui.add(this.add.text(left, 18, 'YELL', { fontFamily: FONT_EN, fontSize: '34px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5, stroke: '#060913', strokeThickness: 5 }));
    ui.add(this.add.text(left, 60, t(`${name}　にエールを贈る`, `Send yells to ${name}`), { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.white, stroke: '#060913', strokeThickness: 4 }));

    // 絆の枠
    const by = 92;
    const bh = 112;
    ui.add(uiPanel(this, left, by, colW, bh, { color, alpha: 0.9, strokeAlpha: 0.7, cut: 14, highlight: true }).gfx);
    const tx = left + 22;
    ui.add(this.add.text(tx, by + 14, t('絆', 'BOND'), { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim, fontStyle: '700' }));
    ui.add(this.add.text(tx + 34, by + 4, `Lv ${lv}`, { fontFamily: FONT_EN, fontSize: '36px', color: lv >= BOND_MAX ? COLOR_HEX.gold : COLOR_HEX.white, fontStyle: '700' }));
    ui.add(this.add.text(tx + 34 + 92, by + 22, lv >= BOND_MAX ? 'MAX' : `／ ${BOND_MAX}`, { fontFamily: FONT_EN, fontSize: '16px', color: COLOR_HEX.dim }));
    ui.add(this.add.text(left + colW - 18, by + 16, `★ ${total.toLocaleString()}`, { fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(1, 0));
    const gx = tx;
    const gy = by + 58;
    const gw = colW - 40;
    const gh = 12;
    const g = this.add.graphics();
    g.fillStyle(0x0b1026, 1).fillRect(gx, gy, gw, gh);
    for (let i = 0; i < BOND_MAX; i++) {
      const lo = i === 0 ? 0 : BOND_TIERS[i - 1].at;
      const hi = BOND_TIERS[i].at;
      const k = Phaser.Math.Clamp((total - lo) / (hi - lo), 0, 1);
      const sx = gx + (gw / BOND_MAX) * i + 2;
      const sw = gw / BOND_MAX - 4;
      if (k > 0) g.fillStyle(total >= hi ? 0xffd700 : color, 1).fillRect(sx, gy, sw * k, gh);
      g.lineStyle(1, 0x3a4a8a, 1).strokeRect(sx, gy, sw, gh);
    }
    ui.add(g);
    ui.add(this.add.text(tx, gy + 20, next ? t(`次の絆まで ★ ${(next.at - total).toLocaleString()}`, `Next: ★ ${(next.at - total).toLocaleString()}`) : t('絆は最大です', 'Bond maxed'), { fontFamily: FONT_JP, fontSize: '14px', color: next ? COLOR_HEX.dim : COLOR_HEX.gold }));

    // 解放の一覧（下の帯）
    const listW = Math.min(W - 40, wide ? 760 : W - 40);
    const lx = (W - listW) / 2;
    const rowH = 44;
    let y = bandY + 14;
    BOND_TIERS.forEach((tier, i) => {
      const open = total >= tier.at;
      ui.add(uiPanel(this, lx, y, listW, rowH - 6, { color: open ? color : UI.dim, alpha: 0.9, strokeAlpha: open ? 0.6 : 0.25, cut: 10 }).gfx);
      ui.add(this.add.text(lx + 16, y + (rowH - 6) / 2, `${i + 1}`, { fontFamily: FONT_EN, fontSize: '18px', color: open ? COLOR_HEX.gold : COLOR_HEX.dim, fontStyle: '700' }).setOrigin(0, 0.5));
      ui.add(this.add.text(lx + 44, y + (rowH - 6) / 2 - 8, tier.label, { fontFamily: FONT_JP, fontSize: '15px', color: open ? COLOR_HEX.white : COLOR_HEX.dim, fontStyle: '700' }).setOrigin(0, 0.5));
      ui.add(this.add.text(lx + 44, y + (rowH - 6) / 2 + 10, tier.sub, { fontFamily: FONT_JP, fontSize: '12px', color: COLOR_HEX.dim }).setOrigin(0, 0.5));
      const files = voiceFiles(this.id, 'bond');
      if (open && files[i]) {
        ui.add(makeButton(this, lx + listW - 14 - 28, y + (rowH - 6) / 2, '▶', () => AudioBus.previewVoice(this.id, files[i], this), { width: 54, height: 32, fontSize: 15, armDelayMs: 150 }));
      } else {
        ui.add(this.add.text(lx + listW - 14, y + (rowH - 6) / 2, open ? t('解放済み', 'Unlocked') : `★ ${tier.at.toLocaleString()}`, { fontFamily: FONT_EN, fontSize: '15px', color: open ? COLOR_HEX.accent : COLOR_HEX.dim }).setOrigin(1, 0.5));
      }
      y += rowH;
    });

    // 操作：所持・CLOSE・贈る
    const oy = Math.min(H - 44, y + 34);
    ui.add(this.add.text(lx, oy, t(`所持 ★ ${wallet.toLocaleString()}`, `Yells ★ ${wallet.toLocaleString()}`), { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.gold }).setOrigin(0, 0.5));
    const can = wallet >= BOND_UNIT;
    ui.add(makeButton(this, lx + listW - 110, oy, `★ ${BOND_UNIT} ${t('贈る', 'Send')}`, () => this.give(W, H, color, bandY, bandH), { width: 220, height: 52, fontSize: 20, primary: can, armDelayMs: 200 }));
    ui.add(makeButton(this, lx + listW - 110 - 230 + 20, oy, 'CLOSE', () => this.close(), { width: 160, height: 52, fontSize: 18, armDelayMs: 200 }));
  }

  /** エールを贈る：財布から引いて累計へ。お礼のボイス（笑顔）。段階が上がれば演出 */
  private give(W: number, H: number, color: number, bandY: number, bandH: number): void {
    if (this.busy) return;
    const save = loadSave();
    if (save.totalYell < BOND_UNIT) {
      AudioBus.play('se_cancel', 60);
      return;
    }
    const before = save.bond[this.id] ?? 0;
    const after = before + BOND_UNIT;
    save.totalYell -= BOND_UNIT;
    save.bond[this.id] = after;
    writeSave(save);
    const lvBefore = bondLevel(before);
    const lvAfter = bondLevel(after);

    // お礼のボイス（無ければキャラ選択の声）
    const thanks = voiceFiles(this.id, 'thanks');
    const pool = thanks.length ? thanks : voiceFiles(this.id, 'select');
    if (pool.length) AudioBus.previewVoice(this.id, pool[Math.floor(Math.random() * pool.length)], this);
    this.setSmile(true);
    AudioBus.play('se_item', 70);

    // ★ が立ち絵へ飛ぶ
    if (this.chara) {
      for (let i = 0; i < 6; i++) {
        const sx = W / 2 + Phaser.Math.Between(-120, 120);
        const star = this.add.text(sx, bandY + 60, '★', { fontFamily: FONT_EN, fontSize: '28px', color: COLOR_HEX.gold }).setOrigin(0.5).setDepth(20).setAlpha(0);
        this.tweens.add({
          targets: star, alpha: { from: 0, to: 1 }, x: this.chara.x + Phaser.Math.Between(-60, 60), y: this.chara.y - this.chara.displayHeight * 0.55 + Phaser.Math.Between(-40, 40),
          duration: 520 + i * 60, delay: i * 40, ease: 'Cubic.out',
          onComplete: () => this.tweens.add({ targets: star, alpha: 0, scale: 1.6, duration: 240, onComplete: () => star.destroy() }),
        });
      }
    }

    this.drawUI(W, H, color, save.totalYell, after, bandY, bandH);

    if (lvAfter > lvBefore) {
      // 絆が上がった：帯と文字
      this.busy = true;
      AudioBus.play('se_levelup', 80);
      const tier = BOND_TIERS[lvAfter - 1];
      const band = this.add.rectangle(0, H * 0.42, W, 96, 0x060913, 0.85).setOrigin(0, 0.5).setDepth(30).setScale(1, 0);
      const txt = this.add.text(W / 2, H * 0.42 - 14, t(`絆 Lv ${lvAfter}`, `BOND Lv ${lvAfter}`), { fontFamily: FONT_EN, fontSize: '40px', color: COLOR_HEX.gold, fontStyle: '700', letterSpacing: 4 }).setOrigin(0.5).setDepth(31).setAlpha(0);
      const sub = this.add.text(W / 2, H * 0.42 + 24, tier.label, { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.white }).setOrigin(0.5).setDepth(31).setAlpha(0);
      this.tweens.add({ targets: band, scaleY: 1, duration: 180, ease: 'Back.out' });
      this.tweens.add({ targets: [txt, sub], alpha: 1, duration: 220, delay: 120 });
      this.time.delayedCall(LEVELUP_MS, () => {
        this.tweens.add({ targets: [band, txt, sub], alpha: 0, duration: 260, onComplete: () => { band.destroy(); txt.destroy(); sub.destroy(); } });
        this.busy = false;
        // くつろぎの立ち絵が解放された：絵を替える（読み直す）
        if (lvAfter === BOND_RELAX_LEVEL && hasOptionalImage(`relax_${this.id}`)) this.scene.restart({ id: this.id, page: this.page });
      });
    }
  }

  private setSmile(on: boolean): void {
    if (!this.chara || !this.smileKey || !this.textures.exists(this.smileKey)) return;
    if (this.smiling === on) return;
    this.smiling = on;
    this.chara.setTexture(on ? this.smileKey : this.normalKey);
  }

  update(): void {
    if (this.smiling && !AudioBus.voicePlaying) this.setSmile(false);
  }

  /** 立ち絵の後ろの暗いぼかし（楕円のグラデーション） */
  private glowTexture(): string {
    const key = 'yell_glow';
    if (this.textures.exists(key)) return key;
    const size = 256;
    const c = this.textures.createCanvas(key, size, size);
    if (!c) return key;
    const ctx = c.getContext();
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, 'rgba(6,9,19,1)');
    grd.addColorStop(0.55, 'rgba(6,9,19,0.6)');
    grd.addColorStop(1, 'rgba(6,9,19,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    c.refresh();
    return key;
  }

  private close(): void {
    AudioBus.stopVoice();
    go(this, 'Codex', { tab: 'chara', page: this.page });
  }
}
