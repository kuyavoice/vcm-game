import Phaser from 'phaser';
import { MUSIC, type MusicDef } from '../data/music';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave, type SaveData } from '../utils/storage';
import { isCharacterUnlocked } from '../utils/unlock';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel, type Panel } from '../ui/theme';
import { AudioBus } from '../utils/audio';
import { BGM_SLOTS, assignableMusic } from '../utils/bgmCustom';

/** 一覧に出してよい曲：音声ファイルが置かれていて、隠しキャラの曲ならそのキャラを解放済み */
export function visibleMusic(save: SaveData): MusicDef[] {
  return MUSIC.filter((m) => AudioBus.isAvailable(m.key) && (!m.secretOf || isCharacterUnlocked(m.secretOf, save)));
}

const isOwned = (m: MusicDef, save: SaveData) => m.price === 0 || save.music.includes(m.id);

/**
 * ミュージック。エールで解放した曲を選んで聴ける。
 * 曲は選んだときに初めて読み込む（起動を重くしない）。画面を出るとタイトルの曲に戻る。
 */
export class MusicScene extends Phaser.Scene {
  constructor() {
    super('Music');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    wipeIn(this);
    cam.scrollY = 0;
    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setScrollFactor(0);

    const save = loadSave();
    const items = visibleMusic(save);
    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'MUSIC', { fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 42, 'ゲームの曲 —— 集めたエールで解放', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);
    const wallet = this.add.text(W / 2, top + 78, `★ ${save.totalYell}`, { fontFamily: FONT_EN, fontSize: '26px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(0.5);

    const rowW = Math.min(660, W - 40);
    const left = (W - rowW) / 2;
    const rowH = 78;
    let y = top + 116;
    let buying = false;
    let playing = '';
    y = this.drawCustomSlots(save, left, rowW, y);
    const frames = new Map<string, Panel>();
    const labels = new Map<string, Phaser.GameObjects.Text>();
    const bars = new Map<string, Phaser.GameObjects.Rectangle[]>();

    const flash = (text: string, color: string) => {
      const t = this.add.text(W / 2, top + 78, text, { fontFamily: FONT_JP, fontSize: '22px', color, fontStyle: '700', stroke: '#060913', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(60);
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, duration: 900, delay: 300, onComplete: () => t.destroy() });
    };
    const refresh = () => {
      for (const m of items) {
        const on = playing === m.id;
        frames.get(m.id)?.redraw({ stroke: on ? 0xffffff : m.color, strokeAlpha: on ? 1 : 0.6 });
        labels.get(m.id)?.setText(on ? '■ STOP' : '▶ PLAY');
        bars.get(m.id)?.forEach((b) => b.setVisible(on));
      }
    };
    const toggle = (m: MusicDef) => {
      if (playing === m.id) {
        playing = '';
        AudioBus.stopBgm();
      } else {
        playing = m.id;
        AudioBus.stopBgm();
        AudioBus.playBgm(m.key);
      }
      refresh();
    };

    items.forEach((m) => {
      const owned = isOwned(m, save);
      const frame = panel(this, left, y, rowW, rowH - 10, { color: owned ? m.color : 0x3a4a8a, alpha: 0.92, strokeAlpha: owned ? 0.6 : 0.5 });
      frames.set(m.id, frame);
      // 長い曲名（英題つき）は、ボタンにかからないよう小さく
      this.add.text(left + 22, y + 8, m.title, { fontFamily: FONT_JP, fontSize: m.title.length > 20 ? '19px' : '24px', color: owned ? COLOR_HEX.white : '#5A6488', fontStyle: '700' });
      this.add.text(left + 22, y + 40, m.sub, { fontFamily: FONT_JP, fontSize: '15px', color: COLOR_HEX.dim });
      const bx = left + rowW - 16 - 80;
      const by = y + (rowH - 10) / 2;
      if (owned) {
        // 再生中の印（音の波）
        const eq: Phaser.GameObjects.Rectangle[] = [];
        for (let k = 0; k < 4; k++) {
          const b = this.add.rectangle(bx - 110 + k * 10, by + 14, 6, 24, 0x87ceeb, 1).setOrigin(0.5, 1).setVisible(false);
          this.tweens.add({ targets: b, scaleY: 0.25, duration: 260 + k * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          eq.push(b);
        }
        bars.set(m.id, eq);
        const btn = makeButton(this, bx, by, '▶ PLAY', () => toggle(m), { width: 160, height: 46, fontSize: 20, armDelayMs: 200 });
        labels.set(m.id, btn.list[2] as Phaser.GameObjects.Text);
      } else {
        // 誤タップで買わないように、2回押しで解放
        let armed = false;
        const btn = makeButton(this, bx, by, `★ ${m.price}`, () => {
          if (buying) return;
          const sv = loadSave();
          if (sv.totalYell < m.price) { flash('エールが足りない', COLOR_HEX.danger); return; }
          const label = btn.list[2] as Phaser.GameObjects.Text;
          if (!armed) {
            armed = true;
            label.setText('解放する？');
            this.time.delayedCall(2500, () => { if (!buying) { armed = false; label.setText(`★ ${m.price}`); } });
            return;
          }
          buying = true;
          sv.totalYell -= m.price;
          if (!sv.music.includes(m.id)) sv.music.push(m.id);
          writeSave(sv);
          AudioBus.play('se_item');
          wallet.setText(`★ ${sv.totalYell}`);
          flash(`『${m.title}』を解放`, COLOR_HEX.gold);
          this.time.delayedCall(450, () => this.scene.restart());
        }, { width: 160, height: 46, fontSize: 20, primary: save.totalYell >= m.price, armDelayMs: 200 });
      }
      y += rowH;
    });

    this.playTrack = (m) => toggle(m);

    const leave = () => {
      // 聴いていた曲は止めて、タイトルの曲に戻す
      AudioBus.stopBgm();
      AudioBus.playBgm('bgm_title');
      go(this, 'Title');
    };
    const backY = Math.max(H - Math.max(90, H * 0.08), y + 50);
    makeButton(this, W / 2, backY, 'TITLE', leave, { width: 240, height: 60, fontSize: 24 });

    // 画面を作り直したとき（解放の直後など）は、鳴っている曲の表示を合わせる
    const cur = AudioBus.currentKey();
    const now = items.find((m) => m.key === cur && isOwned(m, save));
    if (now) playing = now.id;
    else if (cur && cur !== '') AudioBus.stopBgm();
    refresh();

    // 縦スクロール（内容が画面より長い端末向け）
    const maxScroll = Math.max(0, backY + 90 - H);
    let dragY: number | null = null;
    let dragStart = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (this.pickerOpen) return; dragY = p.y; dragStart = cam.scrollY; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === null || !p.isDown || this.pickerOpen) return;
      cam.scrollY = Phaser.Math.Clamp(dragStart - (p.y - dragY), 0, maxScroll);
      bg.tilePositionY = cam.scrollY * 0.3;
    });
    const endDrag = () => { dragY = null; };
    this.input.on('pointerup', endDrag);
    this.input.on('pointerupoutside', endDrag);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.pickerOpen) return;
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.6, 0, maxScroll);
    });
  }

  /** 一覧の曲を鳴らす／止める（割り当てたときに、その曲を聴かせる） */
  private playTrack: (m: MusicDef) => void = () => {};
  private pickerOpen = false;

  /**
   * 戦闘中の曲の割り当て（オプションで BATTLE BGM を CUSTOM にすると使われる）。
   * 場面ごとの行。行をタップすると、解放した曲の一覧から選ぶ。返り値: 次に置く高さ
   */
  private drawCustomSlots(save: SaveData, left: number, rowW: number, y0: number): number {
    const custom = save.settings.bgmMode === 'custom';
    const choices = assignableMusic(save);
    const nameOf = (id?: string) => (id && choices.find((m) => m.id === id)?.title) ?? '';
    let y = y0;
    this.add.text(left, y, 'BATTLE BGM', { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 3 });
    this.add.text(left + rowW, y + 2, custom ? 'CUSTOM：この割り当てで流れる' : 'NORMAL：オプションで CUSTOM にすると使われる', { fontFamily: FONT_JP, fontSize: '14px', color: custom ? COLOR_HEX.gold : COLOR_HEX.dim }).setOrigin(1, 0);
    y += 30;
    const rowH = 46;
    for (const slot of BGM_SLOTS) {
      const assigned = nameOf(save.settings.bgmCustom[slot.id]);
      panel(this, left, y, rowW, rowH - 6, { color: assigned ? 0xffd700 : 0x3a4a8a, alpha: 0.92, strokeAlpha: assigned ? 0.7 : 0.5, cut: 12 });
      const frame = this.add.rectangle(left, y, rowW, rowH - 6, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
      this.add.text(left + 20, y + 9, slot.name, { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.white, fontStyle: '700' });
      const t = this.add.text(left + rowW - 16, y + 10, assigned || '既定', { fontFamily: FONT_JP, fontSize: '16px', color: assigned ? COLOR_HEX.gold : COLOR_HEX.dim });
      t.setOrigin(1, 0);
      // 長い曲名は、場面の名前にかからないように切る
      const maxW = rowW - 160;
      if (t.width > maxW) { t.setText(`…${t.text.slice(-14)}`); }
      let pressedAt = -1;
      frame.on('pointerdown', (p: Phaser.Input.Pointer) => { pressedAt = p.y; });
      frame.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (pressedAt < 0 || Math.abs(p.y - pressedAt) > 12 || this.pickerOpen) return;
        pressedAt = -1;
        this.openPicker(slot.id, slot.name, save);
      });
      y += rowH;
    }
    return y + 16;
  }

  /** 曲を選ぶ画面（一覧の上に重ねる）。選ぶと保存して、その曲を鳴らす */
  private openPicker(slotId: string, slotName: string, save: SaveData): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    this.pickerOpen = true;
    const choices = assignableMusic(save);
    const layer = this.add.container(0, cam.scrollY).setDepth(80);
    const shade = this.add.rectangle(0, 0, W, H, 0x020308, 0.9).setOrigin(0).setInteractive();
    layer.add(shade);
    const top = Math.max(H * 0.06, 40);
    layer.add(this.add.text(W / 2, top, slotName, { fontFamily: FONT_JP, fontSize: '32px', color: COLOR_HEX.accent, fontStyle: '700' }).setOrigin(0.5));
    layer.add(this.add.text(W / 2, top + 40, 'この場面で流す曲を選ぶ', { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim }).setOrigin(0.5));
    const rowW = Math.min(620, W - 40);
    const left = (W - rowW) / 2;
    const rowH = Math.min(50, Math.floor((H - top - 200) / (choices.length + 1)));
    let y = top + 76;
    const current = save.settings.bgmCustom[slotId];
    const close = () => { layer.destroy(); this.pickerOpen = false; };
    const pick = (id: string | null, m?: MusicDef) => {
      const sv = loadSave();
      if (id) sv.settings.bgmCustom[slotId] = id;
      else delete sv.settings.bgmCustom[slotId];
      writeSave(sv);
      AudioBus.play('se_item');
      close();
      if (m) this.playTrack(m);
      this.scene.restart();
    };
    const row = (label: string, sub: string, color: number, on: boolean, onPick: () => void) => {
      const pg = panel(this, left, y, rowW, rowH - 6, { color, alpha: 0.96, stroke: on ? 0xffffff : color, strokeAlpha: on ? 1 : 0.6, cut: 12 }).gfx;
      const f = this.add.rectangle(left, y, rowW, rowH - 6, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
      const tx = this.add.text(left + 18, y + 6, label, { fontFamily: FONT_JP, fontSize: label.length > 20 ? '16px' : '19px', color: COLOR_HEX.white, fontStyle: '700' });
      const sb = this.add.text(left + rowW - 14, y + 10, sub, { fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.dim }).setOrigin(1, 0);
      layer.add([pg, f, tx, sb]);
      let armed = false;
      f.on('pointerdown', () => { armed = true; });
      f.on('pointerup', () => { if (armed) onPick(); armed = false; });
      y += rowH;
    };
    row('既定に戻す', '今までどおりの曲', 0x3a4a8a, !current, () => pick(null));
    for (const m of choices) row(m.title, m.sub, m.color, current === m.id, () => pick(m.id, m));
    layer.add(makeButton(this, W / 2, Math.min(H - 70, y + 50), 'CANCEL', close, { width: 220, height: 56, fontSize: 22, armDelayMs: 200 }));
  }
}
