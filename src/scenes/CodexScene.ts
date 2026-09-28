import Phaser from 'phaser';
import { WEAPONS, type WeaponDef } from '../data/weapons';

/** 図鑑の1項目（共鳴アーツ・合体アーツ・サポートで共通に使う部分） */
type CodexDef = Pick<WeaponDef, 'id' | 'name' | 'owner' | 'desc' | 'color'> & { evolution?: WeaponDef['evolution'] };
import { PASSIVES } from '../data/passives';
import { FUSIONS } from '../data/fusions';
import { PORTRAITS, portraitKey } from '../data/portraits';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { loadSave } from '../utils/storage';
import { CHARACTERS } from '../data/characters';
import { isCharacterOwned } from '../utils/unlock';
import { makeButton } from '../ui/Button';

/**
 * 共鳴アーツ図鑑（v2 §10.5）。一度手に入れたアーツ・進化・合体・サポートが登録される（サポートは追補パッチ⑥で追加）。
 * 未発見は「???」。ヒントは半分だけ示す。
 */
export class CodexScene extends Phaser.Scene {
  private page = 0;

  constructor() {
    super('Codex');
  }

  create(data?: { page?: number }): void {
    this.page = data?.page ?? 0;
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(200, 6, 9, 19);
    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0);

    const save = loadSave();
    const found = new Set(save.codex);
    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'RESONANCE CODEX', { fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 42, '共鳴アーツ図鑑 —— 借りた声の記録', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);

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
    this.add.text(W / 2, top + 70, `${discovered} / ${rows.length}　　${this.page + 1} / ${pages}`, { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(0.5);

    const left = 28;
    const rowW = W - left * 2;
    const rowH = 148;
    let y = top + 104;
    rows.slice(this.page * perPage, (this.page + 1) * perPage).forEach((r) => {
      const def = r.def;
      const known = found.has(def.id);
      const evoKnown = found.has(`${def.id}:evo`);
      const color = known ? def.color : 0x3a4a8a;
      this.add.rectangle(left, y, rowW, rowH - 10, 0x111a3a, 0.92).setOrigin(0).setStrokeStyle(2, color, known ? 0.8 : 0.4);
      this.add.rectangle(left + 4, y + 8, 6, rowH - 26, color, 1).setOrigin(0);

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

    const by = H - Math.max(90, H * 0.08);
    makeButton(this, W / 2 - 200, by, '◀', () => this.scene.restart({ page: this.page - 1 }), { width: 100, height: 60, fontSize: 26 });
    makeButton(this, W / 2, by, 'TITLE', () => this.scene.start('Title'), { width: 200, height: 60, fontSize: 24 });
    makeButton(this, W / 2 + 200, by, '▶', () => this.scene.restart({ page: this.page + 1 }), { width: 100, height: 60, fontSize: 26 });
  }
}
