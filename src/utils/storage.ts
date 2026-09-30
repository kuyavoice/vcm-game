import { CONFIG } from '../data/config';

export interface BestRecord {
  kills: number;
  timeSec: number;
  level: number;
  yell: number;
  cleared: boolean;
}

export interface SaveData {
  /** 旧形式（Stage 1 の記録として移行） */
  best: BestRecord | null;
  /** ステージ別ベスト（キー = ステージID） */
  bests: Record<string, BestRecord>;
  /** クリア済みステージID */
  cleared: number[];
  settings: { bgm: number; se: number; voice: number; speed: number; character: string; /** ダメージの数字を出す */ damageNumbers: boolean; /** 必殺ボタンの位置（既定は右下） */ specialSide: 'right' | 'left'; /** 戦闘中の曲：normal＝今までどおり／custom＝場面ごとに割り当てた曲 */ bgmMode: 'normal' | 'custom'; /** 場面 → 曲ID（music.ts）。utils/bgmCustom.ts */ bgmCustom: Record<string, string>; /** 敵に当たったときの光り方：strong＝白く光る（既定）／soft＝淡く／off＝光らない */ hitFlash: 'strong' | 'soft' | 'off'; /** 画面全体の光（必殺・撃破など）：on／soft／off */ screenFlash: 'on' | 'soft' | 'off' };
  totalYell: number;
  /** 解放済みキャラID（空夜は常に使える） */
  unlockedCharacters: string[];
  /** 永続強化のLv（キー = shop.ts の id） */
  permanent: Record<string, number>;
  /** 図鑑：発見したアーツID（進化は `id:evo`） */
  codex: string[];
  /** レベルアップ時の便利アイテムの所持数（エールで購入） */
  consumables: { reroll: number; skip: number; ban: number };
  /** 所有カラー（キャラID → バリエーションID[]）と選択中（キャラID → バリエーションID。未設定＝標準） */
  colors: Record<string, string[]>;
  colorSelected: Record<string, string>;
  /** スコアアタックの端末内ランキング */
  scoreRanking: { score: number; kills: number; timeSec: number; character: string; date: string; cleared: boolean }[];
  /** エンドレスの端末内の記録（生存時間の長い順） */
  endlessRanking: { timeSec: number; score: number; kills: number; level: number; character: string; date: string }[];
  /** 隠しキャラの出現状態（キャラID → pending＝出現演出がまだ／shown＝演出済みで NEW の印だけ）。一度選ぶと消える */
  secretNew: Record<string, 'pending' | 'shown'>;
  /** ギャラリーで解放した絵のID */
  gallery: string[];
  /** ミュージックで解放した曲のID */
  music: string[];
  /** 図鑑：遭遇した敵のID。null は、まだ一度も作っていない（これまでの記録から作る。utils/bestiary.ts） */
  bestiary: string[] | null;
}

const DEFAULT: SaveData = {
  best: null,
  bests: {},
  cleared: [],
  settings: { bgm: 0.7, se: 0.8, voice: 1, speed: 1, character: 'kuya', damageNumbers: true, specialSide: 'right', bgmMode: 'normal', bgmCustom: {}, hitFlash: 'strong', screenFlash: 'on' },
  totalYell: 0,
  unlockedCharacters: [],
  permanent: {},
  codex: [],
  consumables: { reroll: 0, skip: 0, ban: 0 },
  colors: {},
  colorSelected: {},
  scoreRanking: [],
  endlessRanking: [],
  secretNew: {},
  gallery: [],
  music: [],
  bestiary: null,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const data: SaveData = {
      ...structuredClone(DEFAULT),
      ...parsed,
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}), bgmCustom: { ...(parsed.settings?.bgmCustom ?? {}) } },
      bests: { ...(parsed.bests ?? {}) },
      cleared: [...(parsed.cleared ?? [])],
      unlockedCharacters: [...(parsed.unlockedCharacters ?? [])],
      permanent: { ...(parsed.permanent ?? {}) },
      codex: [...(parsed.codex ?? [])],
      consumables: { ...DEFAULT.consumables, ...(parsed.consumables ?? {}) },
      colors: { ...(parsed.colors ?? {}) },
      colorSelected: { ...(parsed.colorSelected ?? {}) },
      scoreRanking: [...(parsed.scoreRanking ?? [])],
      endlessRanking: [...(parsed.endlessRanking ?? [])],
      secretNew: { ...(parsed.secretNew ?? {}) },
      gallery: [...(parsed.gallery ?? [])],
      music: [...(parsed.music ?? [])],
      bestiary: parsed.bestiary ? [...parsed.bestiary] : null,
    };
    // 旧形式の移行：best → bests[1]
    if (data.best && !data.bests['1']) {
      data.bests['1'] = data.best;
      if (data.best.cleared && !data.cleared.includes(1)) data.cleared.push(1);
    }
    return data;
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
  } catch {
    /* プライベートモード等では保存しない */
  }
}

/** 図鑑に登録（重複なし）。返り値: 新規なら true */
export function recordCodex(id: string): boolean {
  const sv = loadSave();
  if (sv.codex.includes(id)) return false;
  sv.codex.push(id);
  writeSave(sv);
  return true;
}

export function isStageUnlocked(data: SaveData, unlockAfter?: number): boolean {
  return unlockAfter === undefined || data.cleared.includes(unlockAfter);
}
