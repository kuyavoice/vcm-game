import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';

interface Page {
  title: string;
  en: string;
  /** 見出し（色付き）と本文の組 */
  items: { head: string; body: string }[];
}

// 本編の出来事には触れない。遊び方だけを書く。隠し要素には触れない
const PAGES: Page[] = [
  {
    title: '基本', en: 'BASICS',
    items: [
      { head: '移動', body: '画面をなぞると、その方向へ進む。\nPCは W・A・S・D か矢印キー。' },
      { head: '攻撃', body: '攻撃は自動。群れを避けながら、間合いを取って戦う。' },
      { head: '声の欠片', body: '倒した敵が落とす。集めるとレベルが上がり、\n強化を1つ選べる。' },
      { head: '必殺', body: '敵を倒すとゲージが溜まる。\n満タンで右下のボタン（PCはスペース）。' },
      { head: 'ひと休み', body: `${CONFIG.sleepAfterSeconds}秒立ち止まると居眠りして、HPが少しずつ回復する。` },
    ],
  },
  {
    title: '強化', en: 'POWER UP',
    items: [
      { head: '共鳴アーツ', body: `仲間から借りる技。${CONFIG.weaponSlots}つまで持てる。Lv8まで育つ。` },
      { head: 'サポート', body: `力を底上げする。${CONFIG.passiveSlots}つまで持てる。` },
      { head: '美麗の宝石箱', body: '騎士級より上の敵が、まれに落とす。\n持っている技やサポートが強くなる。' },
      { head: '壊れたスピーカー', body: '壊すと、回復や便利なアイテムが出る。' },
    ],
  },
  {
    title: '進化と合体', en: 'EVOLVE / FUSION',
    items: [
      { head: '進化', body: '共鳴アーツをLv8にして、決まったサポートを持ち、\n宝石箱を開ける。' },
      { head: '合体', body: '決まった2つの共鳴アーツを、両方Lv8にして、\n宝石箱を開ける。2つが1つになり、枠が1つ空く。' },
      { head: '組み合わせ', body: '図鑑にヒントがある。\n一度手に入れた技は、図鑑に記録される。' },
      { head: '優先', body: '宝石箱は、合体 → 進化 → レベルアップの順に起きる。' },
    ],
  },
  {
    title: 'エールと解放', en: 'YELL',
    items: [
      { head: 'エール', body: '戦いの中で集まる。プレイが終わると、持ち帰れる。' },
      { head: '使い道', body: 'キャラの解放、永続の強化、便利アイテム、\nカラー、ギャラリー、ミュージック。' },
      { head: 'ステージ', body: 'クリアすると、次のステージが開く。' },
      { head: 'ゲーム速度', body: '右上のボタンで、速さを切り替えられる。' },
    ],
  },
];

/** 遊び方。タイトル画面から開く。ページ送りは、ボタン・左右キー・画面の左右をタップ */
export class HowToScene extends Phaser.Scene {
  private page = 0;

  constructor() {
    super('HowTo');
  }

  create(data?: { page?: number }): void {
    this.page = Phaser.Math.Clamp(data?.page ?? 0, 0, PAGES.length - 1);
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    cam.fadeIn(180, 6, 9, 19);
    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setDepth(-5);

    const pg = PAGES[this.page];
    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'HOW TO PLAY', { fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 44, `${this.page + 1} / ${PAGES.length}`, { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.gold, fontStyle: '700' }).setOrigin(0.5);

    const panelW = Math.min(640, W - 40);
    const left = (W - panelW) / 2;
    let y = top + 96;
    this.add.text(left, y, pg.en, { fontFamily: FONT_EN, fontSize: '20px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 4 });
    this.add.text(left, y + 26, pg.title, { fontFamily: FONT_JP, fontSize: '36px', color: COLOR_HEX.white, fontStyle: '700' });
    y += 96;

    for (const it of pg.items) {
      const body = this.add.text(left + 24, y + 44, it.body, {
        fontFamily: FONT_JP, fontSize: '21px', color: COLOR_HEX.white, lineSpacing: 6, wordWrap: { width: panelW - 48, useAdvancedWrap: true },
      });
      const h = 44 + body.height + 20;
      this.add.rectangle(left, y, panelW, h, 0x111a3a, 0.92).setOrigin(0).setStrokeStyle(2, 0x87ceeb, 0.4).setDepth(-1);
      this.add.rectangle(left + 4, y + 10, 6, 28, 0x87ceeb, 1).setOrigin(0);
      this.add.text(left + 24, y + 10, it.head, { fontFamily: FONT_JP, fontSize: '24px', color: COLOR_HEX.accent, fontStyle: '700' });
      y += h + 14;
    }

    const go = (d: number) => {
      const next = this.page + d;
      if (next < 0 || next >= PAGES.length) return;
      this.scene.restart({ page: next });
    };
    const by = Math.max(H - Math.max(90, H * 0.08), y + 50);
    const bw = Math.min(200, Math.floor((panelW - 24) / 3));
    if (this.page > 0) makeButton(this, W / 2 - bw - 12, by, '◀ PREV', () => go(-1), { width: bw, height: 60, fontSize: 22, armDelayMs: 150 });
    makeButton(this, W / 2, by, 'TITLE', () => this.scene.start('Title'), { width: bw, height: 60, fontSize: 22 });
    if (this.page < PAGES.length - 1) makeButton(this, W / 2 + bw + 12, by, 'NEXT ▶', () => go(1), { width: bw, height: 60, fontSize: 22, primary: true, armDelayMs: 150 });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') go(1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') go(-1);
      else if (ev.key === 'Escape') this.scene.start('Title');
    });

    // 縦に長いページは、なぞって送れるようにする（小さい画面向け）
    const maxScroll = Math.max(0, by + 90 - H);
    let dragY: number | null = null;
    let dragStart = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; dragStart = cam.scrollY; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === null || !p.isDown) return;
      cam.scrollY = Phaser.Math.Clamp(dragStart - (p.y - dragY), 0, maxScroll);
    });
    this.input.on('pointerup', () => { dragY = null; });
  }
}
