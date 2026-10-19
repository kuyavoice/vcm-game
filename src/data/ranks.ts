// モード別ランク（2026-10-19 ユーザー承認）：SSS／SS／S／A／B／C の6段階。リザルト・共有画像・Xのポスト・ステージ選択のBEST・実績・図鑑の集計で使う。
// しきい値はこのファイルの表だけ直せばよい。循環参照を避けるため、ここでは data/*.ts を読み込まず、モードの stageId を数で持つ。
import type { RunResult } from '../scenes/ResultScene';

export const RANK_NAMES = ['SSS', 'SS', 'S', 'A', 'B', 'C'] as const;
export type RankName = (typeof RANK_NAMES)[number];

/** スタンプの地色（文字は暗色） */
export const RANK_COLORS: Record<RankName, string> = { SSS: '#FFD700', SS: '#C8D0E0', S: '#87CEEB', A: '#FFFFFF', B: '#FFFFFF', C: '#9AA3B8' };

/** セーブ・集計で持つ数（大きいほど上）：SSS=6 … C=1、無し=0 */
export function rankValue(name: RankName | null): number {
  return name ? RANK_NAMES.length - RANK_NAMES.indexOf(name) : 0;
}
export function rankName(v: number | undefined | null): RankName | null {
  return v && v >= 1 && v <= RANK_NAMES.length ? RANK_NAMES[RANK_NAMES.length - v] : null;
}

/** モードの stageId（data/rush.ts 96・endless.ts 97・nightmare.ts 98・score.ts 99 と同じ値） */
export const RANK_MODE_IDS = { stages: [1, 2, 3], rush: 96, endless: 97, nightmare: 98, score: 99 } as const;
/** 実績「全モードで S 以上」の対象 */
export const ALL_RANK_MODE_IDS: number[] = [1, 2, 3, 99, 98, 97, 96];

/** 通常ステージ（黒騎士は 10:00 に出る）：クリアタイム（秒）がこの値以下なら上から SSS・SS・S・A・B。クリアしていれば最低 C */
const STAGE_CLEAR_SEC = [620, 640, 660, 690, 750];
/** 悪夢（黒騎士は 15:00 に出る）：15:30 以内＝30秒で瞬殺＝SSS（ユーザー指定） */
const NIGHTMARE_CLEAR_SEC = [930, 960, 1020, 1110, 1200];
/** スコアアタック：スコアがこの値以上なら上から SSS〜B。倒れても付く。実データが少ない（32分で約152,000＝B）ので仮の値 */
const SCORE_PT = [260000, 230000, 200000, 170000, 130000];
/** エンドレス：生存秒数がこの値以上。称号と同じ境目（120分「すべてを超えし者」＝SSS はユーザー指定） */
const ENDLESS_SEC = [7200, 5400, 3600, 2400, 1200];
/** ボスラッシュ：1周目のタイムがこの値未満なら上から SSS・SS・S・A。完走すれば最低 B。1周できなければ無し */
const RUSH_SEC = [300, 360, 480, 600];

function atMost(table: number[], v: number): RankName {
  const i = table.findIndex((t) => v <= t);
  return i < 0 ? 'C' : RANK_NAMES[i];
}
function atLeast(table: number[], v: number): RankName {
  const i = table.findIndex((t) => v >= t);
  return i < 0 ? 'C' : RANK_NAMES[i];
}

export function rankOfEndless(sec: number): RankName { return atLeast(ENDLESS_SEC, sec); }
export function rankOfScore(pt: number): RankName { return atLeast(SCORE_PT, pt); }
export function rankOfRush(firstLoopSec: number): RankName {
  const i = RUSH_SEC.findIndex((t) => firstLoopSec < t);
  return i < 0 ? 'B' : RANK_NAMES[i];
}
/** 通常・悪夢：クリアしたときのタイム（秒）から。対象外のステージは null */
export function rankOfClear(stageId: number, clearSec: number): RankName | null {
  if (stageId === RANK_MODE_IDS.nightmare) return atMost(NIGHTMARE_CLEAR_SEC, clearSec);
  if ((RANK_MODE_IDS.stages as readonly number[]).includes(stageId)) return atMost(STAGE_CLEAR_SEC, clearSec);
  return null;
}

/** そのプレイのランク。付かないときは null（通常・悪夢で倒れた／ボスラッシュで1周できなかった） */
export function rankOf(r: RunResult): RankName | null {
  const id = r.stageId ?? 1;
  if (id === RANK_MODE_IDS.endless) return rankOfEndless(r.timeSec);
  if (id === RANK_MODE_IDS.score) return r.score !== undefined ? rankOfScore(r.score) : null;
  if (id === RANK_MODE_IDS.rush) {
    const first = r.rush?.loopTimes[0];
    return first !== undefined ? rankOfRush(first) : null;
  }
  if (!r.cleared) return null;
  return rankOfClear(id, r.timeSec);
}
