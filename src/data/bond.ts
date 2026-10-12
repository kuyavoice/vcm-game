/**
 * 絆（エールを贈る。2026-10-12 ユーザー承認「C案」）。
 * 図鑑のキャラ画面 →「エールを贈る」で作戦室（YellRoomScene）へ。100 ずつ贈るとお礼のボイス。累計で絆が上がり、段階ごとに解放。
 * 累計はセーブの `bond[キャラID]`。贈ったエールは戻らない。
 *
 * ボイスのファイル名（make_voice.py の MAP に足す）：
 * - お礼：`{id}_thanks_1.mp3` …（ランダム。無ければキャラ選択のボイスで代用）
 * - 特別ボイス：`{id}_bond_1.mp3` … `_5`（絆 1〜5 に対応。図鑑のボイス一覧では絆の段階まで）
 */
export const BOND_UNIT = 100;

export interface BondTier {
  /** 累計がこの値に達すると解放 */
  at: number;
  label: string;
  sub: string;
}

export const BOND_TIERS: BondTier[] = [
  { at: 300, label: '特別ボイス①', sub: '自己紹介' },
  { at: 800, label: '特別ボイス②', sub: '仲間のこと' },
  { at: 1500, label: '特別ボイス③ ＋ くつろぎの立ち絵', sub: '戦いのこと。作戦室の絵が替わる' },
  { at: 2500, label: '特別ボイス④', sub: 'あなたへ' },
  { at: 4000, label: '特別ボイス⑤ ＋ タイトルコール', sub: '絆MAX。タイトルの声が推しの声に' },
];

export const BOND_MAX = BOND_TIERS.length;

/** 絆の段階（0〜BOND_MAX） */
export function bondLevel(total: number): number {
  return BOND_TIERS.filter((t) => total >= t.at).length;
}

/** 次の段階（無ければ undefined） */
export function bondNext(total: number): BondTier | undefined {
  return BOND_TIERS[bondLevel(total)];
}

/** くつろぎの立ち絵が使える段階 */
export const BOND_RELAX_LEVEL = 3;
