import { loadSave } from './storage';

/**
 * 最低限の英語対応（2026-10-05。コンテスト向け）。オプションの LANGUAGE で切り替える。
 * 全文の翻訳はしない。審査員が最初に触る画面（タイトルの案内・遊び方・キャラ選択とステージ選択の見出し・リザルトの一言・初回の注意・クレジット）だけ。
 * 使い方：t('日本語', 'English')。ゲーム中の台詞・技名・ルナの言葉は日本語のまま。
 */
export type Lang = 'ja' | 'en';

export function lang(): Lang {
  return loadSave().settings.lang === 'en' ? 'en' : 'ja';
}

export function t(ja: string, en: string): string {
  return lang() === 'en' ? en : ja;
}
