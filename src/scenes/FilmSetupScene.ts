import Phaser from 'phaser';
import { WEAPONS, ART_IDS } from '../data/weapons';
import { PASSIVES } from '../data/passives';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters';
import { FUSIONS } from '../data/fusions';
import { PORTRAITS, portraitKey } from '../data/portraits';
import { FILM_STAGE_IDS, loadFilmConfig, saveFilmConfig, type FilmConfig } from '../data/film';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel } from '../ui/theme';
import { AudioBus } from '../utils/audio';
import { enableDragScroll } from '../ui/dragScroll';

const FILM_COLOR = 0x7cffb2;
const FILM_HEX = '#7CFFB2';

/**
 * 撮影モードの準備（`?film` のときだけ。2026-10-25 ユーザー承認）。
 * キャラ・背景・アーツ（Lv／進化／合体）・サポート・開始時の設定を自由に決める。構成は sessionStorage に残る。
 * 戦闘中の操作（敵を出す・HUD・スロー・ズームなど）は GameScene の撮影パネル。
 */
export class FilmSetupScene extends Phaser.Scene {
  constructor() {
    super('FilmSetup');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    wipeIn(this);
    cam.scrollY = 0;
    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setScrollFactor(0);

    const cfg: FilmConfig = loadFilmConfig();
    if (!CHARACTERS[cfg.characterId]) cfg.characterId = 'kuya';
    if (!FILM_STAGE_IDS.some((s) => s.id === cfg.stageId)) cfg.stageId = 1;

    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'FILM', { fontFamily: FONT_EN, fontSize: '44px', color: FILM_HEX, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 44, '撮影用の自由な構成。記録・実績・エールは保存されません', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);
    this.add.text(W / 2, top + 70, '戦闘中は右上の FILM（PC: F キー）で操作パネル。H=HUD／P=停止／O=コマ送り／Z=ズーム／I=敵不死／X=攻撃停止／1〜5=雑魚／6〜0=ボス', { fontFamily: FONT_JP, fontSize: '13px', color: COLOR_HEX.accent }).setOrigin(0.5);

    const rowW = Math.min(660, W - 40);
    const left = (W - rowW) / 2;
    let y = top + 104;
    const gap = 8;

    const section = (label: string) => {
      this.add.text(left, y, label, { fontFamily: FONT_EN, fontSize: '18px', color: FILM_HEX, fontStyle: '700', letterSpacing: 3 });
      y += 28;
    };
    const tapGuard = (hit: Phaser.GameObjects.Rectangle, onTap: () => void) => {
      let pressedAt = -1;
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => { pressedAt = p.y; });
      hit.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (pressedAt < 0 || Math.abs(p.y - pressedAt) > 12) { pressedAt = -1; return; }
        pressedAt = -1;
        AudioBus.play('se_item', 60);
        onTap();
      });
    };
    /** 小さな選択肢（横に並べる）。set(label, on) で表示を更新 */
    const chip = (x: number, cy: number, w: number, h: number, label: string, on: boolean, onTap: () => void) => {
      const pn = panel(this, x, cy, w, h, { color: FILM_COLOR, alpha: on ? 1 : 0.55, strokeAlpha: on ? 1 : 0.35, cut: 10 });
      const tx = this.add.text(x + w / 2, cy + h / 2, label, { fontFamily: FONT_JP, fontSize: '16px', color: on ? COLOR_HEX.white : COLOR_HEX.dim, fontStyle: '700' }).setOrigin(0.5);
      const hit = this.add.rectangle(x, cy, w, h, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
      tapGuard(hit, onTap);
      return {
        set: (l: string, o: boolean) => {
          pn.redraw({ stroke: FILM_COLOR, strokeAlpha: o ? 1 : 0.35, alpha: o ? 1 : 0.55 });
          tx.setText(l).setColor(o ? COLOR_HEX.white : COLOR_HEX.dim);
        },
      };
    };
    /** チップを横に流して並べる（折り返しあり） */
    const flow = (items: { label: string; on: boolean; run: () => void }[], perRow: number, h = 44) => {
      const w = (rowW - gap * (perRow - 1)) / perRow;
      const setters: ((l: string, o: boolean) => void)[] = [];
      items.forEach((it, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const c = chip(left + col * (w + gap), y + row * (h + gap), w, h, it.label, it.on, it.run);
        setters.push(c.set);
      });
      y += Math.ceil(items.length / perRow) * (h + gap) + 6;
      return setters;
    };
    /** 1行のカード（アーツ・サポート）。右端に状態の文字 */
    const row = (h: number, color: number, name: string, sub: string, state: string, on: boolean, onTap: () => void) => {
      const pn = panel(this, left, y, rowW, h - 8, { color, alpha: on ? 1 : 0.7, strokeAlpha: on ? 1 : 0.35 });
      const hit = this.add.rectangle(left, y, rowW, h - 8, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
      let tx = left + 22;
      const pid = PORTRAITS[name.split('・')[0].trim()] ?? PORTRAITS[sub.split('・')[0].split('　')[0].trim()];
      const pkey = pid ? portraitKey(pid) : '';
      if (pkey && this.textures.exists(pkey)) {
        const fr = 18;
        const face = this.add.image(left + 22 + fr, y + (h - 8) / 2, pkey).setDisplaySize(fr * 2.2, fr * 2.2);
        const m = this.make.graphics({ x: 0, y: 0 }, false);
        m.fillStyle(0xffffff, 1);
        m.fillCircle(face.x, face.y, fr);
        face.setMask(m.createGeometryMask());
        tx = left + 22 + fr * 2 + 12;
      }
      this.add.text(tx, y + 7, name, { fontFamily: FONT_JP, fontSize: '19px', color: COLOR_HEX.white, fontStyle: '700' });
      this.add.text(tx, y + 31, sub, { fontFamily: FONT_JP, fontSize: '12px', color: COLOR_HEX.dim }).setCrop(0, 0, rowW - (tx - left) - 96, 16);
      const st = this.add.text(left + rowW - 18, y + (h - 8) / 2, state, { fontFamily: FONT_EN, fontSize: '22px', color: on ? COLOR_HEX.gold : COLOR_HEX.dim, fontStyle: '700' }).setOrigin(1, 0.5);
      tapGuard(hit, onTap);
      y += h;
      return (s: string, o: boolean) => {
        pn.redraw({ stroke: color, strokeAlpha: o ? 1 : 0.35, alpha: o ? 1 : 0.7 });
        st.setText(s).setColor(o ? COLOR_HEX.gold : COLOR_HEX.dim);
      };
    };

    // ── キャラ（隠しキャラも含めて全員）
    section('CHARACTER');
    const charSetters = flow(CHARACTER_ORDER.map((id) => ({
      label: CHARACTERS[id].name.split(' ').pop() ?? id, on: cfg.characterId === id,
      run: () => { cfg.characterId = id; CHARACTER_ORDER.forEach((cid, i) => charSetters[i](CHARACTERS[cid].name.split(' ').pop() ?? cid, cid === id)); },
    })), 5);

    // ── 背景（ステージ）
    section('STAGE');
    const stageSetters = flow(FILM_STAGE_IDS.map((s) => ({
      label: s.label, on: cfg.stageId === s.id,
      run: () => { cfg.stageId = s.id; FILM_STAGE_IDS.forEach((x, i) => stageSetters[i](x.label, x.id === s.id)); },
    })), 5);

    // ── 開始時の設定
    section('SETTINGS');
    const toggles: { key: keyof FilmConfig; on: string; off: string }[] = [
      { key: 'noSpawn', on: '敵の湧き OFF', off: '敵の湧き ON' },
      { key: 'invincible', on: '無敵 ON', off: '無敵 OFF' },
      { key: 'fullGauge', on: '必殺 満タン', off: '必殺 空' },
      { key: 'noLevelUp', on: 'LvUP画面 なし', off: 'LvUP画面 あり' },
      { key: 'hudOff', on: 'HUD 非表示', off: 'HUD 表示' },
      { key: 'enemyImmortal', on: '敵不死 ON', off: '敵不死 OFF' },
      { key: 'noAttack', on: '攻撃停止 ON', off: '攻撃停止 OFF' },
    ];
    const togSetters = flow(toggles.map((t) => ({
      label: cfg[t.key] ? t.on : t.off, on: !!cfg[t.key],
      run: () => { (cfg[t.key] as boolean) = !cfg[t.key]; const i = toggles.indexOf(t); togSetters[i](cfg[t.key] ? t.on : t.off, !!cfg[t.key]); },
    })), 3);

    // ── 初期武器の Lv（キャラごとに違うので名前は「初期武器」）
    section('MAIN WEAPON');
    const mainLv = [1, 4, 8];
    const mainSet = row(60, FILM_COLOR, '初期武器', '選んだキャラの最初の技。タップで Lv1 → Lv4 → Lv8', `Lv${cfg.mainLevel}`, cfg.mainLevel > 1, () => {
      const i = mainLv.indexOf(cfg.mainLevel);
      cfg.mainLevel = mainLv[(i + 1) % mainLv.length];
      mainSet(`Lv${cfg.mainLevel}`, cfg.mainLevel > 1);
    });

    // ── 共鳴アーツ：OFF → Lv1 → Lv4 → Lv8 → EVO（進化先があるとき）→ OFF
    y += 10;
    section('ARTS');
    for (const id of ART_IDS) {
      const def = WEAPONS[id];
      const cur = () => cfg.arts.find((a) => a.id === id);
      const label = () => { const a = cur(); return !a ? '—' : a.evolved ? 'EVO' : `Lv${a.level}`; };
      const set = row(62, def.color, def.name, `${def.owner}　${def.desc}`, label(), !!cur(), () => {
        const a = cur();
        if (!a) cfg.arts.push({ id, level: 1, evolved: false });
        else if (a.level < 4) a.level = 4;
        else if (a.level < 8) a.level = 8;
        else if (!a.evolved && def.evolution) a.evolved = true;
        else cfg.arts = cfg.arts.filter((x) => x !== a);
        set(label(), !!cur());
      });
    }

    // ── 合体アーツ：素材なしで直接持てる（キャラ限定のものは、そのキャラのときだけ意味がある）
    y += 10;
    section('FUSION');
    for (const f of FUSIONS) {
      const def = WEAPONS[f.id];
      if (!def) continue;
      const a = WEAPONS[f.a];
      const b = WEAPONS[f.b];
      const on = () => cfg.fusions.includes(f.id);
      const limit = f.requiredChara ? `（${CHARACTERS[f.requiredChara]?.name ?? f.requiredChara} 専用）` : '';
      const set = row(62, def.color, def.name, `『${a?.name ?? f.a}』×『${b?.name ?? f.b}』${limit}　${def.desc}`, on() ? 'ON' : '—', on(), () => {
        cfg.fusions = on() ? cfg.fusions.filter((x) => x !== f.id) : [...cfg.fusions, f.id];
        set(on() ? 'ON' : '—', on());
      });
    }

    // ── サポート：OFF → Lv1 → MAX → OFF
    y += 10;
    section('SUPPORT');
    for (const def of Object.values(PASSIVES)) {
      const cur = () => cfg.supports.find((s) => s.id === def.id);
      const label = () => { const s = cur(); return !s ? '—' : s.level >= def.maxLevel ? 'MAX' : `Lv${s.level}`; };
      const set = row(56, def.color, def.name, `${def.owner}　${def.desc}`, label(), !!cur(), () => {
        const s = cur();
        if (!s) cfg.supports.push({ id: def.id, level: 1 });
        else if (s.level < def.maxLevel) s.level = def.maxLevel;
        else cfg.supports = cfg.supports.filter((x) => x !== s);
        set(label(), !!cur());
      });
    }

    const by = Math.max(H - Math.max(90, H * 0.08), y + 60);
    makeButton(this, W / 2 - 150, by, 'TITLE', () => { saveFilmConfig(cfg); go(this, 'Title'); }, { width: 240, height: 60, fontSize: 22 });
    makeButton(this, W / 2 + 150, by, 'START', () => {
      saveFilmConfig(cfg);
      go(this, 'Game', { characterId: cfg.characterId, stageId: cfg.stageId, film: cfg });
    }, { width: 240, height: 60, fontSize: 24, primary: true });

    // 縦スクロール
    const maxScroll = Math.max(0, by + 90 - H);
    enableDragScroll(this, cam, maxScroll);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.6, 0, maxScroll);
    });
  }
}
