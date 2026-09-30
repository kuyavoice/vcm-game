import { MUSIC } from '../data/music';
import { visibleMusic } from '../scenes/MusicScene';
import type { SaveData } from './storage';

/**
 * 戦闘中の曲のカスタム（2026-09-30 ユーザー要望）。
 * オプションで BGM を CUSTOM にすると、ミュージックで解放した曲を、場面ごとに割り当てられる。
 * 割り当てていない場面と、解放していない曲を指した場面は、今までどおりの曲。
 */
export type BgmSlot = 'normal' | 'fullmoon' | 'rook' | 'queen' | 'bk1' | 'bk2' | 'redknight';

export const BGM_SLOTS: { id: BgmSlot; name: string; desc: string }[] = [
  { id: 'normal', name: '通常戦闘', desc: '道中。ふだんは操作キャラの曲' },
  { id: 'fullmoon', name: '満月', desc: '満月の1分間' },
  { id: 'rook', name: '城兵級', desc: 'STAGE 1 などのボス' },
  { id: 'queen', name: '女王級', desc: 'STAGE 2 などのボス' },
  { id: 'bk1', name: '黒騎士 前編', desc: '形態変化まで' },
  { id: 'bk2', name: '黒騎士 後編', desc: '形態変化のあと' },
  { id: 'redknight', name: '悪夢の黒騎士', desc: 'EXステージ最後のボス' },
];

/** 割り当てに使える曲（一覧に出ていて、解放済み） */
export function assignableMusic(save: SaveData) {
  return visibleMusic(save).filter((m) => m.price === 0 || save.music.includes(m.id));
}

/** 場面 → 音声のキー。CUSTOM でないときや、使えない曲を指しているときは空 */
export function customBgmKeys(save: SaveData): Partial<Record<BgmSlot, string>> {
  const out: Partial<Record<BgmSlot, string>> = {};
  if (save.settings.bgmMode !== 'custom') return out;
  const ok = new Set(assignableMusic(save).map((m) => m.id));
  for (const s of BGM_SLOTS) {
    const id = save.settings.bgmCustom[s.id];
    if (!id || !ok.has(id)) continue;
    const m = MUSIC.find((x) => x.id === id);
    if (m) out[s.id] = m.key;
  }
  return out;
}
