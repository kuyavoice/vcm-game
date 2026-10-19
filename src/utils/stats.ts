import type { SaveData } from './storage';
import type { RunResult } from '../scenes/ResultScene';
import { rankOf, rankValue, rankOfScore, rankOfEndless, rankOfRush } from '../data/ranks';

/**
 * プレイの集計（2026-10-12 ユーザー承認）。合計とキャラ別。リザルトで足す（デバッグ・審査モードは足さない）。
 * 更新前のプレイは残っていないので、初回だけランキング（スコアアタック・エンドレス・ボスラッシュ）から回数・時間・撃破を概算で起こす（エールは分からない）。
 */
export interface PlayStats {
  runs: number;
  timeSec: number;
  kills: number;
  yell: number;
  clears: number;
  specials: number;
  chests: number;
  fullMoons: number;
  bestLevel: number;
  /** 最高ランク（data/ranks.ts の rankValue。0＝無し。2026-10-19） */
  bestRank: number;
}

export const EMPTY_STATS: PlayStats = { runs: 0, timeSec: 0, kills: 0, yell: 0, clears: 0, specials: 0, chests: 0, fullMoons: 0, bestLevel: 0, bestRank: 0 };

export interface StatsData {
  total: PlayStats;
  chars: Record<string, PlayStats>;
}

function add(dst: PlayStats, s: Partial<PlayStats>): void {
  dst.runs += s.runs ?? 0;
  dst.timeSec += s.timeSec ?? 0;
  dst.kills += s.kills ?? 0;
  dst.yell += s.yell ?? 0;
  dst.clears += s.clears ?? 0;
  dst.specials += s.specials ?? 0;
  dst.chests += s.chests ?? 0;
  dst.fullMoons += s.fullMoons ?? 0;
  dst.bestLevel = Math.max(dst.bestLevel, s.bestLevel ?? 0);
  dst.bestRank = Math.max(dst.bestRank ?? 0, s.bestRank ?? 0);
}

function charOf(st: StatsData, id: string): PlayStats {
  return (st.chars[id] ??= { ...EMPTY_STATS });
}

/** 集計が無ければランキングから起こす（呼ぶ側が writeSave する） */
export function ensureStats(save: SaveData): StatsData {
  if (save.stats) return save.stats;
  const st: StatsData = { total: { ...EMPTY_STATS }, chars: {} };
  const put = (id: string, s: Partial<PlayStats>) => { add(st.total, s); add(charOf(st, id), s); };
  for (const e of save.scoreRanking) put(e.character, { runs: 1, timeSec: e.timeSec, kills: e.kills, clears: e.cleared ? 1 : 0, bestRank: rankValue(rankOfScore(e.score)) });
  for (const e of save.endlessRanking) put(e.character, { runs: 1, timeSec: e.timeSec, kills: e.kills, bestLevel: e.level, bestRank: rankValue(rankOfEndless(e.timeSec)) });
  for (const e of save.rushRanking) put(e.character, { runs: 1, timeSec: e.timeSec, clears: e.loops > 0 ? 1 : 0, bestRank: rankValue(rankOfRush(e.timeSec)) });
  save.stats = st;
  return st;
}

/** そのプレイの結果を足す */
export function addRunStats(save: SaveData, r: RunResult): void {
  const st = ensureStats(save);
  const s: Partial<PlayStats> = {
    runs: 1, timeSec: Math.round(r.timeSec), kills: r.kills, yell: r.yell, clears: r.cleared ? 1 : 0,
    specials: r.specials ?? 0, chests: r.chests ?? 0, fullMoons: r.fullMoons ?? 0, bestLevel: r.level, bestRank: rankValue(rankOf(r)),
  };
  add(st.total, s);
  add(charOf(st, r.characterId), s);
}

export function statsOf(save: SaveData, id: string): PlayStats {
  return ensureStats(save).chars[id] ?? { ...EMPTY_STATS };
}

/** 1:23:45 ／ 23:45 */
export function fmtPlayTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}
