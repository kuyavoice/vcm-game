import { CONFIG } from '../data/config';

export interface SaveData {
  best: { kills: number; timeSec: number; level: number; yell: number; cleared: boolean } | null;
  settings: { bgm: number; se: number; voice: number; speed: number };
  totalYell: number;
}

const DEFAULT: SaveData = {
  best: null,
  settings: { bgm: 0.7, se: 0.8, voice: 1, speed: 1 },
  totalYell: 0,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...structuredClone(DEFAULT), ...parsed, settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}) } };
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
