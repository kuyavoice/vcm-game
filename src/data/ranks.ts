// モード別ランク（2026-10-19 ユーザー承認）：SSS／SS／S／A／B／C の6段階。リザルト・共有画像・Xのポスト・ステージ選択のBEST・実績・図鑑の集計で使う。
// しきい値はこのファイルの表だけ直せばよい。循環参照を避けるため、ここでは data/*.ts を読み込まず、モードの stageId を数で持つ。
import type { RunResult } from '../scenes/ResultScene';

export const RANK_NAMES = ['SSS', 'SS', 'S', 'A', 'B', 'C'] as const;
export type RankName = (typeof RANK_NAMES)[number];

/** スタンプの地色（文字は暗色） */
export const RANK_COLORS: Record<RankName, string> = { SSS: '#E6B3FF', SS: '#E8EEF8', S: '#FFD700', A: '#C0C8D0', B: '#C8865A', C: '#8A9099' };
/** エンブレム画像のテクスチャキー（utils/optionalAssets.ts。無いときは文字のスタンプ） */
export const rankImageKey = (name: RankName) => `rank_${name.toLowerCase()}`;

/** セーブ・集計で持つ数（大きいほど上）：SSS=6 … C=1、無し=0 */
export function rankValue(name: RankName | null): number {
  return name ? RANK_NAMES.length - RANK_NAMES.indexOf(name) : 0;
}
export function rankName(v: number | undefined | null): RankName | null {
  return v && v >= 1 && v <= RANK_NAMES.length ? RANK_NAMES[RANK_NAMES.length - v] : null;
}

/** モードの stageId（data/rush.ts 96・endless.ts 97・nightmare.ts 98・score.ts 99 と同じ値） */
export const RANK_MODE_IDS = { stages: [1, 2, 3], arena: 95, rush: 96, endless: 97, nightmare: 98, score: 99 } as const;
/** 実績「全モードで S 以上」の対象（2026-10-21 闘技場を追加） */
export const ALL_RANK_MODE_IDS: number[] = [1, 2, 3, 99, 98, 97, 96, 95];

/** 通常ステージ（黒騎士は 10:00 に出る）：クリアタイム（秒）がこの値以下なら上から SSS・SS・S・A・B。クリアしていれば最低 C */
const STAGE_CLEAR_SEC = [620, 640, 660, 690, 750];
/** 悪夢（黒騎士は 15:00 に出る）：15:30 以内＝30秒で瞬殺＝SSS（ユーザー指定） */
const NIGHTMARE_CLEAR_SEC = [930, 960, 1020, 1110, 1200];
/** 闘技場：8体のクリアタイム（秒）。熟練者の 3:45〜4:05 を SSS〜SS の境目に（2026-10-21 ユーザー承認：4:00／4:30／5:15／6:30／8:30） */
const ARENA_CLEAR_SEC = [240, 270, 315, 390, 510];
/** スコアアタック：スコアがこの値以上なら上から SSS〜B。倒れても付く。2026-10-22 見直し：上限に近い回（無敵・最強ビルドの計測 151,534、作者と最もやり込んだ人で 155,000 前後）を基準に SSS＝150,000（ユーザー指定） */
const SCORE_PT = [150000, 140000, 125000, 105000, 80000];
/** エンドレス：生存秒数がこの値以上。2026-10-23 見直し（ユーザー承認・案A）：SSS 60分（3周完走＝4周目の締めが始まるところ）／SS 45分／S 30分／A 20分（1周完走）／B 10分。
 *  旧 120/90/60/40/20 分は「1回2時間」の苦行だったため。称号（120分「すべてを超えし者」など12段階）はランクとは別にそのまま残す */
const ENDLESS_SEC = [3600, 2700, 1800, 1200, 600];
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
  if (stageId === RANK_MODE_IDS.arena) return atMost(ARENA_CLEAR_SEC, clearSec);
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
