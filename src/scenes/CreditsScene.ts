import Phaser from 'phaser';
import { FONT_EN, FONT_JP, COLOR_HEX } from '../utils/fonts';
import { makeButton } from '../ui/Button';
import { go, wipeIn, panel } from '../ui/theme';
import { lang } from '../utils/lang';

/**
 * クレジットと AI 利用の開示（2026-10-05 ユーザー指示）。タイトルの下の文言から開く。
 * 文面はユーザーから聞いた事実だけを書く（ボイスの名前はユーザー指定の並び。役は書かない。隠しキャラの名前は出さない）。
 */
const SECTIONS: { en: string; title: string; lines: string[] }[] = [
  { en: 'ORIGINAL', title: '原作', lines: ['『ボイスコネクトメモリアル』　言峰空也（カクヨムにて連載中）', 'このゲームはファンゲーム（IF・お祭り枠）です。'] },
  { en: 'PRODUCTION', title: '企画・制作・プログラム', lines: ['言峰空也', 'プログラムは Claude（Anthropic）との共同作業で開発しました。'] },
  { en: 'VOICE', title: 'ボイス', lines: ['言峰空也／雪狐／瑞浪蓮／雛桜律', '一部のボイスは ElevenLabs による音声生成を使用しています。'] },
  { en: 'MUSIC', title: '音楽', lines: ['言峰空也', '全曲を Suno（有料プラン）で制作。権利は言峰空也に帰属します。'] },
  { en: 'GRAPHICS', title: 'イラスト・ドット絵', lines: ['一部の画像の制作に、画像生成 AI を活用しています。'] },
];

const SECTIONS_EN: { en: string; title: string; lines: string[] }[] = [
  // 人名はローマ字の読みが確定していないので、英語版でも日本語表記のまま
  { en: 'ORIGINAL', title: 'Original work', lines: ['"Voice Connect Memorial" by 言峰空也 (serialized on Kakuyomu)', 'This is a fan game (a what-if, festival piece).'] },
  { en: 'PRODUCTION', title: 'Planning / Production / Programming', lines: ['言峰空也', 'Programmed together with Claude (Anthropic).'] },
  { en: 'VOICE', title: 'Voices', lines: ['言峰空也 / 雪狐 / 瑞浪蓮 / 雛桜律', 'Some voices were generated with ElevenLabs.'] },
  { en: 'MUSIC', title: 'Music', lines: ['言峰空也', 'All tracks were made with Suno (paid plan). Rights belong to 言峰空也.'] },
  { en: 'GRAPHICS', title: 'Illustrations / Pixel art', lines: ['Some images were made with image-generation AI.'] },
];

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create(): void {
    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    wipeIn(this);
    this.add.tileSprite(0, 0, W, H, 'bg').setOrigin(0).setDepth(-5);

    const top = Math.max(H * 0.06, 40);
    this.add.text(W / 2, top, 'CREDITS', { fontFamily: FONT_EN, fontSize: '44px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 5 }).setOrigin(0.5);
    this.add.text(W / 2, top + 44, lang() === 'en' ? 'Credits and use of AI' : 'クレジットと AI 利用について', { fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.dim }).setOrigin(0.5);

    const panelW = Math.min(640, W - 40);
    const left = (W - panelW) / 2;
    let y = top + 92;
    for (const sec of lang() === 'en' ? SECTIONS_EN : SECTIONS) {
      const body = this.add.text(left + 24, y + 44, sec.lines, {
        fontFamily: FONT_JP, fontSize: '18px', color: COLOR_HEX.white, lineSpacing: 6, wordWrap: { width: panelW - 48, useAdvancedWrap: true },
      });
      const h = 44 + body.height + 18;
      panel(this, left, y, panelW, h, { alpha: 0.92, strokeAlpha: 0.4, depth: -1 });
      this.add.text(left + 24, y + 10, sec.en, { fontFamily: FONT_EN, fontSize: '14px', color: COLOR_HEX.accent, fontStyle: '700', letterSpacing: 3 });
      this.add.text(left + 24 + sec.en.length * 11 + 16, y + 8, sec.title, { fontFamily: FONT_JP, fontSize: '20px', color: COLOR_HEX.white, fontStyle: '700' });
      y += h + 12;
    }
    this.add.text(W / 2, y + 10, '© 2025-2026 言峰空也 / VOICE CONNECT MEMORIAL PROJECT', {
      fontFamily: FONT_EN, fontSize: '13px', color: COLOR_HEX.dim, letterSpacing: 1,
    }).setOrigin(0.5, 0);

    const by = Math.max(H - Math.max(90, H * 0.08), y + 80);
    makeButton(this, W / 2, by, 'TITLE', () => go(this, 'Title'), { width: 220, height: 60, fontSize: 22 });
    this.input.keyboard?.on('keydown-ESC', () => go(this, 'Title'));

    // 縦に長いときは、なぞって送れるようにする（小さい画面向け）
    const maxScroll = Math.max(0, by + 90 - H);
    if (maxScroll > 0) {
      let startY = 0;
      let startScroll = 0;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { startY = p.y; startScroll = cam.scrollY; });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        cam.scrollY = Phaser.Math.Clamp(startScroll + (startY - p.y), 0, maxScroll);
      });
    }
  }
}
