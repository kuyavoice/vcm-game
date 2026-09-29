import { stageById, type StageDef } from '../data/stages';
import { WAVES } from '../data/waves';
import { loadSave, writeSave, type SaveData } from './storage';

/**
 * 図鑑「ネミノクス」の登録（追補パッチ⑩）。その敵と初めて遭遇した時に登録する。
 * 登録するのはゲーム内の敵ID（enemies.ts）。図鑑の項目との対応は data/codex.ts。
 */

/** あるステージで、その時間までに出会う敵 */
function seenInStage(stage: StageDef, timeSec: number, cleared: boolean): string[] {
  const out = new Set<string>();
  for (const b of stage.waves ?? WAVES) {
    if (!cleared && b.from > timeSec) continue;
    for (const [id, w] of Object.entries(b.weights)) if ((w ?? 0) > 0) out.add(id);
    if (b.ambush) out.add(b.ambush.type);
    // ボスの差し替えは Spawner と同じ決まり
    if (b.boss) out.add(b.boss === 'king' && stage.bossId && !stage.waves ? stage.bossId : b.boss);
  }
  if (cleared || timeSec >= 120) for (const id of Object.keys(stage.extraWeights)) out.add(id);
  // 騎兵は黒騎士が呼ぶ。倒したのなら、出会っている
  if (cleared && (out.has('blackknight') || out.has('redknight'))) out.add('cavalry');
  return [...out];
}

/** この機能が入る前の記録から、すでに出会っている敵を数える（最初の1回だけ使う） */
function seedFromRecords(save: SaveData): string[] {
  const out = new Set<string>();
  for (const [key, best] of Object.entries(save.bests)) {
    const id = Number(key);
    const stage = stageById(id);
    if (stage.id !== id) continue;
    for (const e of seenInStage(stage, best.timeSec, best.cleared || save.cleared.includes(id))) out.add(e);
  }
  if (save.scoreRanking.length) {
    const time = Math.max(...save.scoreRanking.map((r) => r.timeSec));
    for (const e of seenInStage(stageById(99), time, save.scoreRanking.some((r) => r.cleared))) out.add(e);
  }
  return [...out];
}

/** 登録済みの敵ID。初めて呼んだときは、これまでの記録から作って保存する */
export function ensureBestiary(save: SaveData): string[] {
  if (!save.bestiary) {
    save.bestiary = seedFromRecords(save);
    writeSave(save);
  }
  return save.bestiary;
}

/** 遭遇した敵を登録（重複なし）。返り値: 新規なら true */
export function recordEnemySeen(id: string): boolean {
  const sv = loadSave();
  const list = ensureBestiary(sv);
  if (list.includes(id)) return false;
  list.push(id);
  writeSave(sv);
  return true;
}
