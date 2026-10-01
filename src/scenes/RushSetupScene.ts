import Phaser from 'phaser';
import { WEAPONS, ART_IDS } from '../data/weapons';
import { PASSIVES } from '../data/passives';
import { CHARACTERS } from '../data/characters';
import { RUSH, RUSH_STAGE } from '../data/rush';
import { PORTRAITS, portraitKey } from '../data/portraits';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, writeSave } from '../utils/storage';
import { makeButton } from '../ui/Button';
import { AudioBus } from '../utils/audio';

/**
 * ボスラッシュの準備：図鑑に登録済みの共鳴アーツから3つ選ぶ。
 * 操作キャラが借りられないアーツ（自分の技）は出さない。前回の選択を覚えておく。
 */
export class RushSetupScene extends Phaser.Scene {
  constructor() {
    super('RushSetup');
  }

  create(data: { characterId: string }): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(200, 6, 9, 19);
    cam.scrollY = 0;
    const bg = this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setScrollFactor(0);

    const save = loadSave();
    const chara = CHARACTERS[data.characterId] ?? CHARACTERS.kuya;
    const known = new Set(save.codex);
    const pool = ART_IDS.filter((id) => known.has(id) && !chara.excludedArts.includes(id));
    const picked = new Set<string>((save.lastRushArts ?? []).filter((id) => pool.includes(id)));
    // サポート：図鑑に登録済みのもの（`passive:ID`）から、supportCount まで。0でもよい
    const supPool = Object.values(PASSIVES).filter((p) => known.has(`passive:${p.id}`)).map((p) => p.id);
    const pickedSup = new Set<string>((save.lastRushSupports ?? []).filter((id) => supPool.includes(id)));

    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'BOSS RUSH', { fontFamily: FONT_EN, fontSize: '44px', color: '#FF8C42', fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 44, `共鳴アーツを${RUSH.pickCount}つ、サポートを${RUSH.supportCount}つまで選ぶ（全部 最大Lvで始まる）`, { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);
    this.add.text(W / 2, top + 70, `${chara.name}　／　Lv${RUSH.fixedLevel} 固定・永続強化なし`, { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.accent }).setOrigin(0.5);
    const count = this.add.text(W / 2, top + 100, '', { fontFamily: FONT_EN, fontSize: '22px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(0.5);

    const rowW = Math.min(660, W - 40);
    const left = (W - rowW) / 2;
    const rowH = 64;
    let y = top + 130;
    const frames = new Map<string, Phaser.GameObjects.Rectangle>();
    const marks = new Map<string, Phaser.GameObjects.Text>();
    const supFrames = new Map<string, Phaser.GameObjects.Rectangle>();
    const supMarks = new Map<string, Phaser.GameObjects.Text>();
    let startBtn: Phaser.GameObjects.Container | null = null;

    const refresh = () => {
      for (const id of pool) {
        const on = picked.has(id);
        frames.get(id)?.setStrokeStyle(2, on ? 0xffd700 : WEAPONS[id].color, on ? 1 : 0.5).setFillStyle(0x111a3a, on ? 1 : 0.85);
        marks.get(id)?.setText(on ? '✓' : '').setVisible(on);
      }
      for (const id of supPool) {
        const on = pickedSup.has(id);
        supFrames.get(id)?.setStrokeStyle(2, on ? 0xffd700 : PASSIVES[id].color, on ? 1 : 0.5).setFillStyle(0x111a3a, on ? 1 : 0.85);
        supMarks.get(id)?.setVisible(on);
      }
      count.setText(`ARTS ${picked.size} / ${RUSH.pickCount}　　SUPPORT ${pickedSup.size} / ${RUSH.supportCount}`);
      if (startBtn) {
        const ok = picked.size === RUSH.pickCount;
        startBtn.setAlpha(ok ? 1 : 0.4);
        (startBtn.list[1] as Phaser.GameObjects.Rectangle).setFillStyle(ok ? 0x87ceeb : 0x111a3a, 1);
        (startBtn.list[2] as Phaser.GameObjects.Text).setColor(ok ? '#060913' : COLOR_HEX.dim);
      }
    };

    if (pool.length < RUSH.pickCount) {
      this.add.text(W / 2, y + 40, `図鑑に登録された共鳴アーツが ${pool.length} 種類です。\n${RUSH.pickCount}種類以上を、ふつうのステージで借りてから来てください。`, {
        fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.white, align: 'center', lineSpacing: 8,
      }).setOrigin(0.5, 0);
      y += 140;
    }

    const section = (label: string) => {
      this.add.text(left, y, label, { fontFamily: FONT_EN, fontSize: '18px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 3 });
      y += 28;
    };
    section('ARTS');
    for (const id of pool) {
      const def = WEAPONS[id];
      const frame = this.add.rectangle(left, y, rowW, rowH - 8, 0x111a3a, 0.85).setOrigin(0).setStrokeStyle(2, def.color, 0.5).setInteractive({ useHandCursor: true });
      frames.set(id, frame);
      this.add.rectangle(left + 4, y + 8, 6, rowH - 24, def.color, 1).setOrigin(0);
      // 顔
      let tx = left + 22;
      const pid = PORTRAITS[def.owner.split('・')[0].trim()];
      const pkey = pid ? portraitKey(pid) : '';
      if (pkey && this.textures.exists(pkey)) {
        const fr = 20;
        const face = this.add.image(left + 22 + fr, y + (rowH - 8) / 2, pkey).setDisplaySize(fr * 2.2, fr * 2.2);
        const m = this.make.graphics({ x: 0, y: 0 }, false);
        m.fillStyle(0xffffff, 1);
        m.fillCircle(face.x, face.y, fr);
        face.setMask(m.createGeometryMask());
        tx = left + 22 + fr * 2 + 12;
      }
      this.add.text(tx, y + 8, def.name, { fontFamily: FONT_JP, fontSize: '21px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(tx, y + 34, `${def.owner}　${def.desc}`, { fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.dim, wordWrap: { width: rowW - (tx - left) - 70 } }).setCrop(0, 0, rowW - (tx - left) - 70, 18);
      const mark = this.add.text(left + rowW - 22, y + (rowH - 8) / 2, '✓', { fontFamily: FONT_EN, fontSize: '30px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(1, 0.5);
      marks.set(id, mark);
      let pressedAt = -1;
      frame.on('pointerdown', (p: Phaser.Input.Pointer) => { pressedAt = p.y; });
      frame.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (pressedAt < 0 || Math.abs(p.y - pressedAt) > 12) { pressedAt = -1; return; }
        pressedAt = -1;
        if (picked.has(id)) picked.delete(id);
        else if (picked.size < RUSH.pickCount) picked.add(id);
        else return;
        AudioBus.play('se_item', 60);
        refresh();
      });
      y += rowH;
    }

    // サポート（任意。最大Lvで始まる）
    if (supPool.length > 0) {
      y += 10;
      section('SUPPORT');
      const sh = 56;
      for (const id of supPool) {
        const def = PASSIVES[id];
        const frame = this.add.rectangle(left, y, rowW, sh - 8, 0x111a3a, 0.85).setOrigin(0).setStrokeStyle(2, def.color, 0.5).setInteractive({ useHandCursor: true });
        supFrames.set(id, frame);
        this.add.rectangle(left + 4, y + 8, 6, sh - 24, def.color, 1).setOrigin(0);
        this.add.text(left + 22, y + 6, def.name, { fontFamily: FONT_JP, fontSize: '19px', color: COLOR_HEX.white, fontStyle: '700' });
        this.add.text(left + 22, y + 30, `${def.owner}　${def.desc}`, { fontFamily: FONT_JP, fontSize: '12px', color: COLOR_HEX.dim }).setCrop(0, 0, rowW - 92, 16);
        const mark = this.add.text(left + rowW - 22, y + (sh - 8) / 2, '✓', { fontFamily: FONT_EN, fontSize: '28px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(1, 0.5);
        supMarks.set(id, mark);
        let pressedAt = -1;
        frame.on('pointerdown', (p: Phaser.Input.Pointer) => { pressedAt = p.y; });
        frame.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (pressedAt < 0 || Math.abs(p.y - pressedAt) > 12) { pressedAt = -1; return; }
          pressedAt = -1;
          if (pickedSup.has(id)) pickedSup.delete(id);
          else if (pickedSup.size < RUSH.supportCount) pickedSup.add(id);
          else return;
          AudioBus.play('se_item', 60);
          refresh();
        });
        y += sh;
      }
    }

    const by = Math.max(H - Math.max(90, H * 0.08), y + 60);
    makeButton(this, W / 2 - 150, by, 'BACK', () => this.scene.start('StageSelect'), { width: 240, height: 60, fontSize: 22 });
    startBtn = makeButton(this, W / 2 + 150, by, 'START', () => {
      if (picked.size !== RUSH.pickCount) return;
      const arts = pool.filter((id) => picked.has(id));
      const supports = supPool.filter((id) => pickedSup.has(id));
      const sv = loadSave();
      sv.lastRushArts = arts;
      sv.lastRushSupports = supports;
      writeSave(sv);
      AudioBus.playBgm('bgm_title');
      this.cameras.main.fadeOut(250, 6, 9, 19);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { characterId: chara.id, stageId: RUSH_STAGE.id, rushArts: arts, rushSupports: supports }));
    }, { width: 240, height: 60, fontSize: 24, primary: true });
    refresh();

    // 縦スクロール（アーツが多いとき）
    const maxScroll = Math.max(0, by + 90 - H);
    let dragY: number | null = null;
    let dragStart = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; dragStart = cam.scrollY; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === null || !p.isDown) return;
      cam.scrollY = Phaser.Math.Clamp(dragStart - (p.y - dragY), 0, maxScroll);
      bg.tilePositionY = cam.scrollY * 0.3;
    });
    const endDrag = () => { dragY = null; };
    this.input.on('pointerup', endDrag);
    this.input.on('pointerupoutside', endDrag);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.6, 0, maxScroll);
    });
  }
}
