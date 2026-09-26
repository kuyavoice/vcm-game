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
  settings: { bgm: number; se: number; voice: number; speed: number; character: string };
  totalYell: number;
  /** 解放済みキャラID（空夜は常に使える） */
  unlockedCharacters: string[];
}

const DEFAULT: SaveData = {
  best: null,
  bests: {},
  cleared: [],
  settings: { bgm: 0.7, se: 0.8, voice: 1, speed: 1, character: 'kuya' },
  totalYell: 0,
  unlockedCharacters: [],
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const data: SaveData = {
      ...structuredClone(DEFAULT),
      ...parsed,
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}) },
      bests: { ...(parsed.bests ?? {}) },
      cleared: [...(parsed.cleared ?? [])],
      unlockedCharacters: [...(parsed.unlockedCharacters ?? [])],
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

export function isStageUnlocked(data: SaveData, unlockAfter?: number): boolean {
  return unlockAfter === undefined || data.cleared.includes(unlockAfter);
}
