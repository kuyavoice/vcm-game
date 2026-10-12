/**
 * 絆（エールを贈る。2026-10-12 ユーザー承認「C案」。数値は 2026-10-12 に 8,000 案で確定）。
 * 図鑑のキャラ画面 →「エールを贈る」で作戦室（YellRoomScene）へ。100／1,000 ずつ贈るとお礼のボイス。累計で絆が上がり、段階ごとに解放。
 * 累計はセーブの `bond[キャラID]`。贈ったエールは戻らない。
 *
 * ボイスのファイル名（make_voice.py の MAP に足す）：
 * - お礼：`{id}_thanks_1.mp3` …（ランダム。無ければキャラ選択のボイスで代用）
 * - 特別ボイス：`{id}_bond_1.mp3` … `_5`（絆 1〜5 に対応。図鑑のボイス一覧では絆の段階まで）
 */
export const BOND_UNITS = [100, 1000] as const;

export interface BondTier {
  /** 累計がこの値に達すると解放 */
  at: number;
  label: string;
  sub: string;
}

export const BOND_TIERS: BondTier[] = [
  { at: 500, label: '特別ボイス①', sub: '自己紹介' },
  { at: 1500, label: '特別ボイス②', sub: '仲間のこと' },
  { at: 3000, label: '特別ボイス③ ＋ くつろぎの立ち絵', sub: '戦いのこと。作戦室の絵が替わる' },
  { at: 5000, label: '特別ボイス④', sub: 'あなたへ' },
  { at: 8000, label: '特別ボイス⑤ ＋ オーラと残像 ＋ タイトルコール', sub: '絆MAX。戦闘中に光をまとう。タイトルの声が推しの声に' },
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
/** 戦闘中のオーラ・残像が付く段階 */
export const BOND_FX_LEVEL = 5;

/** オーラの色。`chara` はそのキャラの色（CHARACTERS[id].color）。選択はセーブの `bondAura[キャラID]`（未設定＝chara） */
export const AURA_COLORS: { id: string; name: string; color: number | null }[] = [
  { id: 'chara', name: 'キャラ色', color: null },
  { id: 'gold', name: '金', color: 0xffd700 },
  { id: 'white', name: '白', color: 0xf4f8ff },
  { id: 'crimson', name: '紅', color: 0xff3b5c },
  { id: 'azure', name: '蒼', color: 0x40b8ff },
  { id: 'violet', name: '紫', color: 0xb060ff },
  { id: 'emerald', name: '翠', color: 0x3ee6a0 },
];

export function auraColorOf(auraId: string | undefined, charaColor: number): number {
  const c = AURA_COLORS.find((a) => a.id === auraId) ?? AURA_COLORS[0];
  return c.color ?? charaColor;
}
