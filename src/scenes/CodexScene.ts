import Phaser from 'phaser';
import { WEAPONS, type WeaponDef } from '../data/weapons';

/** 図鑑の1項目（共鳴アーツ・合体アーツ・サポートで共通に使う部分） */
type CodexDef = Pick<WeaponDef, 'id' | 'name' | 'owner' | 'desc' | 'color'> & { evolution?: WeaponDef['evolution'] };
import { PASSIVES } from '../data/passives';
import { FUSIONS } from '../data/fusions';
import { PORTRAITS, portraitKey } from '../data/portraits';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave, type SaveData } from '../utils/storage';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { CODEX_CHARACTERS, CODEX_ENEMIES, BESTIARY_INTRO, bestiaryKey, type CodexEnemy } from '../data/codex';
import { isCharacterOwned } from '../utils/unlock';
import { ensureBestiary } from '../utils/bestiary';
import { OPTIONAL_IMAGES, hasOptionalImage } from '../utils/optionalAssets';
import { wrapJa } from '../utils/wrapJa';
import { makeButton } from '../ui/Button';
import { voiceFiles, voiceFilesOf, VOICE_KIND_ORDER, VOICE_KIND_LABEL, UNION_FUSION } from '../data/voice';
import { AudioBus } from '../utils/audio';
import { go as goScene, wipeIn, panel as uiPanel, UI } from '../ui/theme';

type Tab = 'arts' | 'chara' | 'enemy';
const TABS: { id: Tab; label: string }[] = [
  { id: 'arts', label: '共鳴アーツ' },
  { id: 'chara', label: 'キャラクター' },
  { id: 'enemy', label: 'ネミノクス' },
];

/** 未登録の絵を塗りつぶす色（シルエット） */
const SILHOUETTE = 0x24305c;

interface Area { x: number; y: number; w: number; h: number }
interface TabResult { found: number; total: number; pages: number }

/**
 * 図鑑。3つのタブに分かれる（追補パッチ⑩）。
 * - 共鳴アーツ（v2 §10.5）：一度手に入れたアーツ・進化・合体・サポートが登録される。未発見は「???」。ヒントは半分だけ示す。
 * - キャラクター：操作キャラ。解放された時に登録。隠しキャラは、解放するまで項目そのものを出さない。
 * - ネミノクス：敵。初めて遭遇した時に登録。先頭のページは総説と一覧。
 */
export class CodexScene extends Phaser.Scene {
  private tab: Tab = 'arts';
  private page = 0;
  private openedAt = 0;

  constructor() {
    super('Codex');
  }

  create(data?: { tab?: Tab; page?: number }): void {
    this.tab = data?.tab ?? 'arts';
    this.page = data?.page ?? 0;
    this.openedAt = performance.now();
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    wipeIn(this);
    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setDepth(-5);

    const save = loadSave();
    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'RESONANCE CODEX', { fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.drawTabs(W, top + 56);

    const by = H - Math.max(90, H * 0.08);
    // 横長の画面（PC）では、キャラクターとネミノクスの欄を中央に寄せる（共鳴アーツは従来どおり横幅いっぱい）
    const aw = this.tab === 'arts' ? W - 56 : Math.min(W - 56, 960);
    const area: Area = { x: (W - aw) / 2, y: top + 120, w: aw, h: by - 46 - (top + 120) };
    const res = this.tab === 'arts' ? this.drawArts(save, area) : this.tab === 'chara' ? this.drawCharacters(save, area) : this.drawEnemies(save, area);
    this.add.text(W / 2, top + 98, `${res.found} / ${res.total}　　${this.page + 1} / ${res.pages}`, { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(0.5);

    const go = (d: number) => {
      const next = Phaser.Math.Clamp(this.page + d, 0, res.pages - 1);
      if (next !== this.page) this.scene.restart({ tab: this.tab, page: next });
    };
    makeButton(this, W / 2 - 200, by, '◀', () => go(-1), { width: 100, height: 60, fontSize: 26 });
    makeButton(this, W / 2, by, 'TITLE', () => goScene(this, 'Title'), { width: 200, height: 60, fontSize: 24 });
    makeButton(this, W / 2 + 200, by, '▶', () => go(1), { width: 100, height: 60, fontSize: 26 });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') go(1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') go(-1);
      else if (ev.key === 'Escape') goScene(this, 'Title');
    });
  }

  /** 開いた直後のタップは受け付けない（前の画面のタップの続きで、別の項目が開くのを防ぐ） */
  private armed(): boolean {
    return performance.now() - this.openedAt > 250;
  }

  /** 押し始めと離した位置が同じ枠の上にある時だけ反応する枠 */
  private tapZone(x: number, y: number, w: number, h: number, onTap: () => void): void {
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    let pressed = false;
    z.on('pointerdown', () => { pressed = this.armed(); });
    z.on('pointerout', () => { pressed = false; });
    z.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      onTap();
    });
  }

  private drawTabs(W: number, cy: number): void {
    const gap = 8;
    const tw = Math.min(216, Math.floor((W - 56 - gap * 2) / 3));
    const th = 46;
    const x0 = W / 2 - (tw * 3 + gap * 2) / 2;
    TABS.forEach((t, i) => {
      const on = t.id === this.tab;
      const x = x0 + i * (tw + gap);
      uiPanel(this, x, cy - th / 2, tw, th, { fill: on ? 0x87ceeb : UI.fill, alpha: on ? 1 : 0.92, strokeAlpha: on ? 1 : 0.5, stripe: false, cut: 10 });
      this.add.text(x + tw / 2, cy, t.label, { fontFamily: FONT_JP, fontSize: '20px', color: on ? '#060913' : COLOR_HEX.white, fontStyle: '700' }).setOrigin(0.5);
      if (!on) this.tapZone(x, cy - th / 2, tw, th, () => this.scene.restart({ tab: t.id, page: 0 }));
    });
  }

  /** 使う場面で読む画像を読んでから呼ぶ（読み込み済みならすぐ呼ぶ）。無い画像なら呼ばない */
  private withImage(key: string, then: () => void): void {
    if (this.textures.exists(key)) {
      then();
      return;
    }
    if (!hasOptionalImage(key)) return;
    this.load.image(key, OPTIONAL_IMAGES[key]);
    this.load.once(`filecomplete-image-${key}`, () => {
      // 大きな絵を縮めて出すので、なめらかに
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (this.scene.isActive()) then();
    });
    this.load.start();
  }

  /** 枠に収まる大きさで絵を置く（下端を枠の下端に合わせる） */
  private fitImage(img: Phaser.GameObjects.Image, a: Area): void {
    const s = Math.min(a.w / img.width, a.h / img.height);
    img.setOrigin(0.5, 1).setScale(s).setPosition(a.x + a.w / 2, a.y + a.h);
  }

  /** 名前・分類・紹介文の枠 */
  private infoPanel(a: Area, o: { name: string; reading?: string; tag: string; tagColor: string; text: string; known: boolean; color: number }): void {
    uiPanel(this, a.x, a.y, a.w, a.h, { color: o.known ? o.color : 0x3a4a8a, alpha: 0.96, strokeAlpha: o.known ? 0.8 : 0.4 });
    const tx = a.x + 26;
    const name = this.add.text(tx, a.y + 14, o.name, { fontFamily: FONT_JP, fontSize: '30px', color: o.known ? COLOR_HEX.white : '#5A6488', fontStyle: '700' });
    if (o.reading) this.add.text(name.x + name.width + 14, a.y + 30, o.reading, { fontFamily: FONT_JP, fontSize: '16px', color: COLOR_HEX.dim });
    this.add.text(tx, a.y + 58, o.tag, { fontFamily: FONT_JP, fontSize: '17px', color: o.tagColor, fontStyle: '700' });
    this.add.text(tx, a.y + 92, o.text, {
      fontFamily: FONT_JP, fontSize: '18px', color: o.known ? COLOR_HEX.white : COLOR_HEX.dim, lineSpacing: 7,
      wordWrap: { width: a.w - 52, callback: wrapJa },
    });
  }

  // ───────────────────────── キャラクター ─────────────────────────

  private drawCharacters(save: SaveData, area: Area): TabResult {
    // 隠しキャラは、解放するまで項目そのものを出さない（件数にも数えない）
    const list = CODEX_CHARACTERS.filter((c) => CHARACTERS[c.id] && (!CHARACTERS[c.id].secret || isCharacterOwned(c.id, save)));
    const pages = list.length;
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const c = list[this.page];
    const def = CHARACTERS[c.id];
    const known = isCharacterOwned(c.id, save);

    const panelH = 232;
    const panel: Area = { x: area.x, y: area.y + area.h - panelH, w: area.w, h: panelH };
    // 勝利立ち絵は膝上で切れているので、下端を紹介文の枠の裏に少し隠す
    const pic: Area = { x: area.x, y: area.y, w: area.w, h: area.h - panelH + 28 };

    // 絵：勝利立ち絵 → タップでゲームオーバーの絵。無ければ通常の立ち絵
    const keys = [`victory_${c.id}`, `gameover_${c.id}`].filter((k) => hasOptionalImage(k));
    if (!keys.length && this.textures.exists(`standing_${c.id}`)) keys.push(`standing_${c.id}`);
    let shown = 0;
    let img: Phaser.GameObjects.Image | null = null;
    const show = (i: number) => {
      const key = keys[i];
      this.withImage(key, () => {
        shown = i;
        if (!img) img = this.add.image(0, 0, key).setDepth(-2);
        else img.setTexture(key);
        this.fitImage(img, pic);
        if (!known) img.setTintFill(SILHOUETTE);
      });
    };
    if (keys.length) show(0);
    if (known && keys.length > 1) {
      this.tapZone(pic.x, pic.y, pic.w, panel.y - pic.y, () => show((shown + 1) % keys.length));
    }

    this.infoPanel(panel, known
      ? { name: c.name, reading: c.reading, tag: `クラス：${c.cls}`, tagColor: COLOR_HEX.accent, text: c.text, known, color: def.color }
      : { name: '???', tag: 'クラス：???', tagColor: COLOR_HEX.dim, text: 'まだ、解放していない。', known, color: def.color });
    if (known && keys.length > 1) {
      this.add.text(panel.x + panel.w - 18, panel.y + 22, '絵をタップで切り替え', { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim }).setOrigin(1, 0);
    }
    // ボイス鑑賞（2026-10-05 ユーザー承認）：解放済みで、ボイスのファイルがあるキャラだけ
    if (known && voiceFilesOf(c.id).length > 0) {
      makeButton(this, panel.x + panel.w - 18 - 60, panel.y + panel.h - 18 - 22, '♪ VOICE', () => this.openVoiceList(c.id, c.name, def.color, save), { width: 120, height: 44, fontSize: 18 });
    }

    return { found: list.filter((x) => isCharacterOwned(x.id, save)).length, total: list.length, pages };
  }

  /**
   * ボイスの一覧（紹介文の上に重ねる）。種類ごとに1行、差分が2つあれば ①② の2つのボタン。ファイルが無い種類は出さない。
   * 再生は鑑賞用の口（間引き・優先度なし。鳴っている途中に別を押せば切り替わる）。台詞の文字は出さない（台本案と音声がずれているものがあるため）。
   * 専用合体技の名前は、図鑑で未発見なら「？？？」
   */
  private openVoiceList(id: string, name: string, color: number, save: SaveData): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const layer = this.add.container(0, cam.scrollY).setDepth(80);
    const shade = this.add.rectangle(0, 0, W, H, 0x020308, 0.92).setOrigin(0).setInteractive();
    layer.add(shade);
    const top = Math.max(H * 0.06, 40);
    layer.add(this.add.text(W / 2, top, 'VOICE', { fontFamily: FONT_EN, fontSize: '40px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 6 }).setOrigin(0.5));
    layer.add(this.add.text(W / 2, top + 44, `${name}　のボイス`, { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5));
    const kinds = VOICE_KIND_ORDER.filter((k) => voiceFiles(id, k).length > 0);
    const rowW = Math.min(620, W - 40);
    const left = (W - rowW) / 2;
    const bottomY = Math.min(H - 70, H * 0.9);
    const rowH = Math.max(40, Math.min(52, Math.floor((bottomY - 60 - (top + 80)) / Math.max(1, kinds.length))));
    let y = top + 80;
    let playing: Phaser.GameObjects.Text | null = null;
    const close = () => {
      AudioBus.stopVoice();
      layer.destroy();
    };
    for (const k of kinds) {
      const files = voiceFiles(id, k);
      let label = VOICE_KIND_LABEL[k];
      if (k === 'union') {
        const artId = UNION_FUSION[id];
        const art = artId ? WEAPONS[artId] : undefined;
        label += art ? `『${save.codex.includes(artId) ? art.name : '？？？'}』` : '';
      }
      layer.add(uiPanel(this, left, y, rowW, rowH - 6, { color, alpha: 0.95, strokeAlpha: 0.5, cut: 12 }).gfx);
      layer.add(this.add.text(left + 18, y + (rowH - 6) / 2, label, { fontFamily: FONT_JP, fontSize: rowH < 48 ? '17px' : '19px', color: COLOR_HEX.white, fontStyle: '700' }).setOrigin(0, 0.5));
      files.forEach((f, i) => {
        const bx = left + rowW - 14 - 30 - (files.length - 1 - i) * 66;
        const btn = makeButton(this, bx, y + (rowH - 6) / 2, files.length > 1 ? `▶ ${i + 1}` : '▶', () => {
          AudioBus.previewVoice(id, f, this);
          playing?.setColor(COLOR_HEX.white);
          playing = btn.list[2] as Phaser.GameObjects.Text;
          playing.setColor(COLOR_HEX.gold);
        }, { width: 58, height: Math.min(40, rowH - 14), fontSize: 17, armDelayMs: 150 });
        layer.add(btn);
      });
      y += rowH;
    }
    layer.add(makeButton(this, W / 2, Math.min(H - 60, y + 44), 'CLOSE', close, { width: 220, height: 56, fontSize: 22, armDelayMs: 200 }));
    this.input.keyboard?.once('keydown-ESC', close);
  }

  // ───────────────────────── ネミノクス ─────────────────────────

  /** ゲーム内のドット（歩きアニメ）。まだゲームに出ない敵は null */
  private enemyDot(e: CodexEnemy, x: number, y: number, scale: number, known: boolean): Phaser.GameObjects.Sprite | null {
    if (!e.enemyId) return null;
    const def = ENEMIES[e.enemyId];
    const tex = def.sheet ? `e_${def.id}` : `e_${def.id}_0`;
    if (!this.textures.exists(tex)) return null;
    const sp = this.add.sprite(x, y, tex).setOrigin(0.5, 1).setScale(scale);
    sp.play(`anim_e_${def.id}`, true);
    if (!known) sp.setTintFill(SILHOUETTE);
    return sp;
  }

  private drawEnemies(save: SaveData, area: Area): TabResult {
    const seen = new Set(ensureBestiary(save));
    const isKnown = (e: CodexEnemy) => !!e.enemyId && seen.has(e.enemyId);
    const pages = CODEX_ENEMIES.length + 1;
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const result: TabResult = { found: CODEX_ENEMIES.filter(isKnown).length, total: CODEX_ENEMIES.length, pages };

    // 先頭のページ：総説と一覧
    if (this.page === 0) {
      const body = this.add.text(area.x + 26, area.y + 58, BESTIARY_INTRO.text, {
        fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.white, lineSpacing: 7, wordWrap: { width: area.w - 52, callback: wrapJa },
      });
      const introH = 58 + body.height + 22;
      uiPanel(this, area.x, area.y, area.w, introH, { alpha: 0.94, strokeAlpha: 0.6, depth: -1 });
      this.add.text(area.x + 26, area.y + 14, BESTIARY_INTRO.title, { fontFamily: FONT_JP, fontSize: '28px', color: COLOR_HEX.accent, fontStyle: '700' });

      const gap = 12;
      const cols = 3;
      const rows = Math.ceil(CODEX_ENEMIES.length / cols);
      const gy = area.y + introH + 16;
      const cw = Math.floor((area.w - gap * (cols - 1)) / cols);
      const ch = Math.min(250, Math.floor((area.y + area.h - gy - gap * (rows - 1)) / rows));
      CODEX_ENEMIES.forEach((e, i) => {
        const x = area.x + (i % cols) * (cw + gap);
        const y = gy + Math.floor(i / cols) * (ch + gap);
        const known = isKnown(e);
        uiPanel(this, x, y, cw, ch, { color: known ? 0x87ceeb : 0x3a4a8a, alpha: 0.92, strokeAlpha: known ? 0.8 : 0.4, stripe: false, cut: 12 });
        const iconH = ch - 50;
        if (known && e.enemyId) {
          const size = ENEMIES[e.enemyId].sheet?.frameHeight ?? ENEMIES[e.enemyId].size;
          const s = Math.max(1, Math.floor((iconH - 12) / size));
          this.enemyDot(e, x + cw / 2, y + 6 + (iconH + size * s) / 2, s, true);
        } else {
          this.add.text(x + cw / 2, y + 6 + iconH / 2, '?', { fontFamily: FONT_EN, fontSize: '56px', color: '#5A6488', fontStyle: '700' }).setOrigin(0.5);
        }
        this.add.text(x + cw / 2, y + ch - 26, known ? e.name : '???', { fontFamily: FONT_JP, fontSize: '18px', color: known ? COLOR_HEX.white : '#5A6488', fontStyle: '700' }).setOrigin(0.5);
        this.tapZone(x, y, cw, ch, () => this.scene.restart({ tab: 'enemy', page: i + 1 }));
      });
      return result;
    }

    // 2ページ目から：1体ずつ
    const e = CODEX_ENEMIES[this.page - 1];
    const known = isKnown(e);
    const panelH = 190;
    const panel: Area = { x: area.x, y: area.y + area.h - panelH, w: area.w, h: panelH };
    const pic: Area = { x: area.x, y: area.y, w: area.w, h: area.h - panelH - 16 };
    const artKey = bestiaryKey(e.id);

    if (e.art && hasOptionalImage(artKey)) {
      // 設定画を大きく。右下に、ゲーム内のドットを小さく添える
      this.withImage(artKey, () => {
        const img = this.add.image(0, 0, artKey).setDepth(-1);
        this.fitImage(img, pic);
        if (!known) img.setTintFill(SILHOUETTE);
      });
      if (known && e.enemyId) {
        const size = ENEMIES[e.enemyId].size;
        const s = Math.max(1, Math.round(100 / size));
        // ボスのドットは大きいので、枠を広げる
        const bw = Math.max(150, size * s + 40);
        const bx = pic.x + pic.w - bw;
        const byy = pic.y + pic.h - bw;
        uiPanel(this, bx, byy, bw, bw, { fill: 0x0b1026, alpha: 0.85, strokeAlpha: 0.5, stripe: false, cut: 10 });
        this.add.text(bx + bw / 2, byy + 16, 'IN GAME', { fontFamily: FONT_EN, fontSize: '14px', color: COLOR_HEX.dim, fontStyle: '700', letterSpacing: 2 }).setOrigin(0.5);
        this.enemyDot(e, bx + bw / 2, byy + 28 + (bw - 36 + size * s) / 2, s, true);
      }
    } else if (e.enemyId) {
      // 設定画が無い敵は、ゲーム内のドットを大きく（整数倍）
      const size = ENEMIES[e.enemyId].sheet?.frameHeight ?? ENEMIES[e.enemyId].size;
      const s = Phaser.Math.Clamp(Math.floor(Math.min(pic.w, pic.h) / size), 1, 5);
      this.enemyDot(e, pic.x + pic.w / 2, pic.y + (pic.h + size * s) / 2, s, known);
    } else {
      this.add.text(pic.x + pic.w / 2, pic.y + pic.h / 2, '?', { fontFamily: FONT_EN, fontSize: '160px', color: '#3A4A8A', fontStyle: '700' }).setOrigin(0.5);
    }

    const color = e.enemyId ? ENEMIES[e.enemyId].eyeColor : 0x87ceeb;
    this.infoPanel(panel, known
      ? { name: e.name, reading: e.reading, tag: `ランク：${e.rank}`, tagColor: COLOR_HEX.gold, text: e.text, known, color }
      : { name: '???', tag: 'ランク：???', tagColor: COLOR_HEX.dim, text: 'まだ、遭遇していない。', known, color });
    return result;
  }

  // ───────────────────────── 共鳴アーツ ─────────────────────────

  private drawArts(save: SaveData, area: Area): TabResult {
    const found = new Set(save.codex);
    // 項目：共鳴アーツ（合体以外）→ 合体アーツ → サポート
    const arts = Object.values(WEAPONS).filter((w) => w.kind === 'art' && !w.fusion);
    // 隠しキャラ専用の合体は、そのキャラを解放するまで行ごと出さない（総数にも数えない）
    const fusions = FUSIONS.filter((f) => !f.secretOf || isCharacterOwned(f.secretOf, save)).map((f) => ({ f, def: WEAPONS[f.id] }));
    const rows: { def: CodexDef; fusionHint?: string; fusionOf?: [string, string]; requiredChara?: string; passiveId?: string }[] = [
      ...arts.map((def) => ({ def })),
      ...fusions.map(({ f, def }) => ({ def, fusionHint: f.hint, fusionOf: [f.a, f.b] as [string, string], requiredChara: f.requiredChara })),
      ...Object.values(PASSIVES).map((p) => ({ def: { id: `passive:${p.id}`, name: p.name, owner: p.owner, desc: p.desc, color: p.color }, passiveId: p.id })),
    ];
    const perPage = 6;
    const pages = Math.ceil(rows.length / perPage);
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const discovered = rows.filter((r) => found.has(r.def.id)).length;

    const left = area.x;
    const rowW = area.w;
    const rowH = 148;
    let y = area.y;
    rows.slice(this.page * perPage, (this.page + 1) * perPage).forEach((r) => {
      const def = r.def;
      const known = found.has(def.id);
      const evoKnown = found.has(`${def.id}:evo`);
      const color = known ? def.color : 0x3a4a8a;
      uiPanel(this, left, y, rowW, rowH - 10, { color, alpha: 0.92, strokeAlpha: known ? 0.8 : 0.4 });

      // 顔（発見済みのみ）
      let tx = left + 22;
      const owners = def.owner.split('・');
      if (known) {
        owners.slice(0, 2).forEach((owner, k) => {
          const id = PORTRAITS[owner.trim()];
          const key = id ? portraitKey(id) : '';
          if (!key || !this.textures.exists(key)) return;
          const fr = 30;
          const fx = left + 22 + fr + k * 54;
          const fy = y + 12 + fr;
          const face = this.add.image(fx, fy, key).setDisplaySize(fr * 2.2, fr * 2.2);
          const m = this.make.graphics({ x: 0, y: 0 }, false);
          m.fillStyle(0xffffff, 1);
          m.fillCircle(fx, fy, fr);
          face.setMask(m.createGeometryMask());
          const ring = this.add.graphics();
          ring.lineStyle(2, def.color, 1);
          ring.strokeCircle(fx, fy, fr + 1);
          tx = fx + fr + 14;
        });
      } else {
        const fr = 30;
        this.add.circle(left + 22 + fr, y + 12 + fr, fr, 0x0b1026, 1).setStrokeStyle(2, 0x3a4a8a, 0.6);
        this.add.text(left + 22 + fr, y + 12 + fr, '?', { fontFamily: FONT_EN, fontSize: '30px', color: '#5A6488', fontStyle: '700' }).setOrigin(0.5);
        tx = left + 22 + fr * 2 + 14;
      }

      const title = known ? def.name : '???';
      const sub = known ? `${r.passiveId ? 'サポート　' : ''}${def.owner}` : r.fusionOf ? '合体アーツ' : r.passiveId ? 'サポート' : '共鳴アーツ';
      this.add.text(tx, y + 10, title, { fontFamily: FONT_JP, fontSize: '24px', color: known ? COLOR_HEX.white : '#5A6488', fontStyle: '700' });
      this.add.text(tx, y + 40, sub, { fontFamily: FONT_JP, fontSize: '14px', color: COLOR_HEX.dim });
      const descW = rowW - (tx - left) - 16;
      const body = known ? def.desc : r.fusionHint ? `ヒント：${r.fusionHint}` : 'まだ、この声は借りていない。';
      this.add.text(tx, y + 62, body, { fontFamily: FONT_JP, fontSize: '15px', color: known ? COLOR_HEX.white : COLOR_HEX.dim, wordWrap: { width: descW, useAdvancedWrap: true } });

      // 進化／合体のヒント行
      let line = '';
      let lineColor: string = COLOR_HEX.dim;
      if (def.evolution) {
        const pName = PASSIVES[def.evolution.passiveId]?.name ?? '';
        if (evoKnown) { line = `進化：『${def.evolution.name}』（＋${pName}）`; lineColor = COLOR_HEX.gold; }
        else if (known) line = `進化：『${pName.slice(0, 2)}…』と共鳴すると……`;
      } else if (r.fusionOf) {
        const [a, b] = r.fusionOf;
        const ka = found.has(a) ? WEAPONS[a].name : '???';
        const kb = found.has(b) ? WEAPONS[b].name : '???';
        // 操作キャラが決まっている合体は、そのキャラの名前を出す
        const who = r.requiredChara ? (CHARACTERS[r.requiredChara]?.name.split(' ').pop() ?? '') : '';
        line = known ? `合体：『${ka}』×『${kb}』${who ? `　※${who}でのみ` : ''}` : `素材：『${ka}』×『${kb}』…両方Lv8で宝箱を${who ? `（${who}でのみ）` : ''}`;
        if (known) lineColor = COLOR_HEX.gold;
      } else if (r.passiveId) {
        // このサポートを相方にして進化するアーツ（見つけたものだけ名前を出す）
        const partners = arts.filter((a) => a.evolution?.passiveId === r.passiveId);
        if (known && partners.length) line = `進化の相方：${partners.map((a) => (found.has(a.id) ? `『${a.name}』` : '『???』')).join('')}`;
      } else if (def.id === 'monogatari' || def.id === 'sandan') {
        line = known ? '進化：なし' : '';
      }
      if (line) this.add.text(tx, y + rowH - 36, line, { fontFamily: FONT_JP, fontSize: '14px', color: lineColor, wordWrap: { width: descW, useAdvancedWrap: true } });
      y += rowH;
    });
    return { found: discovered, total: rows.length, pages };
  }
}
